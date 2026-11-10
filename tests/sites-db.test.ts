import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeD1 } from "./helpers/admin-sqlite";
import {
	createSite,
	getSiteById,
	getSiteByDomain,
	listSites,
	listSitesWithStats,
	updateSite,
	deleteSite,
	upsertPost,
	getPost,
	composePostSlug,
	decomposePostSlug,
	normalizeDomain,
} from "../src/db/queries";

const MIGRATIONS_DIR = join(__dirname, "../src/db/migrations");

describe("Sites Database & Post Scoping", () => {
	let db: any;
	let sqlite: DatabaseSync;

	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		for (const file of readdirSync(MIGRATIONS_DIR)
			.filter((f) => f.endsWith(".sql"))
			.sort()) {
			sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
		}
		db = makeD1(sqlite);
	});

	it("normalizes domains correctly", () => {
		expect(normalizeDomain("https://News2.David888.com/")).toBe("news2.david888.com");
		expect(normalizeDomain("http://blog.david888.com:8080/path")).toBe("blog.david888.com");
		expect(normalizeDomain("sub.domain.org")).toBe("sub.domain.org");
		expect(normalizeDomain("https://site-a.com:secret@attacker.com")).toBe("attacker.com");
		expect(normalizeDomain("http://[::1]:8080/")).toBe("[::1]");
	});

	it("creates and retrieves a site with normalized domain", async () => {
		const site = await createSite(db, {
			domain: "https://news2.david888.com/",
			name: "888 快訊",
			description: "即時新聞快訊",
			default_locale: "zh-Hant",
			allow_anonymous: true,
			auto_close_days: 30,
		});

		expect(site.id).toBeDefined();
		expect(site.domain).toBe("news2.david888.com");
		expect(site.name).toBe("888 快訊");
		expect(site.description).toBe("即時新聞快訊");
		expect(site.default_locale).toBe("zh-Hant");
		expect(site.allow_anonymous).toBe(true);
		expect(site.auto_close_days).toBe(30);

		const byId = await getSiteById(db, site.id);
		expect(byId).toEqual(site);

		const byDomain = await getSiteByDomain(db, "NEWS2.david888.com");
		expect(byDomain).toEqual(site);
	});

	it("rejects duplicate domain on creation", async () => {
		await createSite(db, {
			domain: "news2.david888.com",
			name: "Site 1",
		});

		await expect(
			createSite(db, {
				domain: "https://news2.david888.com",
				name: "Site 2",
			}),
		).rejects.toThrow();
	});

	it("lists sites and calculates stats", async () => {
		const s1 = await createSite(db, {
			domain: "site1.com",
			name: "Site 1",
		});
		const s2 = await createSite(db, {
			domain: "site2.com",
			name: "Site 2",
		});

		const list = await listSites(db);
		expect(list.length).toBe(2);
		expect(list.map((s) => s.id)).toEqual([s1.id, s2.id]);

		// Add posts to site1 and site2
		await upsertPost(db, "welcome", "Welcome Post", "https://site1.com/welcome", null, s1.id);
		await upsertPost(db, "welcome", "Welcome Post 2", "https://site2.com/welcome", null, s2.id);

		const withStats = await listSitesWithStats(db);
		expect(withStats.find((s) => s.id === s1.id)?.post_count).toBe(1);
		expect(withStats.find((s) => s.id === s2.id)?.post_count).toBe(1);
	});

	it("updates site fields", async () => {
		const site = await createSite(db, {
			domain: "old.david888.com",
			name: "Old Name",
			allow_anonymous: false,
		});

		const updated = await updateSite(db, site.id, {
			domain: "new.david888.com",
			name: "New Name",
			allow_anonymous: true,
			default_locale: "en",
		});

		expect(updated?.domain).toBe("new.david888.com");
		expect(updated?.name).toBe("New Name");
		expect(updated?.allow_anonymous).toBe(true);
		expect(updated?.default_locale).toBe("en");

		// Old domain should no longer resolve
		expect(await getSiteByDomain(db, "old.david888.com")).toBeNull();
		// New domain resolves
		expect(await getSiteByDomain(db, "new.david888.com")).not.toBeNull();
	});

	it("deletes a site", async () => {
		const site = await createSite(db, {
			domain: "delete-me.com",
			name: "To Delete",
		});

		const deleted = await deleteSite(db, site.id);
		expect(deleted).toBe(true);
		expect(await getSiteById(db, site.id)).toBeNull();

		const deleteAgain = await deleteSite(db, site.id);
		expect(deleteAgain).toBe(false);
	});

	it("handles post slug composing and decomposing", () => {
		expect(composePostSlug("site1", "hello")).toBe("site1::hello");
		expect(composePostSlug("site1", "site1::hello")).toBe("site1::hello");
		expect(composePostSlug(null, "hello")).toBe("hello");

		expect(decomposePostSlug("site1::hello")).toEqual({ siteId: "site1", rawSlug: "hello" });
		expect(decomposePostSlug("hello")).toEqual({ siteId: null, rawSlug: "hello" });
	});

	it("stores site-scoped posts with namespaced slugs and clean raw_slug", async () => {
		const site = await createSite(db, {
			domain: "news.david888.com",
			name: "News",
		});

		const post = await upsertPost(
			db,
			"about",
			"About Us",
			"https://news.david888.com/about",
			null,
			site.id,
		);

		expect(post.slug).toBe(`${site.id}::about`);
		expect(post.raw_slug).toBe("about");
		expect(post.site_id).toBe(site.id);

		// getPost by composite slug
		const retrieved1 = await getPost(db, `${site.id}::about`);
		expect(retrieved1?.raw_slug).toBe("about");
		expect(retrieved1?.site_id).toBe(site.id);

		// getPost by raw slug + siteId
		const retrieved2 = await getPost(db, "about", site.id);
		expect(retrieved2?.slug).toBe(`${site.id}::about`);
	});

	it("preserves legacy unassigned posts backwards compatibility", async () => {
		const post = await upsertPost(db, "legacy-slug", "Legacy Title", "https://example.com/legacy");
		expect(post.slug).toBe("legacy-slug");
		expect(post.raw_slug).toBe("legacy-slug");
		expect(post.site_id).toBeNull();

		const retrieved = await getPost(db, "legacy-slug");
		expect(retrieved?.slug).toBe("legacy-slug");
		expect(retrieved?.raw_slug).toBe("legacy-slug");
		expect(retrieved?.site_id).toBeNull();
	});

	it("adopts legacy post seamlessly when accessed under a registered site", async () => {
		// Legacy post created before site registration
		await upsertPost(db, "welcome", "Welcome Post", "https://news.david888.com/welcome");
		
		const site = await createSite(db, {
			domain: "news.david888.com",
			name: "News Site",
		});

		// getPost under this site adopts the legacy post
		const adopted = await getPost(db, "welcome", site.id);
		expect(adopted).not.toBeNull();
		expect(adopted?.slug).toBe(`${site.id}::welcome`);
		expect(adopted?.raw_slug).toBe("welcome");
		expect(adopted?.site_id).toBe(site.id);
		expect(adopted?.title).toBe("Welcome Post");

		// Future lookups find it under composite slug
		const direct = await getPost(db, `${site.id}::welcome`);
		expect(direct?.title).toBe("Welcome Post");
	});

	it("counts posts for a site correctly", async () => {
		const site = await createSite(db, { domain: "count.example.com", name: "Count Site" });
		expect(await (await import("../src/db/queries")).countPostsForSite(db, site.id)).toBe(0);

		await upsertPost(db, "post-1", "P1", null, null, site.id);
		await upsertPost(db, "post-2", "P2", null, null, site.id);
		expect(await (await import("../src/db/queries")).countPostsForSite(db, site.id)).toBe(2);
	});
});
