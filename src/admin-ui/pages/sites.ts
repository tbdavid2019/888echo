/**
 * Sites Management admin page (Multi-Site Architecture).
 */
import type { SiteWithStats } from "../../db/queries";
import { escapeHtml, jsLiteral } from "../escape";

export type SitesPageOpts = {
	sites: SiteWithStats[];
	isZh: boolean;
};

export const renderSitesPage = (opts: SitesPageOpts): string => {
	const { sites, isZh } = opts;

	const titleText = isZh ? "站台系統管理" : "Sites Management";
	const descText = isZh
		? "管理獨立網域與站台設定。註冊之網域將自動獲得 CORS / Origin 白名單授權，各站同名文章 Slug 將自動隔離，留言與 Webhook 互不干擾。"
		: "Manage independent domains and site settings. Registered domains are dynamically authorized for CORS and cross-domain post slugs are isolated.";

	const addSiteBtn = isZh ? "+ 新增站台" : "+ Add Site";
	const noSitesText = isZh ? "尚未建立任何站台。" : "No registered sites yet.";

	const confirmPrefix = isZh ? "確定要刪除站台「" : 'Are you sure you want to delete site "';
	const confirmSuffix = isZh ? "」嗎？此操作無法還原。" : '"? This cannot be undone.';
	const deleteFailText = isZh ? "刪除失敗" : "Delete failed";
	const siteDeletedText = isZh ? "站台已刪除" : "Site deleted";
	const reqErrorText = isZh ? "網域與名稱為必填項目" : "Domain and Name are required";
	const conflictText = isZh ? "此網域已被註冊" : "Domain already registered";
	const updatedText = isZh ? "站台已更新" : "Site updated";
	const createdText = isZh ? "站台已建立" : "Site created";
	const opFailedText = isZh ? "操作失敗" : "Operation failed";
	const editModalHeading = isZh ? "編輯站台設定" : "Edit Site";
	const addModalHeading = isZh ? "新增站台" : "Add New Site";
	const savingText = isZh ? "儲存中..." : "Saving...";
	const saveBtnText = isZh ? "儲存站台" : "Save Site";

	const rows = sites.length
		? sites
				.map((s) => {
					const sJson = escapeHtml(JSON.stringify(s));
					const anonBadge = s.allow_anonymous
						? `<span class="pill approved">${isZh ? "允許匿名" : "Anonymous Allowed"}</span>`
						: `<span class="pill" style="border-color:var(--accent);color:var(--accent)">${isZh ? "僅限登入" : "Login Required"}</span>`;
					const autoCloseBadge =
						s.auto_close_days > 0
							? `<span class="muted">${s.auto_close_days} ${isZh ? "天後關閉" : "days"}</span>`
							: `<span class="muted">${isZh ? "預設" : "Default"}</span>`;
					return `
<tr>
  <td>
    <div style="font-weight:600;font-size:0.95rem;">${escapeHtml(s.name)}</div>
    ${s.description ? `<div class="muted" style="font-size:0.8rem;margin-top:2px;">${escapeHtml(s.description)}</div>` : ""}
  </td>
  <td>
    <code style="font-size:0.85rem;color:var(--accent);">${escapeHtml(s.domain)}</code>
  </td>
  <td>
    <span class="pill" style="font-size:0.75rem;">${escapeHtml(s.default_locale)}</span>
  </td>
  <td>${anonBadge}</td>
  <td>${autoCloseBadge}</td>
  <td>
    <span style="font-size:0.85rem;font-weight:500;">${s.post_count} ${isZh ? "篇" : "posts"}</span> /
    <span class="muted" style="font-size:0.85rem;">${s.comment_count} ${isZh ? "則" : "comments"}</span>
  </td>
  <td class="actions">
    <button type="button" class="btn" style="padding:0.25rem 0.55rem;font-size:0.8rem;" @click="editSite(${sJson})">${isZh ? "編輯" : "Edit"}</button>
    <button type="button" class="btn bad" style="padding:0.25rem 0.55rem;font-size:0.8rem;margin-left:4px;" @click="deleteSite(${jsLiteral(s.id)}, ${jsLiteral(s.name)})">${isZh ? "刪除" : "Delete"}</button>
  </td>
</tr>`;
				})
				.join("")
		: `<tr><td colspan="7" class="muted" style="text-align:center;padding:2rem;">${noSitesText}</td></tr>`;

	return `
<div class="card" x-data="{
  modalOpen: false,
  isEditing: false,
  busy: false,
  error: null,
  siteId: '',
  domain: '',
  name: '',
  description: '',
  default_locale: 'zh-Hant',
  allow_anonymous: true,
  auto_close_days: 0,
  openAdd() {
    this.isEditing = false;
    this.siteId = '';
    this.domain = '';
    this.name = '';
    this.description = '';
    this.default_locale = 'zh-Hant';
    this.allow_anonymous = true;
    this.auto_close_days = 0;
    this.error = null;
    this.modalOpen = true;
  },
  editSite(s) {
    this.isEditing = true;
    this.siteId = s.id;
    this.domain = s.domain;
    this.name = s.name;
    this.description = s.description || '';
    this.default_locale = s.default_locale || 'zh-Hant';
    this.allow_anonymous = !!s.allow_anonymous;
    this.auto_close_days = s.auto_close_days || 0;
    this.error = null;
    this.modalOpen = true;
  },
  async save() {
    if (!this.domain.trim() || !this.name.trim()) {
      this.error = ${jsLiteral(reqErrorText)};
      return;
    }
    this.busy = true;
    this.error = null;
    try {
      const payload = {
        domain: this.domain.trim(),
        name: this.name.trim(),
        description: this.description.trim() || null,
        default_locale: this.default_locale,
        allow_anonymous: this.allow_anonymous,
        auto_close_days: parseInt(this.auto_close_days, 10) || 0
      };
      const url = this.isEditing ? '/admin/api/sites/' + this.siteId : '/admin/api/sites';
      const method = this.isEditing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error || (r.status === 409 ? ${jsLiteral(conflictText)} : 'Save failed'));
      }
      this.$dispatch('toast', { text: this.isEditing ? ${jsLiteral(updatedText)} : ${jsLiteral(createdText)} });
      this.modalOpen = false;
      setTimeout(() => location.reload(), 300);
    } catch (err) {
      this.error = err.message || ${jsLiteral(opFailedText)};
    } finally {
      this.busy = false;
    }
  },
  async deleteSite(id, name) {
    if (!confirm(${jsLiteral(confirmPrefix)} + name + ${jsLiteral(confirmSuffix)})) return;
    try {
      const r = await fetch('/admin/api/sites/' + id, { method: 'DELETE' });
      if (!r.ok) throw new Error(${jsLiteral(deleteFailText)});
      this.$dispatch('toast', { text: ${jsLiteral(siteDeletedText)} });
      setTimeout(() => location.reload(), 300);
    } catch (err) {
      this.$dispatch('toast', { text: err.message, kind: 'bad' });
    }
  }
}">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem;">
    <div>
      <h2 style="margin:0;font-size:1.35rem;font-weight:700;">${titleText}</h2>
      <p class="muted" style="margin:0.35rem 0 0;font-size:0.875rem;">${descText}</p>
    </div>
    <button type="button" class="btn" style="background:var(--accent);color:var(--accent-fg);font-weight:600;flex-shrink:0;" @click="openAdd()">
      ${addSiteBtn}
    </button>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:1.25rem;">
    <thead>
      <tr>
        <th style="text-align:left;">${isZh ? "站台名稱" : "Site Name"}</th>
        <th style="text-align:left;">${isZh ? "主網域 (Domain)" : "Domain"}</th>
        <th style="text-align:left;">${isZh ? "預設語系" : "Default Locale"}</th>
        <th style="text-align:left;">${isZh ? "匿名發布" : "Anonymous"}</th>
        <th style="text-align:left;">${isZh ? "自動關閉" : "Auto Close"}</th>
        <th style="text-align:left;">${isZh ? "文章 / 留言" : "Posts / Comments"}</th>
        <th style="text-align:right;">${isZh ? "操作" : "Actions"}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Site Modal -->
  <div x-show="modalOpen" x-cloak style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:999;">
    <div @click.away="if (!busy) modalOpen = false" class="card" style="width:100%;max-width:520px;box-shadow:0 10px 25px rgba(0,0,0,0.2);margin:1rem;">
      <h3 style="margin-top:0;" x-text="isEditing ? ${jsLiteral(editModalHeading)} : ${jsLiteral(addModalHeading)}"></h3>
      
      <template x-if="error">
        <div style="background:var(--bad-bg, #fee2e2);color:var(--bad, #b91c1c);padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem;" x-text="error"></div>
      </template>

      <form @submit.prevent="save()">
        <div style="margin-bottom:1rem;">
          <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">
            ${isZh ? "站台主網域 (Domain)" : "Domain"} <span style="color:var(--bad);">*</span>
          </label>
          <input type="text" x-model="domain" placeholder="news.example.com" style="width:100%;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;" required>
          <small class="muted" style="font-size:0.75rem;display:block;margin-top:0.25rem;">
            ${isZh ? "僅輸入主機名稱即可（例如 news.david888.com），免輸 http:// 或路徑。" : "Enter hostname only (e.g. news.example.com) without protocol or path."}
          </small>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">
            ${isZh ? "站台名稱" : "Site Name"} <span style="color:var(--bad);">*</span>
          </label>
          <input type="text" x-model="name" placeholder="${isZh ? "888 快訊" : "My Tech Blog"}" style="width:100%;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;" required>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">
            ${isZh ? "站台描述 (選填)" : "Description (Optional)"}
          </label>
          <input type="text" x-model="description" placeholder="${isZh ? "官方新聞與即時動態" : "Main company blog"}" style="width:100%;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;">
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:1rem;margin-bottom:1rem;">
          <div>
            <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">
              ${isZh ? "預設語系" : "Default Locale"}
            </label>
            <select x-model="default_locale" style="width:100%;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;">
              <option value="zh-Hant">繁體中文 (zh-Hant)</option>
              <option value="en">English (en)</option>
              <option value="ja">日本語 (ja)</option>
              <option value="de">Deutsch (de)</option>
              <option value="fr">Français (fr)</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">
              ${isZh ? "自動關閉討論 (天)" : "Auto Close Days"}
            </label>
            <input type="number" min="0" x-model="auto_close_days" placeholder="0" style="width:100%;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;">
            <small class="muted" style="font-size:0.75rem;display:block;margin-top:0.25rem;">${isZh ? "0 代表依據全域設定" : "0 = use global default"}</small>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
            <input type="checkbox" x-model="allow_anonymous">
            <span>${isZh ? "允許訪客免登入發表留言（需通過 Turnstile 驗證）" : "Allow anonymous comments (guarded by Turnstile)"}</span>
          </label>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.75rem;">
          <button type="button" class="btn" :disabled="busy" @click="modalOpen = false">${isZh ? "取消" : "Cancel"}</button>
          <button type="submit" class="btn" style="background:var(--accent);color:var(--accent-fg);font-weight:600;" :disabled="busy" x-text="busy ? ${jsLiteral(savingText)} : ${jsLiteral(saveBtnText)}"></button>
        </div>
      </form>
    </div>
  </div>
</div>`;
};
