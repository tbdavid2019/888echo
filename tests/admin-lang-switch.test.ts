import { describe, it, expect } from "vitest";
import { layout } from "../src/admin-ui/layout";
import { getAdminLocale } from "../src/routes/admin";
import { renderDashboard } from "../src/admin-ui/pages/dashboard";
import { renderOperator } from "../src/admin-ui/pages/operator";
import { renderSettings } from "../src/admin-ui/pages/settings";
import { renderTelegram } from "../src/admin-ui/pages/telegram";
import { renderWebhooksList, renderWebhookForm } from "../src/admin-ui/pages/webhooks";
import { renderCommentDetail } from "../src/admin-ui/pages/comment-detail";
import { renderUserDetail } from "../src/admin-ui/pages/user-detail";
import {
	renderUsageDashboard,
	renderUsageSetup,
	renderUsageTokenError,
} from "../src/admin-ui/pages/usage";
import type { User } from "../src/db/queries";

const makeUser = (role: "admin" | "mod" | "user", id = "01USER000000000000000000001"): User => ({
	id,
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

	it("renders Settings page in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const env = {} as any;
		const flags = {
			comments_enabled: true,
			comment_email_confirmation_enabled: false,
			oauth_login_enabled: false,
			reactions_enabled: true,
			votes_enabled: true,
			downvotes_enabled: true,
			page_reactions_enabled: false,
			page_votes_enabled: false,
			show_deleted_placeholders: true,
			spam_first_comment_moderate: false,
			turnstile_always: false,
			turnstile_enabled: true,
			moderator_email_enabled: false,
		} as any;
		const numbers = {
			comments_per_page: 25,
			replies_per_thread: 3,
			auto_collapse_depth: 4,
			edit_window_minutes: 15,
			auto_close_days: 0,
			community_min_votes: 5,
			community_collapse_ratio: 60,
			ip_hash_retention_days: 0,
			audit_log_retention_days: 0,
			confirm_send_burst_max: 10,
			confirm_send_daily_max: 200,
			spam_link_threshold: 3,
			spam_honeypot_min_ms: 3000,
			spam_ai_threshold: 80,
			auto_close_at: 0,
		} as any;
		const strings = {
			default_locale: "auto",
			default_sort: "new",
		} as any;
		const texts = {
			spam_blocklist: "",
			reserved_names: "",
			security_contact: "",
			staff_badge_label: "",
			comment_reaction_kinds: "fire,love,wow",
			page_reaction_kinds: "fire,love,wow",
		} as any;

		// 1. Traditional Chinese render
		const zhHtml = renderSettings(env, flags, numbers, strings, texts, true);
		expect(zhHtml).toContain("功能特性");
		expect(zhHtml).toContain("顯示與分頁");
		expect(zhHtml).toContain("審核與防護");
		expect(zhHtml).toContain("環境變數配置");
		expect(zhHtml).toContain("功能特性開關");
		expect(zhHtml).toContain("留言功能");
		expect(zhHtml).toContain("OAuth 第三方登入");
		expect(zhHtml).toContain("表情符號反應 (留言)");
		expect(zhHtml).toContain("投票評分 (留言)");
		expect(zhHtml).toContain("反對票 (噓)");
		expect(zhHtml).toContain("每頁留言數");
		expect(zhHtml).toContain("預設語系");
		expect(zhHtml).toContain("預設排序");
		expect(zhHtml).toContain("最新優先");
		expect(zhHtml).toContain("敏感詞 / 屏蔽詞清單");
		expect(zhHtml).toContain("保留名稱清單");
		expect(zhHtml).toContain("儲存設定");
		expect(zhHtml).toContain("重設為預設值");
		expect(zhHtml).toContain("部署環境變數 (唯讀)");

		// 2. English render
		const enHtml = renderSettings(env, flags, numbers, strings, texts, false);
		expect(enHtml).toContain("Features");
		expect(enHtml).toContain("Display");
		expect(enHtml).toContain("Moderation");
		expect(enHtml).toContain("Configuration");
		expect(enHtml).toContain("OAuth sign-in");
		expect(enHtml).toContain("Comments per page");
		expect(enHtml).toContain("Default order");
		expect(enHtml).toContain("Save settings");
		expect(enHtml).toContain("Reset to defaults");
	});

	it("renders Telegram page in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const data = {
			configured: true,
			webhookSecretSet: true,
			botUsername: "echo888_bot",
			link: { linked_at: 1700000000000, digest: true },
		};

		// 1. Traditional Chinese
		const zhHtml = renderTelegram(data, true);
		expect(zhHtml).toContain("機器人配置狀態");
		expect(zhHtml).toContain("您的已連動帳號");
		expect(zhHtml).toContain("每日發送維運摘要通知給我");
		expect(zhHtml).toContain("解除 Telegram 連動");
		expect(zhHtml).toContain("已設定");

		// 2. English
		const enHtml = renderTelegram(data, false);
		expect(enHtml).toContain("Bot configuration");
		expect(enHtml).toContain("Your linked account");
		expect(enHtml).toContain("Send me the daily operator digest");
		expect(enHtml).toContain("Unlink Telegram");
		expect(enHtml).toContain("set");
	});

	it("renders Webhooks pages in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const endpoints = [
			{
				id: "01WEBHOOK00000000000000001",
				url: "https://example.com/webhook",
				events: ["comment.posted"],
				adapter: "generic" as const,
				enabled: true,
				created_at: 1700000000000,
				updated_at: 1700000000000,
				secret: "sec123",
				disabled_at: null,
				fail_count: 0,
			},
		];
		const envShim = { active: false, url: "" };

		// 1. List - Traditional Chinese
		const zhList = renderWebhooksList(endpoints, envShim, true);
		expect(zhList).toContain("Webhook 端點清單");
		expect(zhList).toContain("+ 新增端點");
		expect(zhList).toContain("已簽章");
		expect(zhList).toContain("已啟用");
		expect(zhList).toContain("編輯");
		expect(zhList).toContain("刪除");

		// 2. List - English
		const enList = renderWebhooksList(endpoints, envShim, false);
		expect(enList).toContain("Webhook endpoints");
		expect(enList).toContain("+ Add endpoint");
		expect(enList).toContain("signed");
		expect(enList).toContain("enabled");
		expect(enList).toContain("Edit");
		expect(enList).toContain("Delete");

		// 3. Form - Traditional Chinese
		const zhForm = renderWebhookForm({ endpoint: null, error: null }, true);
		expect(zhForm).toContain("新增 Webhook 端點");
		expect(zhForm).toContain("建立端點");
		expect(zhForm).toContain("適配器 (Adapter)");
		expect(zhForm).toContain("通用 JSON (v1 協定)");
		expect(zhForm).toContain("← 返回 Webhook 清單");

		// 4. Form - English
		const enForm = renderWebhookForm({ endpoint: null, error: null }, false);
		expect(enForm).toContain("Add webhook endpoint");
		expect(enForm).toContain("Create endpoint");
		expect(enForm).toContain("Adapter");
		expect(enForm).toContain("Generic JSON (v1 contract)");
		expect(enForm).toContain("← back to webhooks");
	});

	it("renders Comment Detail in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const detail = {
			comment: {
				id: "01COMMENT000000000000000001",
				post_slug: "test-slug",
				user_id: "01USER000000000000000000001",
				author_name: "Alice",
				author_avatar_url: null,
				author_provider: "anon",
				author_is_admin: false,
				author_is_banned: false,
				status: "pending",
				body_html: "<p>Nice post!</p>",
				body_md: "Nice post!",
				created_at: 1700000000000,
				parent_id: null,
				pinned_at: null,
				reply_count: 0,
			} as any,
			parent: null,
			replies: [],
			ip_siblings: [],
			user_recent: [],
			verdicts: [],
			reports: [],
			audit: [],
		};

		// 1. Traditional Chinese
		const zhHtml = renderCommentDetail(detail, true, "Mod", [], "mod1", true);
		expect(zhHtml).toContain("← 返回審核佇列");
		expect(zhHtml).toContain("留言詳細資料");
		expect(zhHtml).toContain("核准");
		expect(zhHtml).toContain("標記為垃圾");
		expect(zhHtml).toContain("刪除");
		expect(zhHtml).toContain("封鎖作者");
		expect(zhHtml).toContain("原始 Markdown 內容");
		expect(zhHtml).toContain("待審核");

		// 2. English
		const enHtml = renderCommentDetail(detail, true, "Mod", [], "mod1", false);
		expect(enHtml).toContain("← back to queue");
		expect(enHtml).toContain("Comment");
		expect(enHtml).toContain("Approve");
		expect(enHtml).toContain("Spam");
		expect(enHtml).toContain("Delete");
		expect(enHtml).toContain("Ban author");
		expect(enHtml).toContain("Raw markdown");
		expect(enHtml).toContain("pending");
	});

	it("renders User Detail in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const detail = {
			user: makeUser("user", "01USER000000000000000000002"),
			comments: [],
			next_cursor: null,
			reactions_received: 15,
			audit: [],
		};
		const admin = makeUser("admin");

		// 1. Traditional Chinese
		const zhHtml = renderUserDetail(detail, admin, [], true);
		expect(zhHtml).toContain("← 返回使用者清單");
		expect(zhHtml).toContain("封鎖");
		expect(zhHtml).toContain("匯出個人資料 (JSON)…");
		expect(zhHtml).toContain("抹除個人資料 (GDPR 刪除權)…");
		expect(zhHtml).toContain("獲得表情反應總數：");
		expect(zhHtml).toContain("尚無任何留言。");

		// 2. English
		const enHtml = renderUserDetail(detail, admin, [], false);
		expect(enHtml).toContain("← back to users");
		expect(enHtml).toContain("Ban");
		expect(enHtml).toContain("Export personal data…");
		expect(enHtml).toContain("Erase personal data…");
		expect(enHtml).toContain("Reactions received:");
		expect(enHtml).toContain("No comments yet.");
	});

	it("renders Usage Dashboard in Traditional Chinese when isZh=true and English when isZh=false", () => {
		const snapshot = {
			asOf: 1700000000000,
			workers: { ok: true, data: { today: 1500, last30d: 45000 } } as any,
			d1: { ok: true, data: { reads_today: 12000, writes_today: 450, storage_bytes: null } } as any,
			kv: { ok: true, data: { reads_today: 3400, writes_today: 120, storage_bytes: null } } as any,
			ai: { ok: true, data: { neurons_today: 500, inferences_today: 125 } } as any,
		};
		const byHost = [{ host: "test.example.com", total: 100, spam: 2, pending: 0 }];

		// 1. Traditional Chinese
		const zhDash = renderUsageDashboard(snapshot, byHost, true);
		expect(zhDash).toContain("Cloudflare 資源用量統計");
		expect(zhDash).toContain("Workers 請求數");
		expect(zhDash).toContain("今日");
		expect(zhDash).toContain("D1 資料庫");
		expect(zhDash).toContain("KV 命名空間");
		expect(zhDash).toContain("Workers AI 神經元");
		expect(zhDash).toContain("各網域留言分佈");

		const zhSetup = renderUsageSetup(byHost, true);
		expect(zhSetup).toContain("Cloudflare 資源用量 — 尚未配置");
		expect(zhSetup).toContain("配置步驟");

		const zhErr = renderUsageTokenError("invalid_token", byHost, true);
		expect(zhErr).toContain("Cloudflare 資源用量 — Token 驗證錯誤");

		// 2. English
		const enDash = renderUsageDashboard(snapshot, byHost, false);
		expect(enDash).toContain("Cloudflare usage");
		expect(enDash).toContain("Workers requests");
		expect(enDash).toContain("Today");
		expect(enDash).toContain("D1 database");
		expect(enDash).toContain("KV namespaces");
		expect(enDash).toContain("Workers AI");
		expect(enDash).toContain("Comments by domain");

		const enSetup = renderUsageSetup(byHost, false);
		expect(enSetup).toContain("Cloudflare usage — not configured");
		expect(enSetup).toContain("Setup");

		const enErr = renderUsageTokenError("invalid_token", byHost, false);
		expect(enErr).toContain("Cloudflare usage — token error");
	});
});
