import { describe, it, expect } from "vitest";
import { layout } from "../src/admin-ui/layout";
import { getAdminLocale } from "../src/routes/admin";
import { renderDashboard } from "../src/admin-ui/pages/dashboard";
import { renderOperator } from "../src/admin-ui/pages/operator";
import type { User } from "../src/db/queries";

const makeUser = (role: "admin" | "mod"): User => ({
	id: "01USER000000000000000000001",
	provider: "github",
	provider_id: "1",
	email: "admin@example.com",
	name: "Admin User",
	avatar_url: null,
	role,
	is_admin: role === "admin",
	is_banned: false,
	erased_at: null,
	created_at: 1700000000,
});

describe("Admin UI multi-language switcher", () => {
	it("renders Traditional Chinese navigation when locale is zh-Hant", () => {
		const admin = makeUser("admin");
		const html = layout("儀表板", "<p>內容</p>", admin, null, {
			locale: "zh-Hant",
			activePath: "/admin",
		});

		// Section headings in Traditional Chinese
		expect(html).toContain("內容審核");
		expect(html).toContain("營運管理");
		expect(html).toContain("整合服務");
		expect(html).toContain("系統維運");
		expect(html).toContain("說明與支援");

		// Nav link labels in Traditional Chinese
		expect(html).toContain("控制台");
		expect(html).toContain("審核佇列");
		expect(html).toContain("使用者");
		expect(html).toContain("系統設定");
		expect(html).toContain("關於 888echo");

		// Language switch toggle button to switch back to English
		expect(html).toContain("/admin/set-lang?lang=en");
		expect(html).toContain("切換為 English");
	});

	it("renders English navigation when locale is en", () => {
		const admin = makeUser("admin");
		const html = layout("Dashboard", "<p>content</p>", admin, null, {
			locale: "en",
			activePath: "/admin",
		});

		// Section headings in English
		expect(html).toContain("Moderation");
		expect(html).toContain("Manage");
		expect(html).toContain("Integrations");
		expect(html).toContain("System");
		expect(html).toContain("Help");

		// Nav link labels in English
		expect(html).toContain("Dashboard");
		expect(html).toContain("Queue");
		expect(html).toContain("Users");
		expect(html).toContain("Settings");
		expect(html).toContain("About");

		// Language switch toggle button to switch to Traditional Chinese
		expect(html).toContain("/admin/set-lang?lang=zh-Hant");
		expect(html).toContain("切換為繁體中文");
	});

	it("resolves admin locale from query param, cookie, and accept-language header", () => {
		const makeCtx = (query: Record<string, string>, cookie = "", accept = "") =>
			({
				req: {
					query: (k: string) => query[k],
					header: (name: string) =>
						name === "cookie" ? cookie : name === "accept-language" ? accept : undefined,
				},
			}) as any;

		// 1. Query parameter takes precedence
		expect(getAdminLocale(makeCtx({ lang: "zh-Hant" }, "888echo_admin_lang=en"))).toBe("zh-Hant");
		expect(getAdminLocale(makeCtx({ lang: "en" }, "888echo_admin_lang=zh-Hant"))).toBe("en");

		// 2. Cookie takes second precedence
		expect(getAdminLocale(makeCtx({}, "888echo_admin_lang=zh-Hant"))).toBe("zh-Hant");
		expect(getAdminLocale(makeCtx({}, "888echo_admin_lang=en", "zh-TW,zh;q=0.9"))).toBe("en");

		// 3. Accept-Language header fallback
		expect(getAdminLocale(makeCtx({}, "", "zh-TW,zh;q=0.9,en-US;q=0.8"))).toBe("zh-Hant");
		expect(getAdminLocale(makeCtx({}, "", "en-US,en;q=0.9"))).toBe("en");

		// 4. Default fallback is en
		expect(getAdminLocale(makeCtx({}))).toBe("en");
	});

	it("renders Dashboard and Operator pages in thorough Traditional Chinese when isZh=true", () => {
		const stats = {
			total_comments: 5,
			pending_comments: 0,
			spam_comments: 0,
			total_users: 2,
			banned_users: 0,
		};
		const dashHtml = renderDashboard(
			{
				stats,
				timeline: [],
				top_posts: [],
				top_commenters: [],
				oldest_pending: null,
				spam_rate: { total: 0, spam: 0 },
				by_host: [],
			},
			{} as any,
			{} as any,
			{} as any,
			true, // isZh
		);

		expect(dashHtml).toContain("總覽概況");
		expect(dashHtml).toContain("留言總數");
		expect(dashHtml).toContain("待審核");
		expect(dashHtml).toContain("垃圾訊息");
		expect(dashHtml).toContain("嵌入至您的網站");
		expect(dashHtml).toContain("每日留言趨勢 (過去 30 天)");
		expect(dashHtml).toContain("快捷操作");
		expect(dashHtml).toContain("各網域留言分佈");

		const opHtml = renderOperator(
			{
				rerender: { current_version: 3, up_to_date: 5, stale: 0, oldest_version: null },
				retention: { enabled: false, retention_days: 0, comments_total: 5, ghosts_total: 10, comments_pending: 0, reports_pending: 0 },
				audit_retention: { enabled: false, retention_days: 0, total: 3, oldest: 1762700000000, pending: 0 },
				seed_demo_allowed: false,
			},
			true, // isZh
		);

		expect(opHtml).toContain("重新渲染留言");
		expect(opHtml).toContain("IP 雜湊保留政策");
		expect(opHtml).toContain("稽核日誌保留政策");
		expect(opHtml).toContain("匯出站台資料");
		expect(opHtml).toContain("下載 JSON 備份");
		expect(opHtml).toContain("下載 CSV 檔案");
	});
});
