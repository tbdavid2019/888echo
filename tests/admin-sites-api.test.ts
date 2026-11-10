import { describe, it, expect } from "vitest";
import { ADMIN_SID, MOD_SID, adminHarness } from "./helpers/admin-sqlite";

describe("Admin Sites REST API & Console", () => {
	it("allows admin to create, list, update, and delete sites, recording audit log", async () => {
		const { request, sqlite } = adminHarness();

		// Create
		const resCreate = await request("/admin/api/sites", {
			method: "POST",
			body: {
				domain: "news2.david888.com",
				name: "888 快訊",
				description: "即時快訊",
				default_locale: "zh-Hant",
				allow_anonymous: true,
				auto_close_days: 14,
			},
			sid: ADMIN_SID,
		});
		expect(resCreate.status).toBe(201);
		const jsonCreate = (await resCreate.json()) as any;
		expect(jsonCreate.ok).toBe(true);
		expect(jsonCreate.site.id).toBeDefined();
		expect(jsonCreate.site.domain).toBe("news2.david888.com");
		const siteId = jsonCreate.site.id;

		// List
		const resList = await request("/admin/api/sites", { sid: ADMIN_SID });
		expect(resList.status).toBe(200);
		const jsonList = (await resList.json()) as any;
		expect(jsonList.ok).toBe(true);
		expect(jsonList.sites.length).toBe(1);
		expect(jsonList.sites[0].domain).toBe("news2.david888.com");

		// Reject duplicate domain
		const resDup = await request("/admin/api/sites", {
			method: "POST",
			body: {
				domain: "https://news2.david888.com/",
				name: "Duplicate",
			},
			sid: ADMIN_SID,
		});
		expect(resDup.status).toBe(409);

		// Update
		const resPatch = await request(`/admin/api/sites/${siteId}`, {
			method: "PATCH",
			body: {
				name: "888 即時快訊",
				allow_anonymous: false,
			},
			sid: ADMIN_SID,
		});
		expect(resPatch.status).toBe(200);
		const jsonPatch = (await resPatch.json()) as any;
		expect(jsonPatch.site.name).toBe("888 即時快訊");
		expect(jsonPatch.site.allow_anonymous).toBe(false);

		// Delete
		const resDel = await request(`/admin/api/sites/${siteId}`, {
			method: "DELETE",
			sid: ADMIN_SID,
		});
		expect(resDel.status).toBe(200);

		// Verify deletion
		const resListAfter = await request("/admin/api/sites", { sid: ADMIN_SID });
		const jsonListAfter = (await resListAfter.json()) as any;
		expect(jsonListAfter.sites.length).toBe(0);

		// Audit log checks
		const audits = sqlite
			.prepare("SELECT action, target_kind, target_id FROM audit_log ORDER BY rowid")
			.all() as any[];
		expect(audits.map((a) => a.action)).toEqual(["site.create", "site.update", "site.delete"]);
	});

	it("prevents deleting a site that has active posts", async () => {
		const { request, sqlite } = adminHarness();

		const resCreate = await request("/admin/api/sites", {
			method: "POST",
			body: {
				domain: "has-posts.com",
				name: "Active Site",
			},
			sid: ADMIN_SID,
		});
		const site = ((await resCreate.json()) as any).site;

		// Insert a post linked to this site
		sqlite
			.prepare("INSERT INTO posts (slug, title, url, created_at, site_id, raw_slug) VALUES (?, ?, ?, ?, ?, ?)")
			.run(`${site.id}::p1`, "Post 1", null, Date.now(), site.id, "p1");

		const resDel = await request(`/admin/api/sites/${site.id}`, {
			method: "DELETE",
			sid: ADMIN_SID,
		});
		expect(resDel.status).toBe(400);
		const jsonDel = (await resDel.json()) as any;
		expect(jsonDel.error).toBe("site_not_empty");
	});

	it("restricts site management from mod role", async () => {
		const { request } = adminHarness();

		const res = await request("/admin/api/sites", {
			method: "POST",
			body: {
				domain: "mod-fail.com",
				name: "Fail",
			},
			sid: MOD_SID,
		});
		expect(res.status).toBe(403);
	});

	it("renders /admin/sites HTML page in English and Traditional Chinese", async () => {
		const { request } = adminHarness();

		// Create a site first
		await request("/admin/api/sites", {
			method: "POST",
			body: {
				domain: "blog.david888.com",
				name: "888 部落格",
			},
			sid: ADMIN_SID,
		});

		const resEn = await request("/admin/sites", {
			headers: { accept: "text/html" },
			sid: ADMIN_SID,
		});

		expect(resEn.status).toBe(200);
		const htmlEn = await resEn.text();
		expect(htmlEn).toContain("blog.david888.com");
		expect(htmlEn).toContain("888 部落格");
		expect(htmlEn).toContain("Sites");

		// Chinese rendering
		const resZh = await request("/admin/sites", {
			headers: {
				accept: "text/html",
				cookie: `__Host-garrul_sess=${ADMIN_SID}; 888echo_admin_lang=zh-Hant`,
			},
			sid: ADMIN_SID,
		});
		const htmlZh = await resZh.text();
		expect(htmlZh).toContain("站台管理");
	});
});
