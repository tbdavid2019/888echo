import type { User } from "../db/queries";
import type { UpdateInfo } from "../lib/version-check";
import { escapeHtml, jsLiteral } from "./escape";
import { icon } from "./icons";
import { ADMIN_CSS, ALPINE_SRI, ALPINE_VERSION } from "./styles";

type NavLink = { href: string; label: string; icon: string };
type NavSection = { heading: string; links: NavLink[] };

// Build one sidebar section. The section heading renders only when the
// section has at least one visible link, so mods (who see an empty Manage /
// System section) don't get dangling headers. `active` adds a SEPARATE
// `class="... active"` attribute so the `href="..."` substrings the
// role-gating tests assert on stay byte-identical.
const renderNavSection = (
	section: NavSection,
	activePath: string | undefined,
): string => {
	if (section.links.length === 0) return "";
	const links = section.links
		.map((l) => {
			// The dashboard root ("/admin") is a prefix of every admin path, so it
			// must match exactly; all other links highlight on their sub-pages too
			// (e.g. /admin/users/:id keeps "Users" active) via a prefix match.
			const isActive =
				activePath !== undefined &&
				(l.href === "/admin"
					? activePath === "/admin"
					: activePath === l.href || activePath.startsWith(`${l.href}/`));
			return `<a href="${l.href}" class="nav-link${isActive ? " active" : ""}"
       ${isActive ? 'aria-current="page"' : ""}
       @click="navOpen = false">${icon(l.icon)}<span>${escapeHtml(l.label)}</span></a>`;
		})
		.join("");
	return `<div class="nav-section">
  <p class="nav-heading">${escapeHtml(section.heading)}</p>
  ${links}
</div>`;
};

const statusTitle = (status: 401 | 403 | 404): string => {
	if (status === 401) return "Sign in required";
	if (status === 403) return "Forbidden";
	return "Not found";
};

export const accessDeniedHtml = (
	status: 401 | 403 | 404,
	message: string,
): string => `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${statusTitle(status)} — 888echo Admin</title>
<style>
  /* Light default; flip to dark on OS preference. Mirrors the admin theme
     tokens but standalone (this page renders before the app shell / Alpine,
     and the admin CSP forbids the usual inline no-FOUC script). */
  :root { --bg: #f6f8fa; --fg: #1b2733; --muted: #5c6b7a;
          --accent: #2563eb; --code-bg: #f0f3f6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0b0d10; --fg: #e7eaf0; --muted: #8a93a6;
            --accent: #6aa9ff; --code-bg: #1e2530; }
  }
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif;
         background: var(--bg); color: var(--fg); max-width: 480px;
         margin: 4rem auto; padding: 0 1rem; line-height: 1.55; }
  h1 { margin-top: 0; }
  a { color: var(--accent); }
  .muted { color: var(--muted); }
  code { background: var(--code-bg); padding: 0.1rem 0.3rem; border-radius: 3px; }
</style>
</head>
<body>
<h1>${statusTitle(status)}</h1>
<p>${escapeHtml(message)}</p>
<p class="muted">請透過 888echo 管理員登入入口（支援 Passkey 生物辨識與 Email 2FA 驗證碼）登入後存取後台。</p>
${status === 401 ? `<div style="margin-top: 1.5rem;">
  <a href="/admin/login" style="display:inline-block;background:var(--accent);color:#ffffff;padding:0.65rem 1.25rem;border-radius:8px;text-decoration:none;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
    🔐 前往 888echo 管理員登入頁 (Go to Admin Login)
  </a>
</div>` : ""}
<p class="muted" style="margin-top:1.5rem;font-size:0.875rem;">
  管理者信箱須包含於環境變數 <code>ADMIN_EMAILS</code> 中。</p>
</body>
</html>`;

export const renderUpdateBanner = (info: UpdateInfo | null): string => {
	if (!info || !info.behind) return "";
	const tag = escapeHtml(info.latest);
	const url = escapeHtml(info.url);
	const key = `garrul.dismissed.update.${info.latest}`;
	// info.latest is a tag name fetched from the GitHub API, so this is the one
	// value on the page that isn't operator-controlled. jsLiteral, not
	// escapeHtml(JSON.stringify(…)): JSON.stringify leaves `<`, `>` and
	// U+2028/U+2029 raw, all of which are unsafe inside executable JS.
	const keyLit = jsLiteral(key);
	return `
<div x-data="{ shown: localStorage.getItem(${keyLit}) !== '1' }"
     x-show="shown"
     class="banner update">
  <span>Update available: <strong>${tag}</strong> —
    <a href="${url}" target="_blank" rel="noopener">release notes</a>.
    Run <code>npm run upgrade</code>.</span>
  <button @click="localStorage.setItem(${keyLit},'1'); shown=false"
          aria-label="Dismiss update notice">Dismiss</button>
</div>`;
};

export type AdminLocale = "zh-Hant" | "en";

export type LayoutOpts = {
	usage_link?: boolean;
	/** Request path of the current page, used to highlight the active nav link. */
	activePath?: string;
	/**
	 * Page-local keyboard shortcuts, `[keys, description]`, listed in the help
	 * popover under the three global ones. The page that binds them owns the
	 * list (see `QUEUE_SHORTCUTS`), so the popover can't describe a key the
	 * page stopped handling.
	 */
	shortcuts?: ReadonlyArray<readonly [string, string]>;
	locale?: AdminLocale;
	sites?: Array<{ id: string; domain: string; name: string }>;
	activeSiteId?: string | null;
};

// `j / k` renders as two <kbd>s, `Esc` as one: split on the separator the
// caller wrote rather than making every entry an array.
export const kbdKeys = (keys: string): string =>
	keys
		.split("/")
		.map((k) => `<kbd>${escapeHtml(k.trim())}</kbd>`)
		.join(" ");

export const layout = (
	title: string,
	body: string,
	currentUser: User,
	updateInfo: UpdateInfo | null,
	opts: LayoutOpts = {},
): string => {
	const isZh = opts.locale === "zh-Hant";
	const nextLang = isZh ? "en" : "zh-Hant";
	const isAdmin = currentUser.role === "admin";
	const rolePill =
		currentUser.role === "admin"
			? `<span class="pill admin">${isZh ? "管理員" : "admin"}</span>`
			: currentUser.role === "mod"
				? `<span class="pill mod">${isZh ? "審核員" : "mod"}</span>`
				: "";
	// Sidebar nav, grouped into sections. Mods see only Moderation (plus the
	// always-on About link) — every Manage/System surface requires admin
	// scope, so those sections come up empty for mods and renderNavSection
	// drops their headers. The Usage link further gates on whether
	// CF_API_TOKEN + CF_ACCOUNT_ID are configured (see opts.usage_link).
	const manageLinks: NavLink[] = isAdmin
		? [
				{ href: "/admin/sites", label: isZh ? "站台管理" : "Sites", icon: "globe" },
				{ href: "/admin/users", label: isZh ? "使用者" : "Users", icon: "users" },
				{
					href: "/admin/subscriptions",
					label: isZh ? "郵件訂閱" : "Subscriptions",
					icon: "subscriptions",
				},
				{ href: "/admin/passkeys", label: isZh ? "Passkey 憑證" : "Passkeys", icon: "key" },
			]
		: [];
	const integrationLinks: NavLink[] = isAdmin
		? [
				{ href: "/admin/webhooks", label: "Webhooks", icon: "webhook" },
				{ href: "/admin/telegram", label: isZh ? "Telegram 機器人" : "Telegram", icon: "telegram" },
			]
		: [];
	const systemLinks: NavLink[] = isAdmin
		? [
				{ href: "/admin/audit", label: isZh ? "稽核日誌" : "Audit", icon: "audit" },
				...(opts.usage_link
					? [{ href: "/admin/usage", label: isZh ? "用量統計" : "Usage", icon: "usage" }]
					: []),
				{ href: "/admin/operator", label: isZh ? "維運操作" : "Operator", icon: "operator" },
				{ href: "/admin/settings", label: isZh ? "系統設定" : "Settings", icon: "settings" },
			]
		: [];
	const navSections: NavSection[] = [
		{
			heading: isZh ? "內容審核" : "Moderation",
			links: [
				{ href: "/admin", label: isZh ? "控制台" : "Dashboard", icon: "dashboard" },
				{ href: "/admin/queue", label: isZh ? "審核佇列" : "Queue", icon: "queue" },
				{ href: "/admin/saved-replies", label: isZh ? "快捷回覆" : "Replies", icon: "reply" },
			],
		},
		{ heading: isZh ? "營運管理" : "Manage", links: manageLinks },
		{ heading: isZh ? "整合服務" : "Integrations", links: integrationLinks },
		{ heading: isZh ? "系統維運" : "System", links: systemLinks },
		{
			heading: isZh ? "說明與支援" : "Help",
			links: [{ href: "/admin/about", label: isZh ? "關於 888echo" : "About", icon: "about" }],
		},
	];
	const navHtml = navSections
		.map((s) => renderNavSection(s, opts.activePath))
		.join("\n");
	const siteSwitcherHtml =
		opts.sites && opts.sites.length > 0
			? `<div class="site-switcher" style="padding:0 0.8rem 0.6rem;">
  <select style="width:100%;padding:0.4rem 0.6rem;font-size:0.85rem;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);outline:none;cursor:pointer;"
          aria-label="${isZh ? "選擇目前站台" : "Select site"}"
          onchange="window.location.href='/admin/set-site?site_id=' + encodeURIComponent(this.value) + '&return_to=' + encodeURIComponent(window.location.pathname + window.location.search)">
    <option value="" ${!opts.activeSiteId ? "selected" : ""}>🌐 ${isZh ? "全部站台 (All Sites)" : "All Sites"}</option>
    ${opts.sites
			.map(
				(s) =>
					`<option value="${escapeHtml(s.id)}" ${opts.activeSiteId === s.id ? "selected" : ""}>${escapeHtml(s.name)} (${escapeHtml(s.domain)})</option>`,
			)
			.join("")}
  </select>
</div>`
			: "";
	const pageShortcuts = opts.shortcuts?.length
		? `<h4>${isZh ? "本頁快捷鍵" : "This page"}</h4>
  <dl>
    ${opts.shortcuts
			.map(([keys, desc]) => `<dt>${kbdKeys(keys)}</dt><dd>${escapeHtml(desc)}</dd>`)
			.join("\n    ")}
  </dl>`
		: "";
	// The theme lives on <html> as data-theme. We can't use the usual inline
	// <head> script to set it before first paint (admin CSP forbids inline
	// <script>), so the CSS handles the no-JS case: :root is light and a
	// prefers-color-scheme block flips to dark, so the first paint already
	// respects the OS preference. Alpine then reconciles the stored choice on
	// x-init. localStorage key matches the renderUpdateBanner convention.
	//
	// The global shortcuts match on e.key by hand rather than through Alpine's
	// key modifiers. Alpine kebab-cases e.key and looks the result up in a small
	// alias table, and that table has no entry for "?" — `.question-mark` never
	// matched, so the popover advertised a key that did nothing. `.shift.slash`
	// is not the fix either: with Shift held e.key is "?", not "/".
	//
	// Hand-matching also buys the guard the modifier form cannot express: a
	// window listener with .prevent swallows "/" and "?" typed into a note, a
	// saved reply or a search box. Escape is deliberately outside that guard, so
	// the popover still closes from anywhere.
	//
	// "/" only swallows the keystroke once it has a *visible* field to focus.
	// The offsetParent test is not belt-and-braces: the comment and user detail
	// pages carry a text input inside the saved-reply editor's x-show, so
	// querySelector alone matches a field the reader cannot see and eats the key
	// on the pages where notes are written.
	return `
<!doctype html>
<html lang="en"
      x-data="{
        theme: localStorage.getItem('garrul.theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
        helpOpen: false,
        navOpen: false,
        setTheme(t) { this.theme = t; localStorage.setItem('garrul.theme', t); document.documentElement.setAttribute('data-theme', t); },
        typing(e) { const t = e.target; return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable]')); },
        onKey(e) {
          if (e.key === 'Escape') { this.helpOpen = false; return; }
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (this.typing(e)) return;
          if (e.key === '?') { e.preventDefault(); this.helpOpen = !this.helpOpen; return; }
          if (e.key === '/') { const el = Array.from(document.querySelectorAll('input[type=text],input[type=search]')).find(n => n.offsetParent !== null); if (el) { e.preventDefault(); el.focus(); } }
        }
      }"
      x-init="document.documentElement.setAttribute('data-theme', theme)"
      @keydown.window="onKey($event)">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — 888echo Admin</title>
<style>${ADMIN_CSS}</style>
</head>
<body>
${renderUpdateBanner(updateInfo)}
<div class="app-shell">
  <div class="scrim" x-show="navOpen" x-cloak @click="navOpen = false"></div>
  <aside class="sidebar" :class="navOpen && 'open'">
    <a href="/admin" class="brand" @click="navOpen = false">${icon("queue", 22)}<span>888echo</span></a>
    ${siteSwitcherHtml}
    <nav class="sidebar-nav">
${navHtml}
    </nav>
    <div class="sidebar-footer">
      <div class="footer-user">
        <span class="me" title="${escapeHtml(currentUser.name)}">${escapeHtml(currentUser.name)}</span>
        ${rolePill}
      </div>
      <div class="footer-actions">
        <a href="/admin/set-lang?lang=${nextLang}&return_to=${encodeURIComponent(opts.activePath ?? '/admin')}"
           class="icon-btn"
           title="${isZh ? "切換為 English" : "切換為繁體中文"}"
           aria-label="${isZh ? "切換為 English" : "切換為繁體中文"}">
          <span style="font-weight:700;font-size:12px;letter-spacing:0.5px;">${isZh ? "EN" : "繁中"}</span>
        </a>
        <button class="icon-btn" @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
                aria-label="${isZh ? "切換主題模式" : "Toggle theme"}"
                :aria-label="theme === 'dark' ? '${isZh ? "切換為淺色主題" : "Switch to light theme"}' : '${isZh ? "切換為深色主題" : "Switch to dark theme"}'">
          <span x-show="theme === 'dark'" x-cloak>${icon("sun")}</span>
          <span x-show="theme !== 'dark'" x-cloak>${icon("moon")}</span>
        </button>
        <button class="icon-btn" @click="helpOpen = !helpOpen" aria-label="${isZh ? "鍵盤快捷鍵 (?)" : "Keyboard shortcuts (?)"}">?</button>
        <a href="/admin/logout" class="icon-btn" aria-label="${isZh ? "登出" : "Sign out"}" title="${isZh ? "登出管理後台" : "Sign out"}"
           @click="if (!confirm('${isZh ? "確定要登出管理後台嗎？" : "確定要登出管理後台嗎？"}')) $event.preventDefault()">
          ${icon("logout")}
        </a>
      </div>
    </div>
  </aside>
  <div class="content">
    <div class="topbar">
      <button class="icon-btn hamburger" @click="navOpen = !navOpen" aria-label="Toggle navigation">${icon("menu")}</button>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <main>
${body}
    </main>
  </div>
</div>
<div class="toast-tray" role="status" aria-live="polite" aria-atomic="true"
     x-data="{ items: [] }"
     @toast.window="items.push({ id: Date.now() + Math.random(), text: $event.detail.text, kind: $event.detail.kind || 'ok' }); setTimeout(() => { items.shift(); }, 4000)">
  <template x-for="t in items" :key="t.id">
    <div :class="'toast ' + t.kind" x-text="t.text"></div>
  </template>
</div>
<div class="help-popover" x-show="helpOpen" x-cloak @click.away="helpOpen = false" role="dialog" aria-label="${isZh ? '鍵盤快捷鍵' : 'Keyboard shortcuts'}">
  <h4 style="margin-top:0">${isZh ? "全域快捷鍵" : "Shortcuts"}</h4>
  <dl>
    <dt><kbd>/</kbd></dt><dd>${isZh ? "快速搜尋" : "Focus search"}</dd>
    <dt><kbd>?</kbd></dt><dd>${isZh ? "開啟/關閉快捷鍵提示" : "Toggle this help"}</dd>
    <dt><kbd>Esc</kbd></dt><dd>${isZh ? "關閉對話框" : "Close help"}</dd>
  </dl>
  ${pageShortcuts}
</div>
<script src="https://cdn.jsdelivr.net/npm/alpinejs@${ALPINE_VERSION}/dist/cdn.min.js"
        integrity="${ALPINE_SRI}"
        crossorigin="anonymous"
        defer></script>
</body>
</html>`;
};
