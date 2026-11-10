/**
 * Moderator notes card, shared by the comment-detail and user-detail pages.
 *
 * Internal context on one target: what a mod wants to write down when there
 * is no action to take yet. Every mod on the instance sees every note, and
 * no reader ever does — see 0023_moderator_notes.sql for why that is a table
 * of its own rather than more `audit_log.reason`.
 *
 * The list is server-rendered and a successful write reloads, which is how
 * every other mutating surface in this admin behaves. Rendering it from an
 * Alpine array instead would make the notes — the one thing on the page a
 * moderator is meant to *read* before acting — vanish whenever the CDN
 * carrying Alpine has a bad day.
 */
import type { ModeratorNoteWithAuthor } from "../../db/queries";
import { escapeHtml, jsLiteral } from "../escape";

const formatTs = (ts: number): string =>
	new Date(ts).toISOString().slice(0, 16).replace("T", " ");

// Mirrors NOTE_BODY_MAX in routes/admin.ts, the same way reply-composer.ts
// mirrors SAVED_REPLY_BODY_MAX: admin-ui is downstream of that module, so
// importing the constant back would close a cycle. It only feeds the
// textarea's `maxlength`; the server rejects an over-long body regardless.
const NOTE_BODY_MAX = 4000;

export type ModeratorNotesOptions = {
	target_kind: "comment" | "user";
	target_id: string;
	notes: ModeratorNoteWithAuthor[];
	/** Signed-in moderator; decides which delete buttons render. */
	viewerId: string;
	/** Admins can strike any note, not only their own. */
	viewerIsAdmin: boolean;
	isZh?: boolean;
};

const noteRow = (
	n: ModeratorNoteWithAuthor,
	canDelete: boolean,
	isZh: boolean = false,
): string => `
<li class="note">
  <div class="note-meta muted">
    <strong>${escapeHtml(n.author_name ?? n.author_id)}</strong>
    · ${formatTs(n.created_at)}
    ${
			canDelete
				? `<button type="button" class="btn bad note-del"
              :disabled="busy" @click="remove(${jsLiteral(n.id)})">${isZh ? "刪除" : "Delete"}</button>`
				: ""
		}
  </div>
  <div class="note-body">${escapeHtml(n.body)}</div>
</li>`;

export const moderatorNotes = (o: ModeratorNotesOptions): string => {
	const isZh = o.isZh ?? false;
	const rows = o.notes
		.map((n) =>
			noteRow(n, o.viewerIsAdmin || n.author_id === o.viewerId, isZh),
		)
		.join("");
	const list = o.notes.length
		? `<ul class="note-list">${rows}</ul>`
		: `<p class="muted">${
				isZh
					? "尚無任何備忘筆記。此處內容僅全體審核員可見，其他任何人均無法存取。"
					: "No notes yet. Anything written here is visible to every moderator and to no one else."
			}</p>`;
	return `
<div class="card" x-data="{
  body: '',
  busy: false,
  add() {
    if (this.busy || !this.body.trim()) return;
    this.busy = true;
    return fetch('/admin/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        target_kind: ${jsLiteral(o.target_kind)},
        target_id: ${jsLiteral(o.target_id)},
        body: this.body,
      }),
    }).then(r => {
      if (!r.ok) throw new Error('${isZh ? "無法儲存筆記: " : "Could not save the note: "}' + r.status);
      this.$dispatch('toast', { text: '${isZh ? "筆記已新增" : "Note added"}' });
      setTimeout(() => location.reload(), 600);
    }).catch(e => {
      this.busy = false;
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    });
  },
  remove(id) {
    if (this.busy || !confirm(${jsLiteral(isZh ? "確定要刪除此筆記？" : "Delete this note?")})) return;
    this.busy = true;
    return fetch('/admin/api/notes/' + id, { method: 'DELETE' }).then(r => {
      if (!r.ok) throw new Error('${isZh ? "無法刪除筆記: " : "Could not delete the note: "}' + r.status);
      this.$dispatch('toast', { text: '${isZh ? "筆記已刪除" : "Note deleted"}' });
      setTimeout(() => location.reload(), 600);
    }).catch(e => {
      this.busy = false;
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    });
  }
}">
  <h3>${isZh ? `審核備忘筆記 (${o.notes.length})` : `Moderator notes (${o.notes.length})`}</h3>
  <p class="muted" style="margin:0 0 0.5rem">
    ${
			isZh
				? "僅限審核團隊內部檢視——絕不會顯示給留言者，為純文字格式而非 Markdown。"
				: "Internal to the moderation team — never shown to the commenter, and plain text, not markdown."
		}
  </p>
  ${list}
  <label style="display:block;margin-top:0.5rem">${isZh ? "新增筆記" : "Add a note"}<br>
    <textarea x-model="body" rows="3" maxlength="${NOTE_BODY_MAX}"
              placeholder="${isZh ? "為下一位接手審核者留下交接脈絡…" : "Context for whoever picks this up next…"}"
              style="width:100%;font-family:inherit"></textarea>
  </label>
  <p style="margin-top:0.5rem">
    <button :disabled="busy || !body.trim()" @click="add()">${isZh ? "新增筆記" : "Add note"}</button>
  </p>
</div>`;
};
