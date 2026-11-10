import { describe, it, expect } from "vitest";
import { layout } from "../src/admin-ui/layout";
import { getAdminLocale } from "../src/routes/admin";
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
});
