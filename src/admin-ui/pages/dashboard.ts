import type { Bindings } from "../../index";
import type {
	AdminStats,
	CommentsByHostRow,
	SpamRate,
	TimelinePoint,
	TopCommenter,
	TopPost,
} from "../../db/queries";
import { spamSummary } from "../components/spam-summary";
import type { ResolvedFlags, ResolvedNumbers } from "../../lib/settings";
import { dicebearAvatarUrl } from "../../lib/identicon";
import { barChartSvg } from "../charts";
import { escapeHtml } from "../escape";

export type DashboardData = {
	stats: AdminStats;
	timeline: TimelinePoint[];
	top_posts: TopPost[];
	top_commenters: TopCommenter[];
	oldest_pending: { id: string; created_at: number } | null;
	spam_rate: SpamRate;
	by_host: CommentsByHostRow[];
};

const relAge = (ts: number, now: number = Date.now(), isZh: boolean = false): string => {
	const diff = Math.max(0, now - ts);
	const m = Math.floor(diff / 60_000);
	if (m < 1) return isZh ? "剛剛" : "just now";
	if (m < 60) return isZh ? `${m} 分鐘前` : `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return isZh ? `${h} 小時前` : `${h}h`;
	const d = Math.floor(h / 24);
	const hRem = h % 24;
	if (isZh) return hRem ? `${d} 天 ${hRem} 小時前` : `${d} 天前`;
	return hRem ? `${d}d ${hRem}h` : `${d}d`;
};

const topPostsList = (posts: TopPost[], isZh: boolean = false): string => {
	if (posts.length === 0)
		return `<li class="muted">${isZh ? "尚無已核准的留言。" : "No approved comments yet."}</li>`;
	return posts
		.map((p) => {
			const label = p.title?.trim() || p.post_slug;
			const href = `/admin/queue?status=all&post_slug=${encodeURIComponent(p.post_slug)}`;
			return `<li><a href="${href}">${escapeHtml(label)}</a> <span class="muted">· ${p.count}</span></li>`;
		})
		.join("");
};

const topCommentersList = (commenters: TopCommenter[], isZh: boolean = false): string => {
	if (commenters.length === 0)
		return `<li class="muted">${isZh ? "尚無已核准的留言。" : "No approved comments yet."}</li>`;
	return commenters
		.map((u) => {
			const avatarUrl = u.avatar_url || dicebearAvatarUrl(u.user_id);
			const avatar = avatarUrl
				? `<img class="author-avatar" src="${escapeHtml(avatarUrl)}" alt="" width="20" height="20" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
				: `<span class="author-avatar" style="width:20px;height:20px"></span>`;
			return `<li><a href="/admin/users/${escapeHtml(u.user_id)}" style="display:inline-flex;gap:0.4rem;align-items:center">${avatar}${escapeHtml(u.name)}</a> <span class="muted">· ${u.count}</span></li>`;
		})
		.join("");
};

const oldestPendingCell = (
	oldest: { id: string; created_at: number } | null,
	isZh: boolean = false,
): string => {
	if (!oldest)
		return `<div class="muted">${isZh ? "無待處理留言。" : "No pending comments."}</div>`;
	const ageStr = isZh ? relAge(oldest.created_at, Date.now(), true) : `${relAge(oldest.created_at)} ago`;
	return `<a href="/admin/comments/${escapeHtml(oldest.id)}">${ageStr}</a>`;
};

const spamRatePct = (r: SpamRate): string => {
	if (r.total === 0) return "—";
	const pct = (r.spam / r.total) * 100;
	return `${pct.toFixed(1)}%`;
};

const HOSTS_VISIBLE = 10;

const byHostPanel = (rows: CommentsByHostRow[], isZh: boolean = false): string => {
	const heading = isZh ? "各網域留言分佈" : "Comments by domain";
	if (rows.length === 0)
		return `<div class="card"><h3>${heading}</h3><div class="muted">${isZh ? "尚無留言。" : "No comments yet."}</div></div>`;
	const visible = rows.slice(0, HOSTS_VISIBLE);
	const overflow = rows.length - visible.length;
	const trs = visible
		.map((r) => {
			const rate = r.total > 0 ? ((r.spam / r.total) * 100).toFixed(1) : "0.0";
			const href = `/admin/queue?status=all&host=${encodeURIComponent(r.host)}`;
			return `
<tr>
  <td><a href="${href}"><code>${escapeHtml(r.host)}</code></a></td>
  <td>${r.total}</td>
  <td>${r.pending}</td>
  <td>${r.spam}</td>
  <td class="muted">${rate}%</td>
</tr>`;
		})
		.join("");
	const more = overflow > 0
		? `<div class="muted" style="font-size:0.85em;margin-top:0.4rem">${isZh ? `…以及其他 ${overflow} 個網域` : `…and ${overflow} more domain${overflow === 1 ? "" : "s"}`}</div>`
		: "";
	return `
<div class="card">
  <h3>${heading}</h3>
  <table>
    <thead><tr>
      <th>${isZh ? "網域 (Host)" : "Host"}</th>
      <th>${isZh ? "總數" : "Total"}</th>
      <th>${isZh ? "待審核" : "Pending"}</th>
      <th>${isZh ? "垃圾" : "Spam"}</th>
      <th>${isZh ? "垃圾佔比" : "Spam %"}</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  ${more}
</div>`;
};

const embedOrigin = (env: Bindings): string => {
	const raw = (env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
	return raw || "https://comments.example.com";
};

const embedCard = (env: Bindings, isZh: boolean = false): string => {
	const origin = escapeHtml(embedOrigin(env));
	const snippet = `&lt;div id="888echo" data-slug="YOUR_PAGE_SLUG" data-api="${origin}"&gt;&lt;/div&gt;
&lt;script src="${origin}/embed.js" defer&gt;&lt;/script&gt;`;
	return `
<div class="card" x-data>
  <div class="card-head">
    <h3>${isZh ? "嵌入至您的網站" : "Embed on your site"}</h3>
    <button class="btn btn-secondary"
            @click="navigator.clipboard && navigator.clipboard.writeText($refs.embed.textContent).then(
              () => $dispatch('toast', { text: '${isZh ? "嵌入代碼已複製" : "Embed code copied"}' }),
              () => $dispatch('toast', { text: '${isZh ? "複製失敗" : "Copy failed"}', kind: 'bad' }))">${isZh ? "複製代碼" : "Copy"}</button>
  </div>
  <p class="muted">${isZh ? "將此代碼貼在希望顯示留言的地方。並將 <code>data-slug</code> 設定為每篇頁面的固定識別代碼。" : "Paste this where comments should appear. Set <code>data-slug</code> to a stable per-page id."}</p>
  <pre class="embed-snippet" x-ref="embed"><code>${snippet}</code></pre>
  <p class="muted">${isZh ? '想要客製化外觀？請參閱 <a href="https://github.com/tbdavid2019/Garrul/blob/main/docs/THEMING.md" target="_blank" rel="noopener">樣式自訂文件</a>。' : 'Want a different look? The <a href="https://garrul.com/theme" target="_blank" rel="noopener">theme builder</a> previews presets and colors on the real widget and hands you the snippet to paste next to this one.'}</p>
</div>`;
};

export const renderDashboard = (
	data: DashboardData,
	env: Bindings,
	flags: ResolvedFlags,
	numbers: ResolvedNumbers,
	isZh: boolean = false,
): string => {
	const { stats, timeline, top_posts, top_commenters, oldest_pending, spam_rate, by_host } = data;
	return `
<div class="card">
  <h2>${isZh ? "總覽概況" : "Overview"}</h2>
  <div class="stat-grid">
    <div class="stat accent"><div class="v">${stats.total_comments}</div><div class="l">${isZh ? "留言總數" : "total comments"}</div></div>
    <div class="stat${stats.pending_comments > 0 ? " warn" : ""}"><div class="v">${stats.pending_comments}</div><div class="l">${isZh ? "待審核" : "pending"}</div></div>
    <div class="stat${stats.spam_comments > 0 ? " bad" : ""}"><div class="v">${stats.spam_comments}</div><div class="l">${isZh ? "垃圾訊息" : "spam"}</div></div>
    <div class="stat"><div class="v">${stats.total_users}</div><div class="l">${isZh ? "使用者" : "users"}</div></div>
    <div class="stat${stats.banned_users > 0 ? " bad" : ""}"><div class="v">${stats.banned_users}</div><div class="l">${isZh ? "已封鎖" : "banned"}</div></div>
    <div class="stat">
      <div class="v" style="font-size:1.1rem">${oldestPendingCell(oldest_pending, isZh)}</div>
      <div class="l">${isZh ? "最早待審" : "oldest pending"}</div>
    </div>
    <div class="stat">
      <div class="v">${spamRatePct(spam_rate)}</div>
      <div class="l">${isZh ? "垃圾佔比 (30天)" : "spam rate (30d)"}</div>
    </div>
  </div>
  <p class="muted">${isZh ? "反垃圾機制" : "Anti-spam"}: ${spamSummary(env, flags, numbers)}. ${isZh ? '可至 <a href="/admin/settings">系統設定</a> 調整。' : 'See <a href="/admin/settings">Settings</a> to change.'}</p>
</div>

${embedCard(env, isZh)}

<div class="card">
  <h3>${isZh ? "每日留言趨勢 (過去 30 天)" : "Comments per day (last 30 days)"}</h3>
  <p class="muted" style="margin:-0.4rem 0 0.6rem;font-size:0.8rem">${isZh ? "每日收到的留言統計。滑鼠懸停於柱狀圖上可檢視具體日期與數量。" : "Comments received each day. Hover a bar for the exact date and count."}</p>
  ${barChartSvg(timeline)}
</div>

<div class="dash-cols">
  <div class="card">
    <h3>${isZh ? "熱門文章 (30天)" : "Top posts (30d)"}</h3>
    <ul class="dash-list">${topPostsList(top_posts, isZh)}</ul>
  </div>
  <div class="card">
    <h3>${isZh ? "熱門留言者 (30天)" : "Top commenters (30d)"}</h3>
    <ul class="dash-list">${topCommentersList(top_commenters, isZh)}</ul>
  </div>
</div>

${byHostPanel(by_host, isZh)}

<div class="card">
  <h3>${isZh ? "快捷操作" : "Quick actions"}</h3>
  <ul>
    <li><a href="/admin/queue?status=pending">${isZh ? `審核 ${stats.pending_comments} 則待處理留言` : `Review ${stats.pending_comments} pending comment(s)`}</a></li>
    <li><a href="/admin/queue?status=spam">${isZh ? "檢查垃圾訊息匣" : "Inspect spam folder"}</a></li>
    <li><a href="/admin/audit">${isZh ? "稽核日誌" : "Audit log"}</a></li>
    <li><a href="/admin/users">${isZh ? "管理使用者" : "Manage users"}</a></li>
  </ul>
</div>`;
};
