import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { corsAndCsrf, allowedPostUrl } from "../src/lib/cors";
import { clearSitesCache } from "../src/lib/sites";
import { asD1 } from "./helpers/d1";

describe("Dynamic CORS and Origin Authorization", () => {
	const registeredSites = [
		{
			id: "01NEWS",
			domain: "news2.david888.com",
			name: "888 快訊",
			description: null,
			default_locale: "zh-Hant",
			allow_anonymous: 1,
			auto_close_days: 0,
			created_at: 1000,
			updated_at: 1000,
		},
	];

	const db = asD1({
		prepare() {
			return {
				async all() {
					return { results: registeredSites };
				},
			};
		},
	});

	let app: Hono<{ Bindings: { DB: any; ALLOWED_ORIGINS?: string; ENV?: string } }>;

	beforeEach(() => {
		clearSitesCache();
		app = new Hono();
		app.use("/api/*", corsAndCsrf());
		app.get("/api/v1/ping", (c) => c.json({ ok: true }));
	});

	it("authorizes CORS preflight OPTIONS for registered site domain without ALLOWED_ORIGINS", async () => {
		const res = await app.request(
			"/api/v1/ping",
			{
				method: "OPTIONS",
				headers: {
					origin: "https://news2.david888.com",
					"access-control-request-method": "GET",
				},
			},
			{ DB: db, ALLOWED_ORIGINS: "https://static-only.com" },
		);

		expect(res.status).toBe(204);
		expect(res.headers.get("access-control-allow-origin")).toBe("https://news2.david888.com");
		expect(res.headers.get("access-control-allow-credentials")).toBe("true");
	});

	it("allows GET request with Origin from registered site", async () => {
		const res = await app.request(
			"/api/v1/ping",
			{
				method: "GET",
				headers: {
					origin: "https://news2.david888.com",
				},
			},
			{ DB: db, ALLOWED_ORIGINS: "https://static-only.com" },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(res.headers.get("access-control-allow-origin")).toBe("https://news2.david888.com");
	});

	it("rejects request from unregistered origin", async () => {
		const res = await app.request(
			"/api/v1/ping",
			{
				method: "GET",
				headers: {
					origin: "https://malicious.example.com",
				},
			},
			{ DB: db, ALLOWED_ORIGINS: "https://static-only.com" },
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "err.origin.forbidden" });
	});

	it("still respects static ALLOWED_ORIGINS even if not in DB", async () => {
		const res = await app.request(
			"/api/v1/ping",
			{
				method: "GET",
				headers: {
					origin: "https://static-only.com",
				},
			},
			{ DB: db, ALLOWED_ORIGINS: "https://static-only.com" },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it("allowedPostUrl accepts dynamic site domains", () => {
		const staticOnly = "https://static-only.com";
		expect(
			allowedPostUrl("https://news2.david888.com/article/1", staticOnly, [
				"news2.david888.com",
			]),
		).toBe("https://news2.david888.com/article/1");
		expect(
			allowedPostUrl("https://unregistered.com/article/1", staticOnly, [
				"news2.david888.com",
			]),
		).toBeNull();
	});
});
