import { escapeHtml } from "../escape";

export type TelegramPageData = {
	/** TELEGRAM_BOT_TOKEN is set — outbound + interactive both need it. */
	configured: boolean;
	/** TELEGRAM_WEBHOOK_SECRET is set — required for inbound (buttons/commands). */
	webhookSecretSet: boolean;
	/** Bot @username (no @), if TELEGRAM_BOT_USERNAME is set — enables a deep link. */
	botUsername: string | null;
	/** The viewing admin's existing link, if any. */
	link: { linked_at: number; digest: boolean } | null;
};

const formatTs = (ts: number): string =>
	new Date(ts).toISOString().slice(0, 16).replace("T", " ");

const setupCard = (data: TelegramPageData, isZh: boolean = false): string => {
	const tokenPill = data.configured
		? `<span class="pill approved">${isZh ? "已設定" : "set"}</span>`
		: `<span class="pill spam">${isZh ? "未設定" : "missing"}</span>`;
	const secretPill = data.webhookSecretSet
		? `<span class="pill approved">${isZh ? "已設定" : "set"}</span>`
		: `<span class="pill pending">${isZh ? "未設定" : "missing"}</span>`;
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "機器人配置狀態" : "Bot configuration"}</h3>
  <p class="muted">
    ${
			isZh
				? "Telegram 維運機器人係透過 Worker Secrets 進行配置，而非在此面板。請參閱 <code>docs/telegram.md</code> 了解 BotFather 設定與 <code>setWebhook</code> 呼叫說明。"
				: "The Telegram operator bot is configured with Worker secrets, not in this panel. See <code>docs/telegram.md</code> for BotFather setup and the <code>setWebhook</code> call."
		}
  </p>
  <table>
    <tbody>
      <tr><td><code>TELEGRAM_BOT_TOKEN</code></td><td>${tokenPill}</td>
          <td class="muted">${isZh ? "用於發送通知以及支援互動按鈕與斜線指令。" : "Sends notifications + powers buttons and commands."}</td></tr>
      <tr><td><code>TELEGRAM_WEBHOOK_SECRET</code></td><td>${secretPill}</td>
          <td class="muted">${isZh ? "接收互動按鈕點擊與斜線指令所必需。" : "Required for inbound buttons / slash commands."}</td></tr>
    </tbody>
  </table>
  ${
		data.configured
			? ""
			: `<p style="color:var(--warn)">${
					isZh
						? "請在連結前先透過 <code>wrangler secret put TELEGRAM_BOT_TOKEN</code> 設定金鑰——在機器人能發送訊息給您之前，連結是無法運作的。"
						: "Set <code>TELEGRAM_BOT_TOKEN</code> via <code>wrangler secret put</code> before linking — linking is useless until the bot can message you."
				}</p>`
	}
</div>`;
};

const linkedCard = (data: TelegramPageData, isZh: boolean = false): string => {
	// data.link is non-null in this branch.
	const link = data.link as { linked_at: number; digest: boolean };
	return `
<div class="card" x-data="${escapeHtml(`{
  busy: false,
  digest: ${link.digest ? "true" : "false"},
  async toggleDigest() {
    if (this.busy) return;
    this.busy = true;
    const next = !this.digest;
    try {
      const r = await fetch('/admin/api/telegram/digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ digest: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('failed: ' + r.status));
      this.digest = next;
      this.$dispatch('toast', { text: next ? '${isZh ? "已開啟每日摘要" : "Daily digest on"}' : '${isZh ? "已關閉每日摘要" : "Daily digest off"}' });
    } catch (e) {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    } finally { this.busy = false; }
  },
  async unlink() {
    if (this.busy) return;
    if (!confirm('${isZh ? "確定要解除連動此 Telegram 帳號？您將停止接收維運通知，且無法再透過 Telegram 審核留言。" : "Unlink this Telegram account? You will stop receiving operator messages and can no longer moderate from Telegram."}')) return;
    this.busy = true;
    try {
      const r = await fetch('/admin/api/telegram/link', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('failed: ' + r.status));
      this.$dispatch('toast', { text: '${isZh ? "已解除 Telegram 帳號連動" : "Telegram account unlinked"}' });
      setTimeout(() => location.reload(), 300);
    } catch (e) {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    } finally { this.busy = false; }
  }
}`)}">
  <h3 style="margin-top:0">${isZh ? "您的已連動帳號" : "Your linked account"}</h3>
  <p class="muted">${
		isZh
			? `已於 ${formatTs(link.linked_at)} 連動。通知按鈕與斜線指令將以您的帳號及當前角色權限執行。`
			: `Linked ${formatTs(link.linked_at)}. Notification buttons and slash commands run under your account, with your current role.`
	}</p>
  <p>
    <label style="display:inline-flex;gap:0.4rem;align-items:center">
      <input type="checkbox" :checked="digest" :disabled="busy" @change="toggleDigest()">
      ${isZh ? "每日發送維運摘要通知給我" : "Send me the daily operator digest"}
    </label>
  </p>
  <p><button class="bad" :disabled="busy" @click="unlink()">${isZh ? "解除 Telegram 連動" : "Unlink Telegram"}</button></p>
</div>`;
};

const linkCard = (data: TelegramPageData, isZh: boolean = false): string => {
	const deepLinkJs = data.botUsername
		? `'https://t.me/${data.botUsername}?start=' + j.code`
		: "null";
	const instruction = data.botUsername
		? isZh
			? `點擊下方連結（或手動發送 <code>/start &lt;驗證碼&gt;</code> 給機器人）。`
			: `Tap the link below (or send <code>/start &lt;code&gt;</code> to the bot manually).`
		: isZh
			? `在 Telegram 中向您的機器人發送 <code>/start &lt;驗證碼&gt;</code>。驗證碼將在 10 分鐘後過期。`
			: `Send <code>/start &lt;code&gt;</code> to your bot in Telegram. The code expires in 10 minutes.`;
	return `
<div class="card" x-data="${escapeHtml(`{
  busy: false,
  code: null,
  deepLink: null,
  async generate() {
    if (this.busy) return;
    this.busy = true; this.code = null; this.deepLink = null;
    try {
      const r = await fetch('/admin/api/telegram/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('failed: ' + r.status));
      this.code = j.code;
      this.deepLink = ${deepLinkJs};
    } catch (e) {
      this.$dispatch('toast', { text: e.message, kind: 'bad' });
    } finally { this.busy = false; }
  }
}`)}">
  <h3 style="margin-top:0">${isZh ? "連動您的 Telegram 帳號" : "Link your Telegram account"}</h3>
  <p class="muted">${instruction}</p>
  <p><button :disabled="busy" @click="generate()">
    <span x-show="!busy">${isZh ? "產生連動驗證碼" : "Generate link code"}</span>
    <span x-show="busy">${isZh ? "正在產生…" : "Generating…"}</span>
  </button></p>
  <template x-if="code">
    <div>
      <p>${isZh ? "您的一次性驗證碼：" : "Your one-time code:"}
        <code x-text="code" style="user-select:all;font-size:1.1rem"></code>
      </p>
      <p x-show="deepLink">
        <a class="btn" :href="deepLink" target="_blank" rel="noopener">${isZh ? "在 Telegram 中開啟" : "Open in Telegram"}</a>
      </p>
    </div>
  </template>
</div>`;
};

export const renderTelegram = (data: TelegramPageData, isZh: boolean = false): string => {
	const linkSection = data.link ? linkedCard(data, isZh) : linkCard(data, isZh);
	return `
<p class="muted" style="margin-top:0">
  ${
		isZh
			? "連結 Telegram 帳號以接收維運通知並可直接從手機審核留言。通知係配置為具有 Telegram 適配器的 <a href=\"/admin/webhooks\">Webhook 端點</a>；本頁面則用於連結您的個人 Telegram 帳號，以使用互動按鈕、斜線指令以及選擇性的每日摘要通知。"
			: `Connect a Telegram account to receive operator notifications and moderate
  comments from your phone. Notifications are configured as a
  <a href="/admin/webhooks">webhook endpoint</a> with the Telegram adapter;
  this page links your personal account for interactive buttons, slash
  commands, and the optional daily digest.`
	}
</p>
${setupCard(data, isZh)}
${linkSection}`;
};
