import { afterEach, describe, it, expect, vi } from "vitest";
import { dispatchWebhook } from "../src/lib/webhook";
import { adminHarness } from "./helpers/admin-sqlite";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const stubFetch = () => {
	const calls: Array<{ url: string; body: string }> = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			calls.push({ url, body: String(init.body) });
			return new Response("ok", { status: 200 });
		}),
	);
	return calls;
};

describe("Site-scoped webhook routing", () => {
	it("routes events to matching site endpoints and global endpoints while skipping other sites", async () => {
		const { env, sqlite } = adminHarness();
		const calls = stubFetch();

		// Insert sites for FK constraints
		sqlite
			.prepare(
				`INSERT INTO sites (id, domain, name, created_at, updated_at)
				 VALUES ('site_a', 'site-a.com', 'Site A', 1, 1),
				        ('site_b', 'site-b.com', 'Site B', 2, 2)`,
			)
			.run();

		// Configure:
		// 1. Global endpoint (site_id: null) -> https://hooks.example.com/global
		// 2. Site A endpoint (site_id: "site_a") -> https://hooks.example.com/site-a
		// 3. Site B endpoint (site_id: "site_b") -> https://hooks.example.com/site-b
		sqlite
			.prepare(
				`INSERT INTO webhook_endpoints (id, url, secret, adapter, enabled, fail_count, site_id, created_at, updated_at)
				 VALUES ('w_global', 'https://hooks.example.com/global', NULL, 'generic', 1, 0, NULL, 1, 1),
				        ('w_site_a', 'https://hooks.example.com/site-a', NULL, 'generic', 1, 0, 'site_a', 2, 2),
				        ('w_site_b', 'https://hooks.example.com/site-b', NULL, 'generic', 1, 0, 'site_b', 3, 3)`,
			)
			.run();

		// Event on Site A
		await dispatchWebhook(env, {
			event: "comment.posted",
			comment_id: "c1",
			post_slug: "site_a::welcome",
			user_id: "u1",
			ts: Date.now(),
		});

		expect(calls.map((c) => c.url)).toEqual([
			"https://hooks.example.com/global",
			"https://hooks.example.com/site-a",
		]);

		calls.length = 0;

		// Event on Site B
		await dispatchWebhook(env, {
			event: "comment.posted",
			comment_id: "c2",
			post_slug: "site_b::welcome",
			user_id: "u2",
			ts: Date.now(),
		});

		expect(calls.map((c) => c.url)).toEqual([
			"https://hooks.example.com/global",
			"https://hooks.example.com/site-b",
		]);

		calls.length = 0;

		// Event on legacy post (no site)
		await dispatchWebhook(env, {
			event: "comment.posted",
			comment_id: "c3",
			post_slug: "legacy-post",
			user_id: "u3",
			ts: Date.now(),
		});

		// Only global endpoint should receive it
		expect(calls.map((c) => c.url)).toEqual([
			"https://hooks.example.com/global",
		]);
	});
});
