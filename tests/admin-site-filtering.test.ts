import { describe, it, expect } from "vitest";
import { adminHarness, ADMIN_ID, ADMIN_SID } from "./helpers/admin-sqlite";

describe("Admin Site-Scoped Dashboard and Queue Filtering", () => {
	it("filters moderation queue and dashboard stats by active site cookie", async () => {
		const { request, sqlite } = adminHarness();

		// Create sites: site_a, site_b
		sqlite
			.prepare(
				`INSERT INTO sites (id, domain, name, created_at, updated_at)
				 VALUES ('site_a', 'site-a.com', 'Site A', 1000, 1000),
				        ('site_b', 'site-b.com', 'Site B', 2000, 2000)`,
			)
			.run();

		// Create posts for site_a and site_b
		sqlite
			.prepare(
				`INSERT INTO posts (slug, title, url, site_id, raw_slug, created_at)
				 VALUES ('site_a::post1', 'Post A1', 'https://site-a.com/post1', 'site_a', 'post1', 1000),
				        ('site_b::post2', 'Post B2', 'https://site-b.com/post2', 'site_b', 'post2', 2000)`,
			)
			.run();

		// Create comments:
		// 1. Approved on site_a
		// 2. Pending on site_a
		// 3. Approved on site_b
		// 4. Pending on site_b
		sqlite
			.prepare(
				`INSERT INTO comments (id, post_slug, parent_id, user_id, body_md, body_html, renderer_version, status, created_at, depth)
				 VALUES ('c_a1', 'site_a::post1', NULL, ?, 'Site A Comment 1', '<p>Site A Comment 1</p>', 1, 'approved', 1100, 1),
				        ('c_a2', 'site_a::post1', NULL, ?, 'Site A Comment 2', '<p>Site A Comment 2</p>', 1, 'pending', 1200, 1),
				        ('c_b1', 'site_b::post2', NULL, ?, 'Site B Comment 1', '<p>Site B Comment 1</p>', 1, 'approved', 2100, 1),
				        ('c_b2', 'site_b::post2', NULL, ?, 'Site B Comment 2', '<p>Site B Comment 2</p>', 1, 'pending', 2200, 1)`,
			)
			.run(ADMIN_ID, ADMIN_ID, ADMIN_ID, ADMIN_ID);

		// 1. Default (All Sites): queue shows all comments
		const resAll = await request("/admin/queue?status=all");
		expect(resAll.status).toBe(200);
		const htmlAll = await resAll.text();
		expect(htmlAll).toContain("c_a1");
		expect(htmlAll).toContain("c_a2");
		expect(htmlAll).toContain("c_b1");
		expect(htmlAll).toContain("c_b2");
		expect(htmlAll).toContain("Site A");
		expect(htmlAll).toContain("Site B");

		// 2. Active Site = site_a: queue only shows comments from site_a
		const resSiteA = await request("/admin/queue?status=all", {
			headers: {
				cookie: `__Host-garrul_sess=${ADMIN_SID}; 888echo_active_site=site_a`,
			},
		});
		expect(resSiteA.status).toBe(200);
		const htmlSiteA = await resSiteA.text();
		expect(htmlSiteA).toContain("c_a1");
		expect(htmlSiteA).toContain("c_a2");
		expect(htmlSiteA).not.toContain("c_b1");
		expect(htmlSiteA).not.toContain("c_b2");
		expect(htmlSiteA).toContain("Site A");

		// 3. Active Site = site_b: queue only shows comments from site_b
		const resSiteB = await request("/admin/queue?status=all", {
			headers: {
				cookie: `__Host-garrul_sess=${ADMIN_SID}; 888echo_active_site=site_b`,
			},
		});
		expect(resSiteB.status).toBe(200);
		const htmlSiteB = await resSiteB.text();
		expect(htmlSiteB).not.toContain("c_a1");
		expect(htmlSiteB).not.toContain("c_a2");
		expect(htmlSiteB).toContain("c_b1");
		expect(htmlSiteB).toContain("c_b2");
		expect(htmlSiteB).toContain("Site B");

		// 4. Test POST /admin/set-site switcher
		const setSiteRes = await request("/admin/set-site", {
			method: "POST",
			body: { site_id: "site_a", return_to: "/admin/queue" },
		});
		expect(setSiteRes.status).toBe(302);
		expect(setSiteRes.headers.get("location")).toBe("/admin/queue");
		const setCookie = setSiteRes.headers.get("set-cookie");
		expect(setCookie).toContain("888echo_active_site=site_a");

		// 5. Test clearing active site
		const clearSiteRes = await request("/admin/set-site", {
			method: "POST",
			body: { site_id: "", return_to: "/admin/queue" },
		});
		expect(clearSiteRes.status).toBe(302);
		const clearCookie = clearSiteRes.headers.get("set-cookie");
		expect(clearCookie).toContain("Max-Age=0");

		// 6. Test GET /admin/set-site switcher
		const getSetSiteRes = await request("/admin/set-site?site_id=site_b&return_to=%2Fadmin%2Fqueue");
		expect(getSetSiteRes.status).toBe(302);
		expect(getSetSiteRes.headers.get("location")).toBe("/admin/queue");
		expect(getSetSiteRes.headers.get("set-cookie")).toContain("888echo_active_site=site_b");
	});
});
