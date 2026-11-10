import type { WebhookEndpoint } from "../../db/queries";
import { escapeHtml, jsLiteral, jsLiteralRaw } from "../escape";

const formatTs = (ts: number | null): string =>
	ts == null ? "—" : new Date(ts).toISOString().slice(0, 16).replace("T", " ");

const ALL_EVENTS = [
	"comment.posted",
	"comment.edited",
	"comment.deleted",
	"comment.approved",
	"comment.spam",
	"comment.reported",
] as const;

const getAdapters = (isZh: boolean): Array<{ value: string; label: string }> => [
	{ value: "generic", label: isZh ? "通用 JSON (v1 協定)" : "Generic JSON (v1 contract)" },
	{ value: "slack", label: isZh ? "Slack Incoming Webhook" : "Slack incoming webhook" },
	{ value: "discord", label: isZh ? "Discord Webhook" : "Discord webhook" },
	{ value: "telegram", label: isZh ? "Telegram 機器人 (URL 欄位填入聊天室 ID)" : "Telegram bot (chat id in URL field)" },
];

const endpointRow = (e: WebhookEndpoint, isZh: boolean = false): string => {
	const eventsLabel = e.events == null
		? (isZh ? "所有事件" : "all events")
		: e.events.join(", ");
	const signedPill = e.secret
		? `<span class="pill approved">${isZh ? "已簽章" : "signed"}</span>`
		: `<span class="pill pending">${isZh ? "未簽章" : "unsigned"}</span>`;
	const statusPill = e.enabled
		? `<span class="pill approved">${isZh ? "已啟用" : "enabled"}</span>`
		: `<span class="pill spam">${isZh ? "已停用" : "disabled"}</span>`;
	const autoDisableNote = e.disabled_at
		? `<div class="muted" style="font-size:0.75rem">${
				isZh
					? `於 ${formatTs(e.disabled_at)} 連續失敗 ${e.fail_count} 次後自動暫停`
					: `auto-paused ${formatTs(e.disabled_at)} after ${e.fail_count} fails`
			}</div>`
		: "";
	return `
<tr x-data="{ busy: false, enabled: ${e.enabled} }">
  <td>
    <div><code>${escapeHtml(e.url)}</code></div>
    <div class="muted" style="font-size:0.75rem">${escapeHtml(eventsLabel)} · ${escapeHtml(e.adapter)}</div>
    ${autoDisableNote}
  </td>
  <td>${signedPill}</td>
  <td><template x-if="enabled">${statusPill}</template>
      <template x-if="!enabled"><span class="pill spam">${isZh ? "已停用" : "disabled"}</span></template></td>
  <td class="muted">${formatTs(e.created_at)}</td>
  <td class="actions">
    <a href="/admin/webhooks/${escapeHtml(e.id)}" class="btn">${isZh ? "編輯" : "Edit"}</a>
    <button :disabled="busy" class="bad" @click="busy=true; del(${jsLiteral(e.id)}).finally(()=>busy=false)">${isZh ? "刪除" : "Delete"}</button>
  </td>
</tr>`;
};

const eventChecklist = (selected: ReadonlySet<string>): string =>
	ALL_EVENTS.map(
		(ev) => `
<label style="display:inline-flex;gap:0.3rem;align-items:center;margin-right:0.8rem">
  <input type="checkbox" name="event_${ev}" ${selected.has(ev) ? "checked" : ""}> ${escapeHtml(ev)}
</label>`,
	).join("");

const adapterSelect = (selected: string, isZh: boolean = false): string =>
	getAdapters(isZh).map(
		(a) =>
			`<option value="${escapeHtml(a.value)}"${a.value === selected ? " selected" : ""}>${escapeHtml(a.label)}</option>`,
	).join("");

export const renderWebhooksList = (
	endpoints: WebhookEndpoint[],
	envShim: { active: boolean; url: string },
	isZh: boolean = false,
): string => {
	const rows = endpoints.length
		? endpoints.map((e) => endpointRow(e, isZh)).join("")
		: `<tr><td colspan="5" class="muted">${isZh ? "尚未配置任何 Webhook 端點。" : "No webhook endpoints configured yet."}</td></tr>`;
	const envBanner = envShim.active
		? `
<div class="card" style="border-left:3px solid var(--warn)">
  <p>
    <strong>${isZh ? "正使用舊版 <code>WEBHOOK_URL</code>" : "Legacy <code>WEBHOOK_URL</code> in use"}</strong> —
    ${
			isZh
				? `<code>${escapeHtml(envShim.url)}</code> 正在作為無簽章、無重試機制的端點進行投遞。請在下方新增正式端點（附帶 HMAC 金鑰）並移除環境變數，以獲得簽章防護與自動重試功能。`
				: `<code>${escapeHtml(envShim.url)}</code> is being delivered to as an unsigned, retry-less endpoint. Add a real endpoint below (with an HMAC secret) and remove the env var to gain signing + automatic retries.`
		}
  </p>
</div>`
		: "";
	return `
<div x-data="{
  del(id) {
    if (!confirm('${isZh ? "確定要刪除此 Webhook 端點？進行中的重試將被取消。" : "Delete this webhook endpoint? Pending retries will be cancelled."}')) return Promise.resolve();
    return fetch('/admin/api/webhooks/' + id, { method: 'DELETE', headers: { 'content-type': 'application/json' } })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || ('${isZh ? "刪除失敗: " : "delete failed: "}' + r.status));
        }
        this.$dispatch('toast', { text: '${isZh ? "端點已刪除" : "Endpoint deleted"}' });
        setTimeout(() => location.reload(), 300);
      })
      .catch(e => { this.$dispatch('toast', { text: e.message, kind: 'bad' }); });
  }
}">
${envBanner}
<div class="card">
  <h3 style="margin-top:0">${isZh ? "Webhook 端點清單" : "Webhook endpoints"}</h3>
  <p class="muted">
    ${
			isZh
				? "每個啟用的端點在發生相符事件時均會收到 POST 請求。具備 HMAC 金鑰的端點會帶有 <code>X-Garrul-Signature</code> 標頭；接收端在正式環境中應拒絕無簽章之投遞。失敗的投遞將以指數退避演算法重試約 9 小時；若連續失敗 10 次將自動暫停端點。"
				: `Each enabled endpoint receives a POST per matching event. Endpoints
    with an HMAC secret get an <code>X-Garrul-Signature</code> header;
    receivers should reject unsigned deliveries in production. Failed
    deliveries are retried with exponential backoff for ~9 hours before
    the row is given up; an endpoint that gives up 10 deliveries in a
    row is auto-paused.`
		}
  </p>
  <p><a href="/admin/webhooks/new" class="btn">${isZh ? "+ 新增端點" : "+ Add endpoint"}</a></p>
  <table>
    <thead><tr><th>URL</th><th>${isZh ? "已簽章" : "Signed"}</th><th>${isZh ? "狀態" : "Status"}</th><th>${isZh ? "建立時間" : "Created"}</th><th>${isZh ? "操作" : "Actions"}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
</div>`;
};

export type WebhookFormData = {
	endpoint: WebhookEndpoint | null; // null = new
	error: string | null;
};

export const renderWebhookForm = (data: WebhookFormData, isZh: boolean = false): string => {
	const e = data.endpoint;
	const isNew = e == null;
	const selectedEvents = new Set<string>(e?.events ?? ALL_EVENTS);
	const url = e?.url ?? "";
	const hasSecret = e?.secret != null && e.secret !== "";
	const adapter = e?.adapter ?? "generic";
	const enabled = e?.enabled ?? true;
	const heading = isNew
		? (isZh ? "新增 Webhook 端點" : "Add webhook endpoint")
		: (isZh ? "編輯 Webhook 端點" : "Edit webhook endpoint");
	const action = isNew
		? "/admin/api/webhooks"
		: `/admin/api/webhooks/${e.id}`;
	const errorBlock = data.error
		? `<p style="color:var(--bad)">${escapeHtml(data.error)}</p>`
		: "";
	const submitLabel = isNew
		? (isZh ? "建立端點" : "Create endpoint")
		: (isZh ? "儲存變更" : "Save changes");
	return `
<a href="/admin/webhooks" class="muted">${isZh ? "← 返回 Webhook 清單" : "← back to webhooks"}</a>
<div class="card" x-data="${escapeHtml(`{
  busy: false,
  rotate: false,
  error: ${data.error == null ? "null" : jsLiteralRaw(data.error)},
  async submit(e) {
    e.preventDefault();
    if (this.busy) return;
    this.busy = true; this.error = null;
    const form = new FormData(e.target);
    const events = ${JSON.stringify(ALL_EVENTS)}.filter(ev => form.get('event_' + ev));
    const body = {
      url: form.get('url'),
      events: events.length === ${ALL_EVENTS.length} ? null : events,
      adapter: form.get('adapter'),
      enabled: form.get('enabled') === 'on',
    };
    const typed = form.get('secret');
    if (form.get('clear_secret')) body.secret = null;
    else if (typed) body.secret = typed;
    try {
      const r = await fetch(${jsLiteralRaw(action)}, {
        method: ${jsLiteralRaw(isNew ? "POST" : "PATCH")},
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('${isZh ? "儲存失敗: " : "save failed: "}' + r.status));
      this.$dispatch('toast', { text: '${isZh ? "端點已儲存" : "Endpoint saved"}' });
      setTimeout(() => location.href = '/admin/webhooks', 300);
    } catch (err) {
      this.error = err.message;
    } finally {
      this.busy = false;
    }
  }
}`)}">
  <h3 style="margin-top:0">${heading}</h3>
  ${errorBlock}
  <p x-show="error" style="color:var(--bad)" x-text="error"></p>
  <form @submit="submit">
    <p>
      <label>URL<br>
        <input type="text" name="url" required value="${escapeHtml(url)}"
          placeholder="https://example.com/webhooks/garrul"
          style="width:100%;max-width:560px">
      </label>
      <span class="muted" style="display:block;font-size:0.8rem">
        ${
					isZh
						? "若使用 <strong>Telegram</strong> 適配器，請在此輸入目標 <code>聊天室 ID (chat id)</code>（例如 <code>-1001234567890</code> 或 <code>@yourchannel</code>）——而非網址。機器人 Token 來自 <code>TELEGRAM_BOT_TOKEN</code> 金鑰。"
						: `For the <strong>Telegram</strong> adapter, put the destination
        <code>chat id</code> here (e.g. <code>-1001234567890</code> or
        <code>@yourchannel</code>) — not a URL. The bot token comes from the
        <code>TELEGRAM_BOT_TOKEN</code> secret.`
				}
      </span>
    </p>
    ${
			hasSecret
				? `<div style="margin:1rem 0">
      ${isZh ? "HMAC 金鑰：" : "HMAC secret: "} <span class="pill approved">${isZh ? "已設定" : "set"}</span>
      <button type="button" class="btn" @click="rotate = !rotate"
        x-text="rotate ? '${isZh ? "取消更換" : "cancel rotation"}' : '${isZh ? "更換金鑰…" : "rotate…"}'"></button>
      <label style="margin-left:0.75rem;font-weight:normal">
        <input type="checkbox" name="clear_secret"> ${isZh ? "移除簽章" : "remove signing"}
      </label>
      <div x-show="rotate" x-cloak style="margin-top:0.4rem">
        <input type="password" name="secret" autocomplete="new-password"
          placeholder="${isZh ? "新金鑰，16–256 字元" : "new secret, 16–256 characters"}"
          style="width:100%;max-width:560px">
      </div>
      <span class="muted" style="display:block;font-size:0.8rem">
        ${
					isZh
						? "儲存的金鑰為僅供寫入——絕不會回傳顯示於瀏覽器中。保持原樣即保留現有金鑰。更換金鑰會立即讓舊簽章失效，請在更換前先與接收端協調。"
						: `The stored secret is write-only — it is never rendered back to the
        browser. Leave this alone to keep it. Rotating invalidates the old
        signature immediately, so coordinate with the receiver before changing
        it on a live endpoint.`
				}
      </span>
    </div>`
				: `<p>
      <label>${isZh ? "HMAC 金鑰 (建議使用)" : "HMAC secret (recommended)"}<br>
        <input type="password" name="secret" autocomplete="new-password"
          placeholder="whsec_… (16–256 characters)"
          style="width:100%;max-width:560px">
      </label>
      <span class="muted" style="display:block;font-size:0.8rem">
        ${
					isZh
						? "留空則發送未簽章請求。儲存後金鑰為僅供寫入：表單可供更換或移除，但絕不會再次顯示——請自行備份留存於接收端。"
						: `Leave blank to send unsigned. Once saved the secret is write-only: the
        form will offer to rotate or remove it, but never show it again — keep
        your own copy for the receiving end.`
				}
      </span>
    </p>`
		}
    <p>
      <label>${isZh ? "適配器 (Adapter)" : "Adapter"}<br>
        <select name="adapter">${adapterSelect(adapter, isZh)}</select>
      </label>
    </p>
    <p>
      ${isZh ? "觸發事件：" : "Events:"}<br>
      ${eventChecklist(selectedEvents)}
      <span class="muted" style="display:block;font-size:0.8rem">
        ${isZh ? "勾選所有項目 = 不過濾（符合所有事件）。" : "All boxes checked = no filter (every event matches)."}
      </span>
    </p>
    <p>
      <label>
        <input type="checkbox" name="enabled" ${enabled ? "checked" : ""}>
        ${isZh ? "已啟用" : "Enabled"}
      </label>
    </p>
    <button :disabled="busy" type="submit">
      <span x-show="!busy">${submitLabel}</span>
      <span x-show="busy">${isZh ? "正在儲存…" : "Saving…"}</span>
    </button>
  </form>
</div>`;
};
