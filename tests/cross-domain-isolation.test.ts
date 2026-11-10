import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSite, upsertPost } from "../src/db/queries";
import { bootstrap } from "../src/routes/api.bootstrap";
import { comments } from "../src/routes/api.comments";
import { pageEngagement } from "../src/routes/api.page-engagement";
import { counts } from "../src/routes/api.counts";
import { subscriptions } from "../src/routes/api.subscriptions";
import { localeMiddleware } from "../src/lib/locale";
import { clearSitesCache } from "../src/lib/sites";
import {
	installMockCaches,
	uninstallMockCaches,
	type MockCache,
} from "./helpers/mock-caches";
import type { Bindings } from "../src/index";

const MIGRATIONS_DIR = join(__dirname, "../src/db/migrations");

const makeD1 = (db: DatabaseSync): any => ({
	prepare(sql: string) {
		const stmt = db.prepare(sql);
		let bound: unknown[] = [];
		return {
			sql,
			bind(...args: unknown[]) {
				bound = args.map((a) => (a === undefined ? null : a));
				return this;
			},
			async run() {
				const r = stmt.run(...(bound as never[]));
				return { success: true, meta: { changes: r.changes } };
			},
			async first() {
				return stmt.get(...(bound as never[])) ?? null;
			},
			async all() {
				return { results: stmt.all(...(bound as never[])) };
			},
		};
	},
	async batch(stmts: { sql: string; all(): Promise<unknown>; run(): Promise<unknown> }[]) {
		const out = [];
		for (const s of stmts) {
			out.push(await (/^\s*(INSERT|UPDATE|DELETE)/i.test(s.sql) ? s.run() : s.all()));
		}
		return out;
	},
});

let sqlite: DatabaseSync;
let cache: MockCache;
let env: Bindings;

const execCtx = {
	waitUntil() {},
	passThroughOnException() {},
} as unknown as ExecutionContext;

const app = () =>
	new Hono<{ Bindings: Bindings }>()
		.use("/api/*", localeMiddleware())
		.route("/api/v1/bootstrap", bootstrap)
		.route("/api/v1/comments", comments)
		.route("/api/v1/page-engagement", pageEngagement)
		.route("/api/v1/counts", counts)
		.route("/api/v1/subscribe", subscriptions);

beforeEach(() => {
	clearSitesCache();
	cache = installMockCaches();
	vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
	sqlite = new DatabaseSync(":memory:");
	for (const file of readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
	}

	sqlite
		.prepare(
			`INSERT INTO users (id, provider, provider_id, name, email, avatar_url,
			                    is_admin, role, created_at)
			 VALUES ('01USER0000000000000000000A', 'github', 'gh-a', 'User A', 'a@test.com', NULL, 0, 'user', 1700000000000),
			        ('01USER0000000000000000000B', 'github', 'gh-b', 'User B', 'b@test.com', NULL, 0, 'user', 1700000000000),
			        ('01USER0000000000000000000L', 'github', 'gh-l', 'User Legacy', 'l@test.com', NULL, 0, 'user', 1700000000000)`,
		)
		.run();

	env = {
		DB: makeD1(sqlite),
		SESSIONS: {
			get: async () => null,
			put: async () => {},
			delete: async () => {},
		} as any,
		ANALYTICS: { writeDataPoint() {} } as any,
		TURNSTILE_SECRET_KEY: "",
		IP_HASH_SECRET: "test-ip-hash-secret",
		ORIGIN: "http://localhost",
		DEFAULT_SORT: "new",
		VOTING_ENABLED: "true",
		PAGE_REACTIONS_ENABLED: "true",
		PAGE_VOTES_ENABLED: "true",
		PUBLIC_BASE_URL: "https://garrul.example.com",
		EMAIL_FROM: "no-reply@example.com",
		EMAIL_PROVIDER: "resend",
		RESEND_API_KEY: "re_test",
	} as unknown as Bindings;
});

afterEach(() => {
	uninstallMockCaches();
	clearSitesCache();
	vi.unstubAllGlobals();
});

describe("Cross-domain slug isolation & clean output", () => {
	it("isolates threads and comments with identical slugs under different domains", async () => {
		const d1 = env.DB;
		const siteA = await createSite(d1, { domain: "site-a.com", name: "Site A" });
		const siteB = await createSite(d1, { domain: "site-b.com", name: "Site B" });
		clearSitesCache();

		// Insert post & comment for Site A (slug: "welcome")
		const postA = await upsertPost(d1, `${siteA.id}::welcome`, "Welcome A", "https://site-a.com/welcome", null, siteA.id, "welcome");
		sqlite
			.prepare(
				`INSERT INTO comments (id, post_slug, parent_id, user_id, body_md, body_html,
				                       renderer_version, status, created_at, depth)
				 VALUES ('01COMM0000000000000000000A', ?, NULL, '01USER0000000000000000000A',
				         'Hello from Site A', '<p>Hello from Site A</p>', 1, 'approved', 1700000001000, 1)`,
			)
			.run(postA.slug);

		// Insert post & comment for Site B (slug: "welcome")
		const postB = await upsertPost(d1, `${siteB.id}::welcome`, "Welcome B", "https://site-b.com/welcome", null, siteB.id, "welcome");
		sqlite
			.prepare(
				`INSERT INTO comments (id, post_slug, parent_id, user_id, body_md, body_html,
				                       renderer_version, status, created_at, depth)
				 VALUES ('01COMM0000000000000000000B', ?, NULL, '01USER0000000000000000000B',
				         'Hello from Site B', '<p>Hello from Site B</p>', 1, 'approved', 1700000002000, 1)`,
			)
			.run(postB.slug);

		// Insert post & comment for Default / Legacy (no site)
		const postLegacy = await upsertPost(d1, "welcome", "Welcome Legacy", "https://legacy.com/welcome", null, null, "welcome");
		sqlite
			.prepare(
				`INSERT INTO comments (id, post_slug, parent_id, user_id, body_md, body_html,
				                       renderer_version, status, created_at, depth)
				 VALUES ('01COMM0000000000000000000L', ?, NULL, '01USER0000000000000000000L',
				         'Hello from Legacy', '<p>Hello from Legacy</p>', 1, 'approved', 1700000003000, 1)`,
			)
			.run(postLegacy.slug);

		// 1. GET /api/v1/comments with Site A Origin
		const resA = await app().request(
			"http://localhost/api/v1/comments?slug=welcome",
			{ headers: { Origin: "https://site-a.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(resA.status).toBe(200);
		const jsonA = (await resA.json()) as any;
		expect(jsonA.post.slug).toBe("welcome"); // clean slug without site prefix
		expect(jsonA.threads).toHaveLength(1);
		expect(jsonA.threads[0].body_html).toContain("Hello from Site A");

		// 2. GET /api/v1/comments with Site B Origin
		const resB = await app().request(
			"http://localhost/api/v1/comments?slug=welcome",
			{ headers: { Origin: "https://site-b.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(resB.status).toBe(200);
		const jsonB = (await resB.json()) as any;
		expect(jsonB.post.slug).toBe("welcome");
		expect(jsonB.threads).toHaveLength(1);
		expect(jsonB.threads[0].body_html).toContain("Hello from Site B");

		// 3. GET /api/v1/comments with no site Origin (Legacy)
		const resLegacy = await app().request(
			"http://localhost/api/v1/comments?slug=welcome",
			{},
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(resLegacy.status).toBe(200);
		const jsonLegacy = (await resLegacy.json()) as any;
		expect(jsonLegacy.post.slug).toBe("welcome");
		expect(jsonLegacy.threads).toHaveLength(1);
		expect(jsonLegacy.threads[0].body_html).toContain("Hello from Legacy");

		// 4. GET /api/v1/bootstrap with Site A Origin
		const bootA = await app().request(
			"http://localhost/api/v1/bootstrap?slug=welcome",
			{ headers: { Origin: "https://site-a.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(bootA.status).toBe(200);
		const bootJsonA = (await bootA.json()) as any;
		expect(bootJsonA.comments.post.slug).toBe("welcome");
		expect(bootJsonA.comments.threads).toHaveLength(1);
		expect(bootJsonA.comments.threads[0].body_html).toContain("Hello from Site A");

		// 5. GET /api/v1/counts with Site A vs Site B
		const countResA = await app().request(
			"http://localhost/api/v1/counts?slugs=welcome",
			{ headers: { Origin: "https://site-a.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(countResA.status).toBe(200);
		const countJsonA = (await countResA.json()) as any;
		expect(countJsonA.counts).toEqual({ welcome: 1 });

		// 6. Page engagement isolation
		const engagePostA = await app().request(
			"http://localhost/api/v1/page-engagement/reactions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://site-a.com",
					"cf-connecting-ip": "1.2.3.4",
				},
				body: JSON.stringify({ slug: "welcome", kind: "fire" }),
			},
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(engagePostA.status).toBe(200);

		// Site A should see the reaction
		const engageGetA = await app().request(
			"http://localhost/api/v1/page-engagement?slug=welcome",
			{ headers: { Origin: "https://site-a.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		const engageAJson = (await engageGetA.json()) as any;
		expect(engageAJson.reactions).toEqual({ fire: 1 });

		// Site B should NOT see the reaction
		const engageGetB = await app().request(
			"http://localhost/api/v1/page-engagement?slug=welcome",
			{ headers: { Origin: "https://site-b.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		const engageBJson = (await engageGetB.json()) as any;
		expect(engageBJson.reactions).toEqual({});

		// 7. Subscriptions cross-domain isolation
		const subPostA = await app().request(
			"http://localhost/api/v1/subscribe",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://site-a.com",
					"cf-connecting-ip": "1.2.3.4",
				},
				body: JSON.stringify({ post_slug: "welcome", email: "reader@example.com" }),
			},
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(subPostA.status).toBe(200);

		// Check /api/v1/bootstrap on Site A vs Site B
		const bootCheckA = await app().request(
			"http://localhost/api/v1/bootstrap?slug=welcome",
			{ headers: { Origin: "https://site-a.com" } },
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(bootCheckA.status).toBe(200);
	});

	it("enforces allow_anonymous = false on restricted sites", async () => {
		const restrictedSite = await createSite(env.DB, {
			domain: "restricted.david888.com",
			name: "Members Only",
			allow_anonymous: false,
		});
		clearSitesCache();

		const res = await app().request(
			"http://localhost/api/v1/comments",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://restricted.david888.com",
					"cf-connecting-ip": "1.2.3.4",
				},
				body: JSON.stringify({
					slug: "members-post",
					author_name: "Anonymous User",
					body: "Trying to post anonymously",
					turnstile_token: "dummy",
				}),
			},
			env as unknown as Record<string, unknown>,
			execCtx,
		);
		expect(res.status).toBe(401);
	});
});
