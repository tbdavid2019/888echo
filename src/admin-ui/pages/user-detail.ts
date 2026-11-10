import type {
	AdminComment,
	AdminUserDetail,
	AuditRowWithAdmin,
	ModeratorNoteWithAuthor,
	User,
	UserRole,
} from "../../db/queries";
import { dicebearAvatarUrl } from "../../lib/identicon";
import { sanitizeForEmail as resanitizeBodyHtml } from "../../lib/markdown";
import { moderatorNotes } from "../components/moderator-notes";
import { escapeHtml, jsLiteral } from "../escape";

const formatTs = (ts: number): string =>
	new Date(ts).toISOString().slice(0, 16).replace("T", " ");

const rolePill = (role: UserRole, isZh: boolean = false): string => {
	if (role === "admin") return `<span class="pill admin">${isZh ? "管理員" : "admin"}</span>`;
	if (role === "mod") return `<span class="pill mod">${isZh ? "審核員" : "mod"}</span>`;
	return "";
};

const userHeader = (d: AdminUserDetail, viewer: User, isZh: boolean = false): string => {
	const u = d.user;
	const avatarUrl = u.avatar_url || dicebearAvatarUrl(u.id);
	const avatar = avatarUrl
		? `<img class="author-avatar" src="${escapeHtml(avatarUrl)}" alt="" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
		: `<span class="author-avatar" style="width:64px;height:64px"></span>`;
	const badges: string[] = [];
	const pill = rolePill(u.role, isZh);
	if (pill) badges.push(pill);
	if (u.is_banned) badges.push(`<span class="pill banned">${isZh ? "已封鎖" : "banned"}</span>`);
	if (u.erased_at) badges.push(`<span class="pill">${isZh ? "已抹除" : "erased"}</span>`);
	const canManageRole = viewer.role === "admin" && viewer.id !== u.id;
	const roleControls = canManageRole
		? `
  <div class="actions" x-data="{ busy: false, role: ${jsLiteral(u.role)} }">
    <template x-if="role !== 'user'">
      <button :disabled="busy" @click="busy=true; setRole('user').then(r=>{role=r}).finally(()=>busy=false)">${isZh ? "降為一般使用者" : "Demote to user"}</button>
    </template>
    <template x-if="role !== 'mod'">
      <button :disabled="busy" @click="busy=true; setRole('mod').then(r=>{role=r}).finally(()=>busy=false)">${isZh ? "設為審核員" : "Make mod"}</button>
    </template>
    <template x-if="role !== 'admin'">
      <button :disabled="busy" @click="busy=true; setRole('admin').then(r=>{role=r}).finally(()=>busy=false)">${isZh ? "設為管理員" : "Make admin"}</button>
    </template>
  </div>`
		: "";
	const canErase =
		viewer.role === "admin" && viewer.id !== u.id && u.role !== "admin";
	const canExport = viewer.role === "admin";
	return `
<div class="user-head">
  ${avatar}
  <div class="user-meta">
    <h2 style="margin:0">${escapeHtml(u.name)} ${badges.join(" ")}</h2>
    <div class="muted">${escapeHtml(u.email ?? "—")} · ${escapeHtml(u.provider)} · ${isZh ? "加入於" : "joined"} ${formatTs(u.created_at)}</div>
    <div class="muted"><code>${escapeHtml(u.id)}</code></div>
    ${u.erased_at ? `<div class="muted">${isZh ? `個人資料已於 ${formatTs(u.erased_at)} 抹除。` : `Personal data erased ${formatTs(u.erased_at)}.`}</div>` : ""}
  </div>
  <div class="actions" x-data="{ busy: false, banned: ${u.is_banned} }">
    <template x-if="!banned">
      <button :disabled="busy" class="bad" @click="busy=true; setBanned(true).then(()=>{banned=true}).finally(()=>busy=false)">${isZh ? "封鎖" : "Ban"}</button>
    </template>
    <template x-if="banned">
      <button :disabled="busy" @click="busy=true; setBanned(false).then(()=>{banned=false}).finally(()=>busy=false)">${isZh ? "解除封鎖" : "Unban"}</button>
    </template>
    ${
			viewer.role === "admin"
				? `<button :disabled="busy" @click="busy=true; revokeSessions().finally(()=>busy=false)">${
						viewer.id === u.id
							? (isZh ? "登出其他裝置工作階段" : "Sign out other sessions")
							: (isZh ? "強制在所有裝置登出" : "Sign out everywhere")
					}</button>`
				: ""
		}
  </div>
</div>
${roleControls}
${canExport ? exportPanel(u.id, isZh) : ""}
${canErase ? erasePanel(isZh) : ""}`;
};

const exportPanel = (id: string, isZh: boolean = false): string => `
<details style="margin-top:1rem;border-top:1px solid #e5e7eb;padding-top:0.75rem">
  <summary style="cursor:pointer">${isZh ? "匯出個人資料 (JSON)…" : "Export personal data…"}</summary>
  <p class="muted">
    ${
			isZh
				? "本實例所儲存關於此帳號的所有資料 (JSON 格式)：個人檔案、留言內容（含已儲存的 IP 雜湊與 User-Agent）、檢舉記錄、電子郵件訂閱、Telegram 連動、投票與表情反應、垃圾訊息分類紀錄及針對該帳號執行的審核操作。操作管理員身分已予以隱藏以保護第三方隱私。"
				: `Everything the instance holds about this account, as JSON: profile,
    comments (including stored IP hashes and user agents), reports they filed,
    subscriptions for their address, Telegram link, votes and reactions, spam
    classifications, and moderation actions taken against them. Which moderator
    acted is omitted — that's a third party's data.`
		}
  </p>
  <p class="muted">
    ${
			isZh
				? "此檔案為未加密之個人資料匯出檔。請如同資料庫備份般妥善處理，並在發送前確認請求者身分。"
				: "The file is a personal-data export in the clear. Treat the download like a database dump, and confirm the requester's identity before sending it."
		}
  </p>
  <p><a href="/admin/api/users/${encodeURIComponent(id)}/export">${isZh ? "下載 JSON 檔案" : "Download JSON"}</a></p>
</details>`;

const erasePanel = (isZh: boolean = false): string => `
<details style="margin-top:1rem;border-top:1px solid #e5e7eb;padding-top:0.75rem">
  <summary style="cursor:pointer">${isZh ? "抹除個人資料 (GDPR 刪除權)…" : "Erase personal data…"}</summary>
  <div x-data="{ busy: false, typed: '', bodies: false, done: false }">
    <p class="muted">
      ${
				isZh
					? "清除此帳號的顯示名稱、電子郵件、頭像以及登入提供者/IP 識別標識，並清除其撰寫之每則留言中儲存的 IP 雜湊與 User-Agent。移除其電子郵件訂閱與連動之 Telegram 帳號，並撤銷所有工作階段。其投票、表情反應與分數將予以保留。"
					: `Clears the display name, email, avatar and the provider/IP identifier on
      this account, plus the stored IP hash and user agent on every comment they
      wrote. Email subscriptions for their address and any linked Telegram
      account are removed, and their sessions are revoked. Votes, reactions and
      scores are left as they are.`
			}
    </p>
    <p class="muted">
      ${
				isZh
					? "預設情況下<strong>不會</strong>刪除留言內容——作者將變更為匿名，討論串保持完整可讀。若留言文字本身包含個人資料，請勾選下方方塊。"
					: `Comments are <strong>not</strong> deleted by default — the author becomes
      anonymous and the thread stays readable. Tick the box below if the comment
      text itself contains personal data.`
			}
    </p>
    <label style="display:block;margin:0.5rem 0">
      <input type="checkbox" x-model="bodies" :disabled="busy || done">
      ${isZh ? "同時清空其留言內容並標記為已刪除" : "Also blank their comment bodies and mark them deleted"}
    </label>
    <label style="display:block;margin:0.5rem 0">
      ${isZh ? "請輸入 <code>ERASE</code> 以確認抹除：" : "Type <code>ERASE</code> to confirm:"}
      <input type="text" x-model="typed" :disabled="busy || done"
             autocomplete="off" spellcheck="false" style="font:inherit">
    </label>
    <p class="muted">${isZh ? "此操作無法撤銷。" : "This cannot be undone."}</p>
    <div class="actions">
      <button class="bad" :disabled="busy || done || typed !== 'ERASE'"
              @click="busy=true; erase(bodies).then(()=>{done=true}).finally(()=>busy=false)">
        ${isZh ? "抹除此使用者個人資料" : "Erase this user's data"}
      </button>
    </div>
    <template x-if="done">
      <p class="muted">${isZh ? "個人資料已抹除。重新整理頁面以查看匿名化紀錄。" : "Erased. Reload to see the anonymized record."}</p>
    </template>
  </div>
</details>`;

const commentRow = (c: AdminComment, isZh: boolean = false): string => {
	const statusLabel = isZh
		? c.status === "approved"
			? "已核准"
			: c.status === "spam"
				? "垃圾訊息"
				: c.status === "pending"
					? "待審核"
					: c.status === "deleted"
						? "已刪除"
						: c.status
		: c.status;
	return `
<tr>
  <td><span class="pill ${c.status}">${statusLabel}</span></td>
  <td class="muted">${formatTs(c.created_at)}</td>
  <td><code>${escapeHtml(c.post_slug)}</code></td>
  <td class="row-body"><div class="md">${resanitizeBodyHtml(c.body_html)}</div></td>
  <td><a href="/admin/comments/${escapeHtml(c.id)}">${isZh ? "查看 →" : "open →"}</a></td>
</tr>`;
};

const auditTable = (rows: AuditRowWithAdmin[], isZh: boolean = false): string => {
	if (rows.length === 0) return "";
	const trs = rows
		.map(
			(r) => `
<tr>
  <td>${formatTs(r.created_at)}</td>
  <td><span class="pill">${escapeHtml(r.action)}</span></td>
  <td>${escapeHtml(r.admin_name ?? r.admin_id)}</td>
  <td class="muted">${escapeHtml(r.reason ?? "")}</td>
</tr>`,
		)
		.join("");
	return `
<div class="card">
  <h3>${isZh ? "影響此使用者之稽核紀錄" : "Audit history affecting this user"}</h3>
  <table>
    <thead><tr><th>${isZh ? "時間" : "When"}</th><th>${isZh ? "操作" : "Action"}</th><th>${isZh ? "管理員" : "Admin"}</th><th>${isZh ? "理由" : "Reason"}</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
</div>`;
};

export const renderUserDetail = (
	d: AdminUserDetail,
	viewer: User,
	/** Internal notes about this user, newest first. */
	notes: ModeratorNoteWithAuthor[] = [],
	isZh: boolean = false,
): string => {
	const u = d.user;
	const commentsHtml = d.comments.length
		? d.comments.map((c) => commentRow(c, isZh)).join("")
		: `<tr><td colspan="5" class="muted">${isZh ? "尚無任何留言。" : "No comments yet."}</td></tr>`;
	const nextHref = d.next_cursor
		? `/admin/users/${escapeHtml(u.id)}?before=${encodeURIComponent(d.next_cursor)}`
		: null;
	const next = nextHref
		? `<a href="${nextHref}">${isZh ? "下一頁 →" : "Next →"}</a>`
		: `<span class="muted">${isZh ? "已到底部" : "end"}</span>`;
	return `
<a href="/admin/users" class="muted">${isZh ? "← 返回使用者清單" : "← back to users"}</a>
<div class="card" x-data="{
  setBanned(banned) {
    return fetch('/admin/api/users/${escapeHtml(u.id)}', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ banned }),
    }).then(r => {
      if (!r.ok) throw new Error('action failed: ' + r.status);
      this.$dispatch('toast', { text: banned ? '${isZh ? "使用者已封鎖" : "User banned"}' : '${isZh ? "已解除使用者封鎖" : "User unbanned"}' });
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
      throw e;
    });
  },
  erase(bodies) {
    return fetch('/admin/api/users/${escapeHtml(u.id)}/erase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'ERASE', redact_bodies: bodies }),
    }).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('action failed: ' + r.status));
      this.$dispatch('toast', { text: '${isZh ? "個人資料已抹除" : "Personal data erased"}' });
      return j;
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
      throw e;
    });
  },
  revokeSessions() {
    return fetch('/admin/api/users/${escapeHtml(u.id)}/revoke-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('action failed: ' + r.status));
      this.$dispatch('toast', { text: j.self ? '${isZh ? "已登出其他裝置——此工作階段仍保持有效" : "Signed out everywhere else — this session stays"}' : '${isZh ? "已在所有裝置登出" : "Signed out on every device"}' });
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
      throw e;
    });
  },
  setRole(role) {
    return fetch('/admin/api/users/${escapeHtml(u.id)}/role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    }).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('action failed: ' + r.status));
      this.$dispatch('toast', { text: '${isZh ? "角色已更新為 " : "Role updated to "}' + j.role });
      return j.role;
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
      throw e;
    });
  }
}">
  ${userHeader(d, viewer, isZh)}
  <div class="user-stats">
    <div><span class="muted">${isZh ? "獲得表情反應總數：" : "Reactions received:"}</span> ${d.reactions_received}</div>
  </div>
</div>

${moderatorNotes({
	target_kind: "user",
	target_id: u.id,
	notes,
	viewerId: viewer.id,
	viewerIsAdmin: viewer.role === "admin",
	isZh,
})}

<div class="card">
  <h3>${isZh ? `${escapeHtml(u.name)} 的留言` : `Comments by ${escapeHtml(u.name)}`}</h3>
  <p class="muted">${isZh ? "所有狀態，最新優先。" : "All statuses, newest first."}</p>
  <table>
    <thead><tr><th>${isZh ? "狀態" : "Status"}</th><th>${isZh ? "時間" : "When"}</th><th>${isZh ? "文章" : "Post"}</th><th>${isZh ? "內容" : "Body"}</th><th></th></tr></thead>
    <tbody>${commentsHtml}</tbody>
  </table>
  <div class="pager">${next}</div>
</div>

${auditTable(d.audit, isZh)}
`;
};
