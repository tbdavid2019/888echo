/**
 * Saved Replies admin page — canned moderator responses.
 */
import type { SavedReply, User } from "../../db/queries";
import { escapeHtml, jsLiteral } from "../escape";
import { REPLY_VARS_HINT } from "../components/reply-vars";

const formatTs = (ts: number): string =>
	new Date(ts).toISOString().slice(0, 16).replace("T", " ");

const ownerCell = (
	reply: SavedReply,
	viewer: User,
	ownerName: string | null,
	isZh: boolean = false,
): string => {
	if (reply.owner_id === viewer.id) return `<span class="muted">${isZh ? "您" : "you"}</span>`;
	return ownerName ? escapeHtml(ownerName) : `<span class="muted">${isZh ? "已刪除使用者" : "deleted user"}</span>`;
};

const scopePill = (scope: SavedReply["scope"], isZh: boolean = false): string =>
	scope === "shared"
		? `<span class="pill approved">${isZh ? "公開共用" : "shared"}</span>`
		: `<span class="pill" style="border-color:var(--accent);color:var(--accent)">${isZh ? "私人專用" : "private"}</span>`;

const replyRow = (
	reply: SavedReply,
	viewer: User,
	ownerName: string | null,
	isZh: boolean = false,
): string => {
	const mine = reply.owner_id === viewer.id;
	return `
<tr>
  <td>
    <div><strong>${escapeHtml(reply.title)}</strong></div>
    <div class="muted" style="font-size:0.75rem">${isZh ? "更新於 " : "updated "}${formatTs(reply.updated_at)}</div>
  </td>
  <td>${scopePill(reply.scope, isZh)}</td>
  <td>${ownerCell(reply, viewer, ownerName, isZh)}</td>
  <td class="actions">
    ${mine ? `<a href="/admin/saved-replies/${escapeHtml(reply.id)}" class="btn">${isZh ? "編輯" : "Edit"}</a>` : `<span class="muted">${isZh ? "唯讀" : "read-only"}</span>`}
  </td>
</tr>`;
};

export const renderSavedRepliesList = (
	replies: SavedReply[],
	viewer: User,
	ownersById: Map<string, string>,
	isZh: boolean = false,
): string => {
	const rows = replies.length
		? replies
				.map((r) => replyRow(r, viewer, ownersById.get(r.owner_id) ?? null, isZh))
				.join("")
		: `<tr><td colspan="4" class="muted">${isZh ? "尚無快捷回覆。" : "No saved replies yet."}</td></tr>`;
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "快捷回覆列表" : "Saved replies"}</h3>
  <p class="muted">
    ${isZh ? "預先撰寫的回覆範本，可在審核佇列中快速套用。標記為<strong>公開共用</strong>的回覆對所有審核員與管理員可見；<strong>私人專用</strong>僅對您個人可見。支援 Markdown 格式。" : "Pre-written replies you (or your team) can drop into the moderation queue. Mark a reply as <strong>shared</strong> to make it visible to every mod and admin; <strong>private</strong> replies are visible only to you. Markdown goes through the same sanitizer as comment bodies; raw HTML is stripped."}
  </p>
  <p><a href="/admin/saved-replies/new" class="btn">+ ${isZh ? "新增快捷回覆" : "New saved reply"}</a></p>
  <table>
    <thead><tr>
      <th>${isZh ? "標題" : "Title"}</th>
      <th>${isZh ? "可見範圍" : "Scope"}</th>
      <th>${isZh ? "建立者" : "Owner"}</th>
      <th>${isZh ? "操作" : "Actions"}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
};

export const renderSavedReplyForm = (
	opts: {
		existing: SavedReply | null;
		error: string | null;
	},
	isZh: boolean = false,
): string => {
	const e = opts.existing;
	const action = e
		? `/admin/api/saved-replies/${e.id}`
		: `/admin/api/saved-replies`;
	const method = e ? "PATCH" : "POST";
	const heading = e ? (isZh ? "編輯快捷回覆" : "Edit saved reply") : (isZh ? "新增快捷回覆" : "New saved reply");
	const errorBanner = opts.error
		? `<div class="card" style="border-left:3px solid var(--bad)"><strong>${isZh ? "錯誤：" : "Error:"}</strong> ${escapeHtml(opts.error)}</div>`
		: "";
	const title = e?.title ?? "";
	const body = e?.body_md ?? "";
	const scope = e?.scope ?? "private";
	const deleteButton = e
		? `
<button type="button" class="bad" :disabled="busy"
        @click="del(${jsLiteral(e.id)})">${isZh ? "刪除此快捷回覆" : "Delete saved reply"}</button>`
		: "";
	return `
${errorBanner}
<div class="card" x-data="{
  busy: false,
  async submit(form) {
    this.busy = true;
    try {
      const body = {
        title: form.title.value,
        body_md: form.body_md.value,
        scope: form.scope.value,
      };
      const r = await fetch(${jsLiteral(action)}, {
        method: ${jsLiteral(method)},
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || ('Save failed: ' + r.status));
      }
      this.$dispatch('toast', { text: '${isZh ? "已儲存" : "Saved"}' });
      setTimeout(() => location.href = '/admin/saved-replies', 300);
    } catch (err) {
      this.$dispatch('toast', { text: err.message || '${isZh ? "儲存失敗" : "Save failed"}', kind: 'bad' });
      this.busy = false;
    }
  },
  async del(id) {
    if (!confirm('${isZh ? "確定要刪除此快捷回覆嗎？" : "Delete this saved reply?"}')) return;
    this.busy = true;
    try {
      const r = await fetch('/admin/api/saved-replies/' + id, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || ('Delete failed: ' + r.status));
      }
      this.$dispatch('toast', { text: '${isZh ? "已刪除" : "Deleted"}' });
      setTimeout(() => location.href = '/admin/saved-replies', 300);
    } catch (err) {
      this.$dispatch('toast', { text: err.message || '${isZh ? "刪除失敗" : "Delete failed"}', kind: 'bad' });
      this.busy = false;
    }
  },
}">
  <h3 style="margin-top:0">${heading}</h3>
  <form @submit.prevent="submit($event.target)">
    <p>
      <label>${isZh ? "標題" : "Title"}<br>
        <input type="text" name="title" required maxlength="120"
               value="${escapeHtml(title)}" style="width:100%;max-width:480px">
      </label>
    </p>
    <p>
      <label>${isZh ? "回覆內容 (Markdown)" : "Body (markdown)"}<br>
        <textarea name="body_md" required rows="10"
                  maxlength="8000" style="width:100%;min-height:160px;font-family:ui-monospace,monospace">${escapeHtml(body)}</textarea>
      </label>
      <span class="muted" style="font-size:0.75rem">${escapeHtml(REPLY_VARS_HINT)}</span>
    </p>
    <p>
      <label>${isZh ? "可見範圍" : "Scope"}<br>
        <select name="scope">
          <option value="private"${scope === "private" ? " selected" : ""}>${isZh ? "私人專用 — 僅限您個人" : "Private — only you"}</option>
          <option value="shared"${scope === "shared" ? " selected" : ""}>${isZh ? "公開共用 — 所有審核員與管理員" : "Shared — all mods + admins"}</option>
        </select>
      </label>
    </p>
    <p>
      <button type="submit" :disabled="busy">${isZh ? "儲存" : "Save"}</button>
      ${deleteButton}
      <a href="/admin/saved-replies" class="btn">${isZh ? "取消" : "Cancel"}</a>
    </p>
  </form>
</div>`;
};
