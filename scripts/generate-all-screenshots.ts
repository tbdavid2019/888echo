import { layout } from "../src/admin-ui/layout";
import { renderDashboard } from "../src/admin-ui/pages/dashboard";
import { renderSitesPage } from "../src/admin-ui/pages/sites";
import { renderSettings } from "../src/admin-ui/pages/settings";
import { renderQueue } from "../src/admin-ui/pages/queue";
import { renderUsers } from "../src/admin-ui/pages/users";
import { renderAudit } from "../src/admin-ui/pages/audit";
import { renderWebhooksList } from "../src/admin-ui/pages/webhooks";
import { renderSavedRepliesList } from "../src/admin-ui/pages/saved-replies";
import { renderSubscriptions } from "../src/admin-ui/pages/subscriptions";
import { renderOperator } from "../src/admin-ui/pages/operator";
import { renderCommentDetail } from "../src/admin-ui/pages/comment-detail";
import { loadSettings } from "../src/lib/settings";
import { zhHant } from "../src/i18n/widget/zh-Hant";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = path.resolve(process.cwd(), "docs/screenshots");

const SITES = [
	{
		id: "01JSITE0000000000000000001",
		domain: "blog.david888.com",
		name: "888 官方部落格",
		description: "David888 官方部落格文章與最新思維分享",
		allow_anonymous: true,
		default_locale: "zh-Hant",
		auto_close_days: 0,
		post_count: 5,
		comment_count: 48,
		created_at: Date.now() - 86400000 * 14,
		updated_at: Date.now() - 86400000 * 14,
	},
	{
		id: "01JSITE0000000000000000002",
		domain: "news2.david888.com",
		name: "888 即時快訊",
		description: "David888 即時新聞與全球重點快訊",
		allow_anonymous: true,
		default_locale: "zh-Hant",
		auto_close_days: 0,
		post_count: 3,
		comment_count: 26,
		created_at: Date.now() - 86400000 * 10,
		updated_at: Date.now() - 86400000 * 10,
	},
	{
		id: "01JSITE0000000000000000003",
		domain: "podcast.david888.com",
		name: "888 播客電台",
		description: "David888 播客與音訊節目專區",
		allow_anonymous: true,
		default_locale: "zh-Hant",
		auto_close_days: 0,
		post_count: 2,
		comment_count: 14,
		created_at: Date.now() - 86400000 * 7,
		updated_at: Date.now() - 86400000 * 7,
	},
];

const USER = {
	id: "01JADMIN000000000000000001",
	name: "David",
	role: "admin",
	provider: "passkey",
	email: "david@david888.com",
};

const capture = (htmlPath: string, pngPath: string, width = 1280, height = 900) => {
	console.log(`[screenshot] Capturing ${path.basename(pngPath)} (${width}x${height})...`);
	execFileSync(
		CHROME,
		[
			"--headless",
			"--disable-gpu",
			"--allow-file-access-from-files",
			`--window-size=${width},${height}`,
			"--virtual-time-budget=3000",
			`--screenshot=${pngPath}`,
			`file://${htmlPath}`,
		],
		{ stdio: "ignore" },
	);
};

// 1. Dashboard
const genDashboard = () => {
	const data = {
		stats: { total_comments: 88, pending_comments: 0, spam_comments: 2, total_users: 28, banned_users: 0 },
		timeline: Array.from({ length: 30 }, (_, i) => ({
			day: `2026-10-${String(i + 1).padStart(2, "0")}`,
			count: ((i * 7 + 13) % 19) + 2,
		})),
		top_posts: [
			{ slug: "welcome", title: "888 官方部落格：邁向主權邊緣 AI 架構新紀元", comment_count: 32 },
			{ slug: "news-roundup", title: "888 即時快訊：全球開源與邊緣算力最新進展", comment_count: 24 },
			{ slug: "podcast-ep1", title: "888 播客電台 EP.01 探討新一代自主代理開發流程", comment_count: 18 },
			{ slug: "passkey-guide", title: "全站啟用 Passkey 生物辨識無密碼登入指南", comment_count: 14 },
		],
		top_commenters: [
			{ user_id: "u1", name: "David (維護者)", avatar_url: null, comment_count: 28 },
			{ user_id: "u2", name: "林小明", avatar_url: null, comment_count: 15 },
			{ user_id: "u3", name: "Sarah Chen", avatar_url: null, comment_count: 12 },
			{ user_id: "u4", name: "Alex Wang", avatar_url: null, comment_count: 9 },
		],
		oldest_pending: null,
		spam_rate: { spam: 2, total: 88 },
		by_host: [
			{ host: "blog.david888.com", total: 48, pending: 0, spam: 1 },
			{ host: "news2.david888.com", total: 26, pending: 0, spam: 1 },
			{ host: "podcast.david888.com", total: 14, pending: 0, spam: 0 },
		],
	};

	const env = { PUBLIC_BASE_URL: "https://garrul.ai360.workers.dev" };
	const flags = { comments_enabled: true, votes_enabled: true, reactions_enabled: true };
	const numbers = { comments_per_page: 25 };

	const body = renderDashboard(data as any, env as any, flags as any, numbers as any, true);
	const html = layout("控制台", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activeSiteId: "01JSITE0000000000000000001",
		activePath: "/admin",
	});

	const tmp = "/tmp/888echo-dashboard.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-dashboard.png"), 1320, 960);
};

// 2. Multi-Site Management
const genSites = () => {
	const body = renderSitesPage({ sites: SITES, isZh: true });
	const html = layout("站台管理", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activeSiteId: null,
		activePath: "/admin/sites",
	});

	const tmp = "/tmp/888echo-sites.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-sites.png"), 1320, 850);
};

// 3. Settings
const genSettings = async () => {
	const env = {
		ENV: "production",
		PUBLIC_BASE_URL: "https://garrul.ai360.workers.dev",
		ALLOWED_ORIGINS: "https://blog.david888.com,https://news2.david888.com,https://podcast.david888.com",
		ADMIN_EMAILS: "david@david888.com",
		DB: { prepare: () => ({ all: async () => ({ results: [] }) }) },
	};
	const resolved = await loadSettings(env as any);
	resolved.flags.comments_enabled = true;
	resolved.flags.votes_enabled = true;
	resolved.flags.downvotes_enabled = true;
	resolved.flags.reactions_enabled = true;
	resolved.flags.page_reactions_enabled = true;
	resolved.flags.page_votes_enabled = true;
	resolved.flags.show_deleted_placeholders = true;
	resolved.strings.default_locale = "zh-Hant";
	resolved.strings.default_sort = "top";
	resolved.texts.staff_badge_label = "官方維護者";
	resolved.texts.spam_blocklist = "casino\nviagra\ncrypto-giveaway";

	const body = renderSettings(env as any, resolved.flags, resolved.numbers, resolved.strings, resolved.texts, true);
	const html = layout("系統設定", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activeSiteId: null,
		activePath: "/admin/settings",
	});

	const tmp = "/tmp/888echo-settings.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-settings.png"), 1320, 960);
};

// 4. Moderation Queue (Pending, Approved, Spam, Reported)
const genQueue = (status: "pending" | "approved" | "spam" | "reported", filename: string) => {
	const comments = [
		{
			id: "01JCMN00000000000000000001",
			post_id: "01JPOST00000000000000000001",
			post_slug: "welcome",
			parent_id: null,
			user_id: "01JUSER00000000000000000001",
			body_html: status === "spam" ? "<p>點擊立即領取免費加密貨幣：http://spam-link.example</p>" : "<p>請問 888echo 是否支援多網域的 SSO 登入整合？架構看起來非常完整乾淨！</p>",
			body_raw: status === "spam" ? "點擊立即領取免費加密貨幣：http://spam-link.example" : "請問 888echo 是否支援多網域的 SSO 登入整合？架構看起來非常完整乾淨！",
			status: status === "reported" ? "approved" : status,
			created_at: Date.now() - 3600000 * 3,
			edited_at: null,
			deleted_at: null,
			author_name: status === "spam" ? "SpamBot" : "Alex Wang",
			author_email: status === "spam" ? "bot@spam.com" : "alex@example.com",
			author_provider: status === "spam" ? "anon" : "github",
			author_avatar_url: null,
			author_is_admin: 0,
			author_is_mod: 0,
			author_is_banned: status === "spam" ? 1 : 0,
			author_comment_count: 5,
			author_pending_count: 0,
			author_spam_count: status === "spam" ? 1 : 0,
			score_up: 3,
			score_down: 0,
			reply_count: 1,
			is_pinned: 0,
			post_title: "888 官方部落格：邁向主權邊緣 AI 架構新紀元",
			post_url: "https://blog.david888.com/welcome",
		},
		{
			id: "01JCMN00000000000000000002",
			post_id: "01JPOST00000000000000000001",
			post_slug: "welcome",
			parent_id: "01JCMN00000000000000000001",
			user_id: "01JUSER00000000000000000002",
			body_html: "<p>我們團隊正在評估從 Disqus 遷移至 888echo，匯入功能運作良好，太棒了！</p>",
			body_raw: "我們團隊正在評估從 Disqus 遷移至 888echo，匯入功能運作良好，太棒了！",
			status: status === "reported" ? "approved" : status,
			created_at: Date.now() - 3600000 * 2,
			edited_at: null,
			deleted_at: null,
			author_name: "Sarah Chen",
			author_email: "sarah@example.com",
			author_provider: "google",
			author_avatar_url: null,
			author_is_admin: 0,
			author_is_mod: 0,
			author_is_banned: 0,
			author_comment_count: 8,
			author_pending_count: 0,
			author_spam_count: 0,
			score_up: 5,
			score_down: 0,
			reply_count: 0,
			is_pinned: 0,
			post_title: "888 官方部落格：邁向主權邊緣 AI 架構新紀元",
			post_url: "https://blog.david888.com/welcome",
		},
	];

	const reportCounts: Record<string, number> = status === "reported" ? { "01JCMN00000000000000000001": 2 } : {};
	const reportReasons: Record<string, string[]> = status === "reported" ? { "01JCMN00000000000000000001": ["可疑連結或宣傳"] } : {};
	const noteCounts = { comment: {}, user: {} };

	const body = renderQueue(
		comments as any,
		{ status, q: "", post_slug: "", user_id: "", host: "", reported: status === "reported" } as any,
		null,
		new Map(),
		["blog.david888.com", "news2.david888.com", "podcast.david888.com"],
		null,
		reportCounts,
		"David",
		noteCounts,
		true,
	);
	const html = layout("審核佇列", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activeSiteId: null,
		activePath: "/admin/queue",
	});

	const tmp = `/tmp/888echo-queue-${status}.html`;
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, filename), 1320, 960);
};

// 5. Comment Detail
const genCommentDetail = () => {
	const comment = {
		id: "01JCMN00000000000000000001",
		post_id: "01JPOST00000000000000000001",
		post_slug: "welcome",
		parent_id: null,
		user_id: "01JUSER00000000000000000001",
		body_html: "<p>請問 888echo 是否支援多網域的 SSO 登入整合？架構看起來非常完整乾淨！</p>",
		body_raw: "請問 888echo 是否支援多網域的 SSO 登入整合？架構看起來非常完整乾淨！",
		status: "approved",
		created_at: Date.now() - 3600000 * 3,
		edited_at: null,
		deleted_at: null,
		author_name: "Alex Wang",
		author_email: "alex@example.com",
		author_provider: "github",
		author_avatar_url: null,
		author_is_admin: 0,
		author_is_mod: 0,
		author_is_banned: 0,
		author_comment_count: 5,
		author_pending_count: 0,
		author_spam_count: 0,
		score_up: 12,
		score_down: 0,
		reply_count: 1,
		is_pinned: 0,
		post_title: "888 官方部落格：邁向主權邊緣 AI 架構新紀元",
		post_url: "https://blog.david888.com/welcome",
	};

	const replies = [
		{
			id: "01JCMN00000000000000000002",
			post_id: "01JPOST00000000000000000001",
			post_slug: "welcome",
			parent_id: "01JCMN00000000000000000001",
			user_id: "01JADMIN000000000000000001",
			body_html: "<p>是的！888echo 採用跨子網域安全 Cookie 與 Session 隔離，可以在 <code>blog.david888.com</code> 與其他網域共享登入狀態。</p>",
			body_raw: "是的！888echo 採用跨子網域安全 Cookie 與 Session 隔離，可以在 blog.david888.com 與其他網域共享登入狀態。",
			status: "approved",
			created_at: Date.now() - 3600000,
			author_name: "David",
			author_is_admin: 1,
			author_provider: "passkey",
			reply_count: 0,
		},
	];

	const detailData = {
		comment,
		parent: null,
		replies,
		ip_siblings: [],
		user_recent: [comment],
		verdicts: [],
		reports: [],
		audit: [
			{
				id: "01JAUDIT000000000000000001",
				created_at: Date.now() - 7200000,
				admin_name: "David",
				action: "approve",
				target_kind: "comment",
				target_id: "01JCMN00000000000000000001",
				reason: "常規審核通過",
				meta: null,
			},
		],
	};

	const body = renderCommentDetail(detailData as any, true, "David", [], USER.id, true);
	const html = layout("留言詳細資訊", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activeSiteId: null,
		activePath: "/admin/queue",
	});

	const tmp = "/tmp/888echo-comment-detail.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-comment-detail.png"), 1320, 960);
};

// 6. Users Page
const genUsers = () => {
	const rows = [
		{ id: "01JADMIN000000000000000001", name: "David", role: "admin", provider: "passkey", email: "david@david888.com", is_banned: 0, comment_count: 28, created_at: Date.now() - 86400000 * 30 },
		{ id: "01JUSER00000000000000000001", name: "林小明", role: "user", provider: "google", email: "ming@example.com", is_banned: 0, comment_count: 15, created_at: Date.now() - 86400000 * 20 },
		{ id: "01JUSER00000000000000000002", name: "Sarah Chen", role: "mod", provider: "github", email: "sarah@example.com", is_banned: 0, comment_count: 12, created_at: Date.now() - 86400000 * 15 },
		{ id: "01JUSER00000000000000000003", name: "Spam Bot", role: "user", provider: "anon", email: null, is_banned: 1, comment_count: 2, created_at: Date.now() - 86400000 * 5 },
	];
	const body = renderUsers(rows as any, "", null, true);
	const html = layout("使用者", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/users",
	});
	const tmp = "/tmp/888echo-users.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-users.png"), 1320, 750);
};

// 7. Audit Log
const genAudit = () => {
	const rows = [
		{ id: "01JAUDIT000000000000000001", created_at: Date.now() - 1800000, admin_id: USER.id, admin_name: "David", action: "approve", target_kind: "comment", target_id: "01JCMN00000000000000000001", reason: "常規審核通過", meta: null },
		{ id: "01JAUDIT000000000000000002", created_at: Date.now() - 3600000, admin_id: USER.id, admin_name: "David", action: "settings_update", target_kind: "system", target_id: "settings", reason: "啟用 Passkey 無密碼認證", meta: '{"flags":{"passkeys":true}}' },
		{ id: "01JAUDIT000000000000000003", created_at: Date.now() - 7200000, admin_id: USER.id, admin_name: "David", action: "spam", target_kind: "comment", target_id: "01JCMN00000000000000000099", reason: "觸發廣告垃圾關鍵字", meta: null },
	];
	const filters = { admin_id: "", action: "", target_kind: "", target_id: "", from: "", to: "", host: "" };
	const actions = ["approve", "spam", "delete", "pin", "unpin", "ban", "unban", "settings_update", "site_create", "site_update"];
	const body = renderAudit(rows as any, filters, null, actions as any, ["blog.david888.com", "news2.david888.com"], true);
	const html = layout("稽核日誌", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/audit",
	});
	const tmp = "/tmp/888echo-audit.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-audit.png"), 1320, 750);
};

// 8. Webhooks
const genWebhooks = () => {
	const endpoints = [
		{ id: "01JWH000000000000000000001", url: "https://discord.com/api/webhooks/...", adapter: "discord", events: null, secret: "whsec_...", is_active: 1, fail_count: 0, last_delivery_at: Date.now() - 600000, created_at: Date.now() - 86400000 * 7 },
		{ id: "01JWH000000000000000000002", url: "https://hooks.slack.com/services/...", adapter: "slack", events: ["comment.posted", "comment.reported"], secret: null, is_active: 1, fail_count: 0, last_delivery_at: Date.now() - 3600000, created_at: Date.now() - 86400000 * 14 },
		{ id: "01JWH000000000000000000003", url: "https://api.example.com/888echo-hook", adapter: "generic", events: ["comment.reported"], secret: "whsec_...", is_active: 0, fail_count: 10, last_delivery_at: Date.now() - 86400000, created_at: Date.now() - 86400000 * 30 },
	];
	const body = renderWebhooksList(endpoints as any, { active: false, url: "" }, true);
	const html = layout("Webhooks", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/webhooks",
	});
	const tmp = "/tmp/888echo-webhooks.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-webhooks.png"), 1320, 750);
};

// 9. Saved Replies
const genSavedReplies = () => {
	const replies = [
		{ id: "01JR0000000000000000000001", owner_id: USER.id, title: "感謝優質回饋", body: "非常感謝您的寶貴反饋！我們已將建議納入開發時程中。", is_shared: 1, created_at: Date.now() - 86400000 * 10, updated_at: null },
		{ id: "01JR0000000000000000000002", owner_id: USER.id, title: "違反社群守則提醒", body: "請注意：請勿在留言區張貼未經授權之廣告或騷擾訊息，謝謝配合！", is_shared: 0, created_at: Date.now() - 86400000 * 8, updated_at: null },
	];
	const owners = new Map([[USER.id, "David"]]);
	const body = renderSavedRepliesList(replies as any, USER as any, owners, true);
	const html = layout("快捷回覆", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/saved-replies",
	});
	const tmp = "/tmp/888echo-saved-replies.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-saved-replies.png"), 1320, 750);
};

// 10. Subscriptions
const genSubscriptions = () => {
	const subs = [
		{ id: "01JSUB00000000000000000001", email: "reader@example.com", post_slug: "welcome", post_title: "888 官方部落格：邁向主權邊緣 AI 架構新紀元", confirmed_at: Date.now() - 86400000 * 2, unsubscribed_at: null, created_at: Date.now() - 86400000 * 3 },
		{ id: "01JSUB00000000000000000002", email: "tech@david888.com", post_slug: "news-roundup", post_title: "888 即時快訊：全球開源與邊緣算力最新進展", confirmed_at: Date.now() - 86400000, unsubscribed_at: null, created_at: Date.now() - 86400000 },
	];
	const filters = { q: "", post_slug: "", confirmed: "" as const, unsubscribed: "" as const, host: "" };
	const body = renderSubscriptions(subs as any, filters, null, ["blog.david888.com", "news2.david888.com"], true);
	const html = layout("郵件訂閱", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/subscriptions",
	});
	const tmp = "/tmp/888echo-subscriptions.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-subscriptions.png"), 1320, 750);
};

// 11. Operator
const genOperator = () => {
	const data = {
		rerender: { total: 88, stale: 0, current_version: 2 },
		retention: { enabled: false, retention_days: 0, comments_total: 88, ghosts_total: 12 },
		audit_retention: { enabled: false, retention_days: 0, pending: 0, total: 24, oldest: Date.now() - 86400000 * 30 },
		seed_demo_allowed: true,
	};
	const body = renderOperator(data as any, true);
	const html = layout("維護操作", body, USER as any, null, {
		locale: "zh-Hant",
		sites: SITES,
		activePath: "/admin/operator",
	});
	const tmp = "/tmp/888echo-operator.html";
	fs.writeFileSync(tmp, html);
	capture(tmp, path.join(OUT_DIR, "admin-operator.png"), 1320, 850);
};

// 12. Login Portal
const genLogin = () => {
	const loginHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>888echo 管理員登入 — Passkey &amp; 2FA 無密碼安全登入</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 44, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --fg: #f1f5f9;
      --fg-muted: #94a3b8;
      --accent: #3b82f6;
      --input-bg: rgba(15, 23, 42, 0.7);
      --input-border: rgba(255, 255, 255, 0.12);
      --radius: 12px;
    }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: radial-gradient(circle at top right, #1e1b4b 0%, #090d16 50%, #030712 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", sans-serif;
      color: var(--fg);
    }
    .card {
      width: 100%; max-width: 440px; padding: 2.5rem;
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: var(--radius); backdrop-filter: blur(12px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .logo { display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-size: 1.5rem; font-weight: 700; margin-bottom: 0.3rem; }
    .subtitle { text-align: center; color: var(--fg-muted); font-size: 0.88rem; margin-bottom: 2rem; }
    .btn {
      width: 100%; padding: 0.8rem 1rem; border-radius: 8px; border: none; font-size: 0.95rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem;
      transition: all 0.2s ease;
    }
    .btn-passkey { background: #2563eb; color: #fff; margin-bottom: 1.2rem; }
    .divider { display: flex; align-items: center; text-align: center; margin: 1.5rem 0; color: var(--fg-muted); font-size: 0.75rem; text-transform: uppercase; }
    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--card-border); }
    .divider::before { margin-right: 0.75em; } .divider::after { margin-left: 0.75em; }
    input { width: 100%; padding: 0.75rem; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 8px; color: var(--fg); margin-bottom: 1rem; box-sizing: border-box; }
    .btn-email { background: rgba(255,255,255,0.06); color: var(--fg); border: 1px solid var(--card-border); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>888echo</span>
    </div>
    <div class="subtitle">管理員安全登入 — Passkey &amp; 2FA 免密碼認證</div>
    <button class="btn btn-passkey">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
      使用 Passkey / 生物辨識登入
    </button>
    <div class="divider">或使用 Email 2FA 驗證碼</div>
    <input type="email" placeholder="管理員電子信箱 (如 admin@example.com)" value="david@david888.com">
    <button class="btn btn-email">發送 6 位數一次性驗證碼</button>
  </div>
</body>
</html>`;

	const tmp = "/tmp/888echo-login.html";
	fs.writeFileSync(tmp, loginHtml);
	capture(tmp, path.join(OUT_DIR, "admin-login.png"), 1100, 720);
};

// 13. Widget (Light, Dark, Mobile)
const genWidget = (mode: "light" | "dark" | "mobile") => {
	const dark = mode === "dark";
	const isMobile = mode === "mobile";
	const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>888 官方部落格：邁向主權邊緣 AI 架構新紀元</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Noto Sans TC", sans-serif;
      max-width: ${isMobile ? "390px" : "780px"};
      margin: 0 auto;
      padding: ${isMobile ? "1rem 0.75rem" : "2rem 1.5rem"};
      background: ${dark ? "#0f172a" : "#ffffff"};
      color: ${dark ? "#f8fafc" : "#0f172a"};
    }
    .article-header {
      margin-bottom: 2rem;
      border-bottom: 1px solid ${dark ? "rgba(255,255,255,0.1)" : "#e2e8f0"};
      padding-bottom: 1.5rem;
    }
    h1 { font-size: ${isMobile ? "1.4rem" : "1.85rem"}; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
    .meta { color: #64748b; font-size: 0.88rem; margin-bottom: 1rem; }
    p { line-height: 1.68; font-size: ${isMobile ? "0.92rem" : "1.02rem"}; }
  </style>
</head>
<body>
  <div class="article-header">
    <h1>888 官方部落格：邁向主權邊緣 AI 架構新紀元</h1>
    <div class="meta">發布時間：2026 年 11 月 10 日 · 作者：David · 分類：系統架構</div>
    <p>888echo 是一套專為現代靜態網站與內容創作者打造的輕量高隱私留言系統。全系統建構於 Cloudflare Workers 邊緣運算、D1 邊緣關聯資料庫與 KV 快取之上，具備真正的零伺服器維護、無第三方追蹤程式碼與 100% 資料第一方自主權。</p>
  </div>

  <div id="888echo"
       data-slug="welcome"
       data-api="https://garrul.ai360.workers.dev"
       data-title="888 官方部落格：邁向主權邊緣 AI 架構新紀元"
       data-url="https://blog.david888.com/welcome"
       data-lang="zh-Hant"
       ${dark ? 'data-theme="dark"' : ""}>
  </div>

  <script>
    const origFetch = window.fetch;
    window.fetch = async function(url, opts) {
      if (typeof url === "string" && url.includes("/api/v1/bootstrap")) {
        return new Response(JSON.stringify({
          config: {
            voting_enabled: true,
            downvotes_enabled: true,
            reactions_enabled: true,
            page_reactions_enabled: true,
            page_votes_enabled: true,
            reaction_kinds: "fire,love,wow,laugh,hmm,cry",
            page_reaction_kinds: "fire,love,wow,laugh,hmm,cry",
            oauth_login_enabled: false,
            default_sort: "top",
            locale: "zh-Hant",
            branding_hidden: true,
            form_token_enabled: false,
            staff_badge_label: "官方維護者",
            strings: ${JSON.stringify(zhHant)}
          },
          user: null,
          engagement: {
            reactions: { fire: 18, love: 12, wow: 6, laugh: 5, hmm: 2, cry: 0 },
            my_reactions: ["fire"],
            votes: { score_up: 28, score_down: 1, my_vote: 1 }
          },
          comments: {
            sort: "top",
            next_cursor: null,
            total: 2,
            accepting_comments: true,
            threads: [
              {
                id: "01JCMN00000000000000000001",
                parent_id: null,
                body_html: "<p>歡迎來到 <strong>888echo</strong> 留言系統！此留言框完全運行於 Shadow DOM 之內，具備原生繁體中文支援、表情符號反應、Passkey 零信任登入與多站台架構。歡迎在下方留言測試！🚀</p>",
                status: "approved",
                edited_at: null,
                deleted_at: null,
                deleted_by: null,
                created_at: Date.now() - 3600000 * 2,
                author: {
                  name: "David",
                  avatar_url: null,
                  is_admin: true,
                  is_staff: true,
                  is_banned: false,
                  provider: "passkey"
                },
                depth: 0,
                flatten_from: null,
                can_reply: true,
                pinned: true,
                staff: true,
                reactions: [{ kind: "fire", count: 8, my_reaction: true }, { kind: "love", count: 5, my_reaction: false }],
                score_up: 15,
                score_down: 0,
                my_vote: 1,
                replies: [
                  {
                    id: "01JCMN00000000000000000002",
                    parent_id: "01JCMN00000000000000000001",
                    body_html: "<p>介面載入非常迅速，排版乾淨俐落！繁體中文翻譯完全符合台灣閱讀習慣，點擊反應也超級滑順！👍</p>",
                    status: "approved",
                    edited_at: null,
                    deleted_at: null,
                    deleted_by: null,
                    created_at: Date.now() - 3600000,
                    author: {
                      name: "林小明",
                      avatar_url: null,
                      is_admin: false,
                      is_staff: false,
                      is_banned: false,
                      provider: "anon"
                    },
                    depth: 1,
                    flatten_from: null,
                    can_reply: true,
                    reactions: [{ kind: "love", count: 3, my_reaction: false }],
                    score_up: 7,
                    score_down: 0,
                    my_vote: 0,
                    replies: []
                  }
                ]
              }
            ]
          }
        }), {
          headers: { "content-type": "application/json" }
        });
      }
      return origFetch.apply(this, arguments);
    };
  </script>
  <script src="${path.resolve(process.cwd(), "public/embed.js")}"></script>
</body>
</html>`;

	const tmp = `/tmp/888echo-widget-${mode}.html`;
	fs.writeFileSync(tmp, html);
	const filename = mode === "mobile" ? "widget-mobile.png" : mode === "dark" ? "widget-dark.png" : "widget-light.png";
	const width = isMobile ? 390 : 920;
	const height = isMobile ? 844 : 1100;
	capture(tmp, path.join(OUT_DIR, filename), width, height);
};

const run = async () => {
	console.log("=== Generating ALL 888echo Screenshots ===");
	genDashboard();
	genSites();
	await genSettings();
	genQueue("pending", "admin-queue-pending.png");
	genQueue("approved", "admin-queue.png");
	genQueue("spam", "admin-queue-spam.png");
	genQueue("reported", "admin-queue-reported.png");
	genCommentDetail();
	genUsers();
	genAudit();
	genWebhooks();
	genSavedReplies();
	genSubscriptions();
	genOperator();
	genLogin();
	genWidget("light");
	genWidget("dark");
	genWidget("mobile");
	console.log("=== All 18 screenshots generated successfully! ===");
};

run();
