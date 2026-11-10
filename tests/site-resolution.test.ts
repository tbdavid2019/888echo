import { describe, it, expect, beforeEach } from "vitest";
import { resolveRequestSite, clearSitesCache } from "../src/lib/sites";
import { asD1 } from "./helpers/d1";

describe("Request Site Resolution", () => {
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
		{
			id: "01BLOG",
			domain: "blog.david888.com",
			name: "888 部落格",
			description: null,
			default_locale: "en",
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

	beforeEach(() => {
		clearSitesCache();
	});

	it("resolves site from Origin header", async () => {
		const req = {
			header: (name: string) => {
				if (name === "origin") return "https://news2.david888.com";
				return undefined;
			},
			query: () => undefined,
		};

		const site = await resolveRequestSite(req, db);
		expect(site).not.toBeNull();
		expect(site?.id).toBe("01NEWS");
		expect(site?.domain).toBe("news2.david888.com");
	});

	it("resolves site from Referer header when Origin is missing", async () => {
		const req = {
			header: (name: string) => {
				if (name === "referer") return "https://blog.david888.com/posts/article-1";
				return undefined;
			},
			query: () => undefined,
		};

		const site = await resolveRequestSite(req, db);
		expect(site).not.toBeNull();
		expect(site?.id).toBe("01BLOG");
	});

	it("resolves site from parent_origin query parameter (iframe mode)", async () => {
		const req = {
			header: () => undefined,
			query: (name: string) => {
				if (name === "parent_origin") return "https://news2.david888.com";
				return undefined;
			},
		};

		const site = await resolveRequestSite(req, db);
		expect(site?.id).toBe("01NEWS");
	});

	it("resolves site from site_id parameter or header", async () => {
		const req1 = {
			header: () => undefined,
			query: (name: string) => (name === "site_id" ? "01BLOG" : undefined),
		};
		expect((await resolveRequestSite(req1, db))?.id).toBe("01BLOG");

		const req2 = {
			header: (name: string) => (name === "x-888echo-site" ? "01NEWS" : undefined),
			query: () => undefined,
		};
		expect((await resolveRequestSite(req2, db))?.id).toBe("01NEWS");
	});

	it("returns null for unregistered domain", async () => {
		const req = {
			header: (name: string) => (name === "origin" ? "https://unregistered.com" : undefined),
			query: () => undefined,
		};

		const site = await resolveRequestSite(req, db);
		expect(site).toBeNull();
	});
});
