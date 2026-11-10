import type {
	AdminComment,
	AdminCommentDetail,
	AuditRowWithAdmin,
	ModeratorNoteWithAuthor,
	Report,
	SpamVerdictRow,
} from "../../db/queries";
import { dicebearAvatarUrl } from "../../lib/identicon";
import { sanitizeForEmail as resanitizeBodyHtml } from "../../lib/markdown";
import { moderatorNotes } from "../components/moderator-notes";
import {
	commentIdLiteral,
	replyComposer,
} from "../components/reply-composer";
import { escapeHtml, jsLiteral } from "../escape";
import { replyHint } from "./queue";

const formatTs = (ts: number): string =>
	new Date(ts).toISOString().slice(0, 16).replace("T", " ");

const authorBlock = (c: AdminComment, isZh: boolean = false): string => {
	const name = c.author_name ?? (isZh ? "(已刪除使用者)" : "(deleted user)");
	const avatarUrl = c.author_avatar_url || dicebearAvatarUrl(c.user_id);
	const avatar = avatarUrl
		? `<img class="author-avatar" src="${escapeHtml(avatarUrl)}" alt="" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
		: `<span class="author-avatar" style="width:40px;height:40px"></span>`;
	const badges: string[] = [];
	if (c.author_is_admin) badges.push(`<span class="pill admin">${isZh ? "管理員" : "admin"}</span>`);
	if (c.author_is_banned) badges.push(`<span class="pill banned">${isZh ? "已封鎖" : "banned"}</span>`);
	const providerLabel = c.author_provider ?? (isZh ? "匿名" : "anon");
	return `
<div class="author-cell" style="max-width:none">
  ${avatar}
  <span class="author-meta">
    <span class="author-name"><a href="/admin/users/${escapeHtml(c.user_id)}">${escapeHtml(name)}</a> ${badges.join(" ")}</span>
    <span class="author-sub muted">${escapeHtml(providerLabel)} · <code>${escapeHtml(c.user_id)}</code></span>
  </span>
</div>`;
};

const commentCard = (c: AdminComment, heading: string, isZh: boolean = false): string => {
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
<div class="comment-card">
  <div class="muted" style="font-size:0.75rem">${heading}</div>
  <div class="comment-card-head">
    ${authorBlock(c, isZh)}
    <span class="pill ${c.status}">${statusLabel}</span>
  </div>
  <div class="muted" style="font-size:0.75rem">
    ${formatTs(c.created_at)} · <code>${escapeHtml(c.post_slug)}</code>
    · <a href="/admin/comments/${escapeHtml(c.id)}">${escapeHtml(c.id)}</a>
  </div>
  <div class="md">${resanitizeBodyHtml(c.body_html)}</div>
</div>`;
};

const verdictPill = (v: SpamVerdictRow, isZh: boolean = false): string => {
	const klass =
		v.verdict === "spam"
			? "spam"
			: v.verdict === "ham"
				? "approved"
				: "pending";
	const score = v.score != null ? ` ${v.score.toFixed(2)}` : "";
	const verdictLabel = isZh
		? v.verdict === "spam"
			? "垃圾"
			: v.verdict === "ham"
				? "正常"
				: escapeHtml(v.verdict)
		: escapeHtml(v.verdict);
	return `<span class="pill ${klass}">${escapeHtml(v.source)}: ${verdictLabel}${score}</span>`;
};

const verdictsSection = (verdicts: SpamVerdictRow[], isZh: boolean = false): string => {
	if (verdicts.length === 0) return "";
	const rows = verdicts
		.map(
			(v) => `
<tr>
  <td>${verdictPill(v, isZh)}</td>
  <td class="muted">${formatTs(v.created_at)}</td>
  <td class="row-body"><code style="font-size:0.7rem">${escapeHtml(v.raw ?? "")}</code></td>
</tr>`,
		)
		.join("");
	return `
<div class="card">
  <h3>${isZh ? "垃圾訊息判定結果" : "Spam verdicts"}</h3>
  <table>
    <thead><tr><th>${isZh ? "判定" : "Verdict"}</th><th>${isZh ? "時間" : "When"}</th><th>${isZh ? "原始資料" : "Raw"}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
};

/**
 * Reader reports for the selected comment.
 */
const reportsSection = (commentId: string, reports: Report[], isZh: boolean = false): string => {
	if (reports.length === 0) return "";
	const open = reports.filter((r) => r.status === "open");
	const rows = reports
		.map(
			(r) => `
<tr>
  <td><span class="pill ${r.status === "open" ? "pending" : "approved"}">${
				isZh ? (r.status === "open" ? "待處理" : "已處理") : r.status
			}</span></td>
  <td class="muted">${formatTs(r.created_at)}</td>
  <td class="row-body">${
		r.reason
			? escapeHtml(r.reason)
			: `<span class="muted">${isZh ? "(未提供理由)" : "(no reason given)"}</span>`
	}</td>
</tr>`,
		)
		.join("");
	const dismiss =
		open.length > 0
			? `
  <div class="actions" style="margin-top:0.5rem"
       x-data="{ busy: false,
         resolve() {
           this.busy = true;
           return fetch('/admin/api/comments/${escapeHtml(commentId)}/reports/resolve', {
             method: 'POST',
             headers: { 'content-type': 'application/json' },
             body: '{}',
           }).then(r => {
             if (!r.ok) throw new Error('action failed: ' + r.status);
             this.$dispatch('toast', { text: '${isZh ? "檢舉已忽略" : "Reports dismissed"}' });
             setTimeout(() => location.reload(), 600);
           }).catch(e => {
             this.$dispatch('toast', { text: e.message, kind: 'bad' });
           }).finally(() => { this.busy = false; });
         }
       }">
    <button :disabled="busy" @click="resolve()">${isZh ? "忽略所有檢舉" : "Dismiss reports"}</button>
  </div>`
			: "";
	return `
<div class="card">
  <h3>${
		isZh
			? `讀者檢舉 (${open.length} 則待處理 / 共 ${reports.length} 則)`
			: `Reader reports (${open.length} open / ${reports.length} total)`
	}</h3>
  <table>
    <thead><tr><th>${isZh ? "狀態" : "Status"}</th><th>${isZh ? "時間" : "When"}</th><th>${isZh ? "檢舉理由" : "Reason"}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${dismiss}
</div>`;
};

const auditSection = (rows: AuditRowWithAdmin[], title: string, isZh: boolean = false): string => {
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
  <h3>${title}</h3>
  <table>
    <thead><tr><th>${isZh ? "時間" : "When"}</th><th>${isZh ? "操作" : "Action"}</th><th>${isZh ? "管理員" : "Admin"}</th><th>${isZh ? "理由" : "Reason"}</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
</div>`;
};

const banAuthorAction = (c: AdminComment, isAdmin: boolean, isZh: boolean = false): string => {
	if (!isAdmin) return "";
	if (c.author_is_banned) {
		return `<div class="muted" style="margin-top:0.5rem">${isZh ? "作者已被封鎖。" : "Author is already banned."}</div>`;
	}
	const isAnon = (c.author_provider ?? "anon") === "anon";
	const warning = isZh
		? isAnon
			? "確定要封鎖此匿名作者？這將封鎖其雜湊 IP（整個網路出口端）——在共用 IP / CGNAT 環境下可能會影響其他正常使用者。是否繼續？"
			: "確定要封鎖此作者？其將無法再發表留言。是否繼續？"
		: isAnon
			? "Ban this anonymous author? This blocks their hashed IP (the whole network egress) — behind shared IPs/CGNAT it can also block bystanders. Continue?"
			: "Ban this author? They will no longer be able to comment. Continue?";
	return `
<div class="actions" style="margin-top:0.5rem" x-data="{ busy: false,
  ban() {
    if (!confirm(${jsLiteral(warning)})) return;
    this.busy = true;
    return fetch('/admin/api/users/${escapeHtml(c.user_id)}', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ banned: true, from_comment: ${jsLiteral(c.id)} }),
    }).then(r => {
      if (!r.ok) throw new Error('ban failed: ' + r.status);
      this.$dispatch('toast', { text: '${isZh ? "作者已被封鎖" : "Author banned"}' });
      setTimeout(() => location.reload(), 600);
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    }).finally(() => { this.busy = false; });
  }
}">
  <button class="bad" :disabled="busy" @click="ban()">${isZh ? "封鎖作者" : "Ban author"}</button>
</div>`;
};

const actionsFor = (c: AdminComment, isZh: boolean = false): string => {
	const { status } = c;
	const parts: string[] = [];
	if (status !== "approved") {
		const label = status === "spam" || status === "deleted"
			? (isZh ? "復原" : "Restore")
			: (isZh ? "核准" : "Approve");
		parts.push(
			`<button :disabled="busy" @click="busy=true; act('approve').finally(()=>busy=false)">${label}</button>`,
		);
	}
	if (status !== "spam" && status !== "deleted") {
		parts.push(
			`<button :disabled="busy" class="bad" @click="busy=true; act('spam').finally(()=>busy=false)">${isZh ? "標記為垃圾" : "Spam"}</button>`,
		);
	}
	if (status !== "deleted" && (c.reply_count ?? 0) > 0) {
		const confirmMsg = isZh
			? "確定要將此留言及其下所有回覆皆標記為垃圾訊息？"
			: "Mark this comment and every reply below it as spam?";
		parts.push(
			`<button :disabled="busy" class="bad" @click="if (confirm(${jsLiteral(confirmMsg)})) { busy=true; act('spam_thread').finally(()=>busy=false) }">${isZh ? "整串標為垃圾" : "Spam thread"}</button>`,
		);
	}
	if (status !== "deleted") {
		parts.push(
			`<button :disabled="busy" class="bad" @click="busy=true; act('delete').finally(()=>busy=false)">${isZh ? "刪除" : "Delete"}</button>`,
		);
	}
	if (status === "approved" && c.parent_id === null) {
		const pinned = c.pinned_at != null;
		const pinLabel = pinned
			? (isZh ? "取消置頂" : "Unpin")
			: (isZh ? "置頂" : "Pin");
		parts.push(
			`<button :disabled="busy" @click="busy=true; act('${pinned ? "unpin" : "pin"}').finally(()=>busy=false)">${pinLabel}</button>`,
		);
	}
	return parts.join("");
};

export const renderCommentDetail = (
	d: AdminCommentDetail,
	isAdmin = false,
	/** Signed-in moderator's display name, shown as the reply composer's identity. */
	modName = "",
	/** Internal notes on this comment, newest first. */
	notes: ModeratorNoteWithAuthor[] = [],
	/** Signed-in moderator's id — decides which notes offer a Delete. */
	viewerId = "",
	isZh: boolean = false,
): string => {
	const { comment, parent, replies, ip_siblings, user_recent, verdicts, reports, audit } = d;
	const parentSection = parent
		? `<div class="card">${commentCard(parent, isZh ? "上層留言" : "Parent", isZh)}</div>`
		: "";
	const repliesSection = replies.length
		? `<div class="card">
		     <h3>${isZh ? `回覆清單 (${replies.length})` : `Replies (${replies.length})`}</h3>
		     ${replies.map((r) => commentCard(r, isZh ? "回覆" : "Reply", isZh)).join("")}
		   </div>`
		: "";
	const siblingsSection = ip_siblings.length
		? `<div class="card" x-data="{ open: false }">
		     <h3 style="cursor:pointer" @click="open = !open">
		       ${isZh ? `相同 IP 雜湊留言 (${ip_siblings.length})` : `IP-hash siblings (${ip_siblings.length})`}
		       <span class="muted" x-text="open ? '▼' : '▶'"></span>
		     </h3>
		     <div x-show="open" x-cloak>
		       ${ip_siblings.map((s) => commentCard(s, isZh ? "同 IP 雜湊" : "Same IP-hash", isZh)).join("")}
		     </div>
		   </div>`
		: "";
	const userRecentSection = user_recent.length
		? `<div class="card">
		     <h3>${isZh ? "此作者的其他留言 (最近 5 則)" : "Other comments by this author (latest 5)"}</h3>
		     ${user_recent.map((s) => commentCard(s, isZh ? "近期" : "Recent", isZh)).join("")}
		   </div>`
		: "";
	const replySection =
		comment.status === "deleted"
			? ""
			: `<div class="card">
	     <h3>${isZh ? "回覆留言" : "Reply"}</h3>
	     ${replyComposer({
				commentIdExpr: commentIdLiteral(comment.id),
				modName,
				authorNameExpr: jsLiteral(comment.author_name ?? ""),
				postTitleExpr: jsLiteral(comment.post_title || comment.post_slug),
				onPosted: "setTimeout(() => location.reload(), 600);",
			})}
	   </div>`;

	return `
<a href="/admin/queue" class="muted">${isZh ? "← 返回審核佇列" : "← back to queue"}</a>
<div class="card" x-data="{
  busy: false,
  act(action) {
    this.busy = true;
    return fetch('/admin/api/comments/${escapeHtml(comment.id)}', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then(r => {
      if (!r.ok) return r.json().catch(() => ({})).then(j => {
        throw new Error(j.error === 'too_many'
          ? '${isZh ? "討論串過長 (超過 100 則留言)。請使用批次垃圾標記。" : "Thread too large (over 100 comments). Use bulk spam."}'
          : 'action failed: ' + r.status);
      });
      const toastText = ${
				isZh
					? `action === 'pin' ? '已置頂' : action === 'unpin' ? '已取消置頂' : action === 'spam_thread' ? '討論串已標記為垃圾訊息' : action === 'approve' ? '已核准' : action === 'spam' ? '已標記為垃圾訊息' : action === 'delete' ? '已刪除' : action === 'restore' ? '已復原' : action + '已完成'`
					: `action === 'pin' ? 'Pinned' : action === 'unpin' ? 'Unpinned' : action === 'spam_thread' ? 'Thread marked spam' : action + 'd'`
			};
      this.$dispatch('toast', { text: toastText });
      setTimeout(() => location.reload(), 600);
    }).catch(e => {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    }).finally(() => { this.busy = false; });
  }
}">
  <h2>${isZh ? "留言詳細資料" : "Comment"}${replyHint(comment, isZh)}</h2>
  ${commentCard(comment, isZh ? "目前留言" : "Selected", isZh)}
  <div class="actions" style="margin-top:0.5rem">${actionsFor(comment, isZh)}</div>
  ${banAuthorAction(comment, isAdmin, isZh)}
</div>

${moderatorNotes({
	target_kind: "comment",
	target_id: comment.id,
	notes,
	viewerId,
	viewerIsAdmin: isAdmin,
	isZh,
})}

<div class="card">
  <h3>${isZh ? "原始 Markdown 內容" : "Raw markdown"}</h3>
  <pre style="white-space:pre-wrap;font-size:0.85rem">${escapeHtml(comment.body_md)}</pre>
</div>

${replySection}
${reportsSection(comment.id, reports, isZh)}
${verdictsSection(verdicts, isZh)}
${parentSection}
${repliesSection}
${siblingsSection}
${userRecentSection}
${auditSection(audit, isZh ? "此留言之稽核紀錄" : "Audit history for this comment", isZh)}
`;
};
