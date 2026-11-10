import type { RerenderStats } from "../../db/rerender";
import type { RetentionStats } from "../../db/ip-retention";
import { MIN_RETENTION_DAYS } from "../../db/ip-retention";
import type { AuditRetentionStats } from "../../db/audit-retention";
import { MIN_AUDIT_RETENTION_DAYS } from "../../db/audit-retention";
import { MAX_IMPORT_BYTES } from "../../lib/import/core";

export type OperatorData = {
	rerender: RerenderStats;
	retention: RetentionStats;
	audit_retention: AuditRetentionStats;
	seed_demo_allowed: boolean;
};

// Human-readable form of the shared import cap for the UI hint + client
// error message. Whole MB by construction (MAX_IMPORT_BYTES is N * 1024²).
const MAX_IMPORT_MB = Math.floor(MAX_IMPORT_BYTES / (1024 * 1024));

// Always-shown tail of the retention card. The ghost count is the honest part:
// retention covers two of the three places an ip_hash lands, and an operator
// reading "IP retention: 90 days" would otherwise reasonably assume an export
// carries no hashes older than that. It does — for anonymous identities, which
// are never expired on a timer because that column *is* the identity.
const ghostNote = (ghosts: number, isZh: boolean = false): string =>
	isZh
		? `
  <p class="muted">訪客匿名幽靈身份：<strong>${ghosts}</strong>。
    此身份<strong>永不被定時清除</strong> — 對於未登入訪客而言，加鹽雜湊 IP 即代表其帳號（用於讓回訪者查看自身留言並維持黑名單懲罰）。如需個別清除，可至使用者頁面點擊「抹除個人資料」，或參見運維文件 <code>AGENTS-OPERATE.md</code> §11。</p>`
		: `
  <p class="muted">Anonymous ghost identities: <strong>${ghosts}</strong>.
    These are <em>never</em> swept — for a signed-out visitor the hashed IP
    <em>is</em> the account (it's how a returning visitor finds their own
    comments, and how a ghost ban keeps applying), so expiring it would delete
    accounts rather than hashes. Clear them per-person from a user's page
    ("Erase personal data"), or all at once with the purge runbook in
    <code>AGENTS-OPERATE.md</code> §11 if the hashing secret ever leaks.</p>`;

const retentionCard = (r: RetentionStats, isZh: boolean = false): string => {
	if (!r.enabled) {
		const reason =
			r.retention_days === 0
				? (isZh
						? `未開啟。已存儲的雜湊將永久保留於資料列中。`
						: `Off. Stored hashes are kept for the life of the row.`)
				: (isZh
						? `設定為 <code>${r.retention_days}</code> 天，低於 ${MIN_RETENTION_DAYS} 天下限 — 系統暫停執行以防止筆誤誤刪。請提升至 ${MIN_RETENTION_DAYS} 天以上，或設為 0 以完全關閉。`
						: `Set to <code>${r.retention_days}</code> day(s), which is below the
	     ${MIN_RETENTION_DAYS}-day floor — the sweep refuses to run rather than
	     purge nearly everything on a typo. Raise it to ${MIN_RETENTION_DAYS} or
	     more, or set it to 0 to turn retention off deliberately.`);
		return `
<div class="card">
  <h3>${isZh ? "IP 雜湊保留政策" : "IP-hash retention"}</h3>
  <p class="muted">${reason}
    ${isZh ? '可至 <a href="/admin/settings">系統設定</a> 調整（或透過 <code>IP_HASH_RETENTION_DAYS</code>）。' : 'Change it on <a href="/admin/settings">Settings</a> (or via <code>IP_HASH_RETENTION_DAYS</code>).'}</p>
  <p class="muted">${isZh ? "目前保有雜湊 IP 之留言數：" : "Comments currently holding a hashed IP:"}
    <strong>${r.comments_total}</strong>。</p>
  ${ghostNote(r.ghosts_total, isZh)}
</div>`;
	}

	const pending = r.comments_pending + r.reports_pending;
	const confirmMsg = isZh
		? `確定要清除早於 ${r.retention_days} 天的 IP 雜湊嗎？此操作不可還原。`
		: `Clear stored IP hashes older than ${r.retention_days} days? This cannot be undone.`;
	return `
<div class="card" x-data="{
  busy: false,
  comments: 0,
  reports: 0,
  done: false,
  error: null,
  step(first) {
    if (this.busy) return;
    if (first &amp;&amp; !confirm('${confirmMsg}')) return;
    this.busy = true; this.error = null;
    return fetch('/admin/api/ops/ip-retention', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      this.comments += j.comments;
      this.reports += j.reports;
      this.busy = false;
      if (j.more) return this.step(false);
      this.done = true;
    }).catch(e => { this.error = e.message; this.busy = false; });
  }
}">
  <h3>${isZh ? "IP 雜湊保留政策" : "IP-hash retention"}</h3>
  <p class="muted">${isZh ? `保留窗口：<strong>${r.retention_days}</strong> 天。Cron 排程會自動定時清理；此按鈕可立即清除積壓資料。<strong>此操作不可逆</strong> — 清除後無法重構雜湊。` : `Window: <strong>${r.retention_days}</strong> days. The cron sweeps automatically; this button just drains the backlog now instead of over the next few ticks. <strong>Irreversible</strong> — nothing reconstructs a cleared hash.`}</p>
  <p class="muted">${isZh ? `目前超過保留窗口 — 留言：<strong>${r.comments_pending}</strong> · 檢舉：<strong>${r.reports_pending}</strong>。` : `Past the window right now — comments: <strong>${r.comments_pending}</strong> · reports: <strong>${r.reports_pending}</strong>.`}</p>
  ${
		pending > 0
			? `<button :disabled="busy" @click="step(true)">
    <span x-show="!busy &amp;&amp; !done">${isZh ? "立即清理" : "Sweep now"}</span>
    <span x-show="busy">${isZh ? "清理中…" : "Sweeping…"}</span>
    <span x-show="!busy &amp;&amp; done">${isZh ? "完成" : "Done"}</span>
  </button>
  <div class="muted" style="margin-top:0.5rem" x-show="comments || reports">
    ${isZh ? '已清理 <span x-text="comments"></span> 則留言 · <span x-text="reports"></span> 則檢舉' : 'Cleared <span x-text="comments"></span> comment(s) · <span x-text="reports"></span> report(s)'}
  </div>
  <p style="color:var(--bad)" x-show="error" x-text="error"></p>`
			: `<p class="muted">${isZh ? "無需處理 — 排程已清理所有超出窗口的資料。" : "Nothing to do — the cron has already swept everything past the window."}</p>`
	}
  ${ghostNote(r.ghosts_total, isZh)}
</div>`;
};

const auditRetentionCard = (r: AuditRetentionStats, isZh: boolean = false): string => {
	// The oldest surviving row is the number that makes the setting concrete: an
	// operator deciding on a window wants to know they're sitting on four years
	// of history, not just that the table has 12,000 rows in it.
	const oldest =
		r.oldest === null
			? `<p class="muted">${isZh ? "稽核日誌目前為空。" : "The audit log is empty."}</p>`
			: `<p class="muted">${isZh ? `紀錄總數：<strong>${r.total}</strong>，最早紀錄日期：<strong>${new Date(r.oldest).toISOString().slice(0, 10)}</strong>。` : `Rows: <strong>${r.total}</strong>, oldest dated <strong>${new Date(r.oldest).toISOString().slice(0, 10)}</strong>.`}</p>`;

	if (!r.enabled) {
		const reason =
			r.retention_days === 0
				? (isZh
						? `未開啟。審核操作歷史將永久保留。`
						: `Off. Moderation history is kept indefinitely.`)
				: (isZh
						? `設定為 <code>${r.retention_days}</code> 天，低於 ${MIN_AUDIT_RETENTION_DAYS} 天下限 — 系統暫停執行以防筆誤清除歷史。請提升至 ${MIN_AUDIT_RETENTION_DAYS} 天以上，或設為 0 以完全保留。`
						: `Set to <code>${r.retention_days}</code> day(s), which is below the
	     ${MIN_AUDIT_RETENTION_DAYS}-day floor — the sweep refuses to run rather
	     than shred months of moderation history on a typo. Raise it to
	     ${MIN_AUDIT_RETENTION_DAYS} or more, or set it to 0 to keep everything
	     deliberately.`);
		return `
<div class="card">
  <h3>${isZh ? "稽核日誌保留政策" : "Audit-log retention"}</h3>
  <p class="muted">${reason}
    ${isZh ? '可至 <a href="/admin/settings">系統設定</a> 調整（或透過 <code>AUDIT_LOG_RETENTION_DAYS</code>）。' : 'Change it on <a href="/admin/settings">Settings</a> (or via <code>AUDIT_LOG_RETENTION_DAYS</code>).'}</p>
  ${oldest}
</div>`;
	}

	const confirmAuditMsg = isZh
		? `確定要刪除早於 ${r.retention_days} 天的稽核日誌嗎？此操作不可還原。`
		: `Delete audit-log rows older than ${r.retention_days} days? This cannot be undone.`;
	return `
<div class="card" x-data="{
  busy: false,
  deleted: 0,
  done: false,
  error: null,
  step(first) {
    if (this.busy) return;
    if (first &amp;&amp; !confirm('${confirmAuditMsg}')) return;
    this.busy = true; this.error = null;
    return fetch('/admin/api/ops/audit-retention', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      this.deleted += j.deleted;
      this.busy = false;
      if (j.more) return this.step(false);
      this.done = true;
    }).catch(e => { this.error = e.message; this.busy = false; });
  }
}">
  <h3>${isZh ? "稽核日誌保留政策" : "Audit-log retention"}</h3>
  <p class="muted">${isZh ? `保留窗口：<strong>${r.retention_days}</strong> 天。Cron 排程會自動定時清除；此按鈕可立即清理積壓。<strong>此操作不可逆</strong> — 清除後將無法還原操作紀錄。` : `Window: <strong>${r.retention_days}</strong> days. The cron prunes automatically; this button just drains the backlog now instead of over the next few ticks. <strong>Irreversible</strong> — a pruned row is gone, and with it the record of why an action was taken.`}</p>
  ${oldest}
  <p class="muted">${isZh ? `目前超過保留窗口：<strong>${r.pending}</strong>。` : `Past the window right now: <strong>${r.pending}</strong>.`}</p>
  ${
		r.pending > 0
			? `<button :disabled="busy" @click="step(true)">
    <span x-show="!busy &amp;&amp; !done">${isZh ? "立即清理" : "Prune now"}</span>
    <span x-show="busy">${isZh ? "清理中…" : "Pruning…"}</span>
    <span x-show="!busy &amp;&amp; done">${isZh ? "完成" : "Done"}</span>
  </button>
  <div class="muted" style="margin-top:0.5rem" x-show="deleted">
    ${isZh ? '已刪除 <span x-text="deleted"></span> 筆紀錄' : 'Deleted <span x-text="deleted"></span> row(s)'}
  </div>
  <p style="color:var(--bad)" x-show="error" x-text="error"></p>`
			: `<p class="muted">${isZh ? "無需處理 — 排程已清理所有超出窗口的資料。" : "Nothing to do — the cron has already pruned everything past the window."}</p>`
	}
</div>`;
};

// Plain links, not fetch: the browser saves the stream straight to disk, the
// payload never sits in a JS variable, and a same-origin <a> is exactly what
// the route's Sec-Fetch-Site gate expects.
const exportCard = (isZh: boolean = false): string => `
<div class="card">
  <h3>${isZh ? "匯出站台資料" : "Export site data"}</h3>
  <p class="muted">${isZh ? "包含所有文章、留言（全狀態）、使用者、投票、表情反應、頁面評價與已確認的郵件訂閱。JSON 為完整備份；CSV 僅含留言清單（適合試算表）。雜湊 IP、使用者代理與訂閱 Token 絕不匯出；包含使用者電子郵件。" : "Every post, comment (all statuses), user, vote, reaction, page vote/reaction and confirmed subscription. JSON is the full backup; CSV is the comments alone, for a spreadsheet — cells that a spreadsheet would run as a formula get a leading <code>'</code>. Hashed IPs, user agents and subscription tokens are never included; user emails are."}</p>
  <p class="muted">${isZh ? "每次匯出會讀取每一筆資料列，計入 D1 免費方案讀取配額。每次下載都會記錄於稽核日誌中。若超過約 20,000 筆資料將被拒絕，請改用 <code>npm run db:export</code>。" : "One export reads every row, which counts against the D1 free-tier daily read quota. Each download is recorded in the audit log. A site past roughly 20,000 rows is refused — one Worker request can't page that far — so use <code>npm run db:export</code> instead."}</p>
  <p><a href="/admin/api/export?format=json">${isZh ? "下載 JSON 備份" : "Download JSON"}</a> ·
    <a href="/admin/api/export?format=csv">${isZh ? "下載 CSV 檔案" : "Download CSV"}</a></p>
</div>`;

export const renderOperator = (data: OperatorData, isZh: boolean = false): string => {
	const { rerender, retention, audit_retention, seed_demo_allowed } = data;
	const seedCard = seed_demo_allowed
		? `
<div class="card" x-data="{
  busy: false,
  result: null,
  error: null,
  run() {
    this.busy = true; this.error = null; this.result = null;
    return fetch('/admin/api/ops/seed-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      this.result = j;
    }).catch(e => { this.error = e.message; })
      .finally(() => { this.busy = false; });
  }
}">
  <h3>${isZh ? "建立示範文章" : "Seed demo post"}</h3>
  <p class="muted">${isZh ? "寫入 <code>welcome</code> 示範文章與簡短留言討論串。若已存在則自動略過。" : "Inserts the <code>welcome</code> post + a small comment thread. Skipped when the welcome post already has comments."}</p>
  <button :disabled="busy" @click="run()">
    <span x-show="!busy">${isZh ? "匯入示範資料" : "Seed demo"}</span>
    <span x-show="busy">${isZh ? "處理中…" : "Seeding…"}</span>
  </button>
  <p class="muted" x-show="result"
     x-text="result &amp;&amp; (result.skipped
       ? '${isZh ? "已有示範資料 — 未做任何變更。" : "Already seeded — nothing changed."}'
       : ('${isZh ? "已建立 " : "Inserted "}' + result.comments_inserted + '${isZh ? " 則留言，" : " comments, "}' + result.users_inserted + '${isZh ? " 位使用者。" : " users."}'))"></p>
  <p style="color:var(--bad)" x-show="error" x-text="error"></p>
</div>`
		: `
<div class="card">
  <h3>${isZh ? "建立示範文章" : "Seed demo post"}</h3>
  <p class="muted">${isZh ? "生產環境已停用此功能。如需啟用請設定 <code>ENV=dev</code>。" : "Disabled in production. Set <code>ENV=dev</code> on this instance to enable."}</p>
</div>`;

	return `
<div class="card" x-data="{
  busy: false,
  processed: 0,
  remaining: ${rerender.stale},
  cursor: null,
  error: null,
  step() {
    if (this.busy) return;
    this.busy = true; this.error = null;
    const body = this.cursor
      ? JSON.stringify({ cursor: this.cursor, batch: 50 })
      : JSON.stringify({ batch: 50 });
    return fetch('/admin/api/ops/rerender', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      this.processed += j.processed;
      this.remaining = Math.max(0, this.remaining - j.processed);
      this.cursor = j.next_cursor;
      this.busy = false;
      if (j.next_cursor) {
        return this.step();
      }
    }).catch(e => { this.error = e.message; this.busy = false; });
  }
}">
  <h3>${isZh ? "重新渲染留言" : "Rerender comments"}</h3>
  <p class="muted">${isZh ? `目前渲染器版本：<code>${rerender.current_version}</code>。最新：<strong>${rerender.up_to_date}</strong> · 需重繪：<strong>${rerender.stale}</strong>${rerender.oldest_version != null ? ` · 最舊需重繪版本 v${rerender.oldest_version}` : ""}。` : `Current renderer version: <code>${rerender.current_version}</code>. Up to date: <strong>${rerender.up_to_date}</strong> · Stale: <strong>${rerender.stale}</strong>${rerender.oldest_version != null ? `· oldest stale at v${rerender.oldest_version}` : ""}.`}</p>
  ${
		rerender.stale > 0
			? `<button :disabled="busy" @click="step()">
    <span x-show="!busy &amp;&amp; remaining > 0">${isZh ? "執行重新渲染" : "Run rerender"}</span>
    <span x-show="busy">${isZh ? "處理中…" : "Working…"}</span>
    <span x-show="!busy &amp;&amp; remaining === 0">${isZh ? "完成" : "Done"}</span>
  </button>
  <div class="muted" style="margin-top:0.5rem">
    ${isZh ? '已處理 <span x-text="processed"></span> · 剩餘 <span x-text="remaining"></span>' : 'Processed <span x-text="processed"></span> · remaining <span x-text="remaining"></span>'}
  </div>
  <p style="color:var(--bad)" x-show="error" x-text="error"></p>`
			: `<p class="muted">${isZh ? "無需處理 — 所有留言皆已是最新版本。" : "Nothing to do — all comments are at the current version."}</p>`
	}
</div>

${retentionCard(retention, isZh)}
${auditRetentionCard(audit_retention, isZh)}
${exportCard(isZh)}

${seedCard}

<div class="card" x-data="{
  busy: false,
  result: null,
  error: null,
  source: 'disqus',
  dryRun: true,
  includeDeleted: false,
  includeSpam: false,
  domain: '',
  site: '',
  sources: {
    disqus: {
      contentType: 'application/xml',
      accept: '.xml,.gz,application/xml,text/xml,application/gzip',
      cli: 'npm run import-disqus -- ./export.xml --dry-run',
      domainFlag: false,
      siteFlag: false,
    },
    remark42: {
      contentType: 'application/x-ndjson',
      accept: '.json,.jsonl,.gz,application/json,application/gzip',
      cli: 'npm run import-remark42 -- ./userbackup.gz --dry-run',
      domainFlag: false,
      siteFlag: false,
    },
    comentario: {
      contentType: 'application/json',
      accept: '.json,.gz,application/json,application/gzip',
      cli: 'npm run import-comentario -- ./export.json --dry-run',
      domainFlag: true,
      siteFlag: false,
    },
    isso: {
      contentType: 'application/json',
      accept: '.json,.gz,application/json,application/gzip',
      cli: 'npm run import-isso -- ./isso-dump.json --dry-run',
      domainFlag: false,
      siteFlag: true,
    },
    cusdis: {
      contentType: 'application/json',
      accept: '.json,.gz,application/json,application/gzip',
      cli: 'npm run import-cusdis -- ./cusdis-dump.json --dry-run',
      domainFlag: true,
      siteFlag: true,
    },
  },
  get spec() { return this.sources[this.source] },
  get endpoint() { return '/admin/api/ops/import-' + this.source },
  get contentType() { return this.spec.contentType },
  get accept() { return this.spec.accept },
  async run(file) {
    if (!file) return;
    if (file.size > ${MAX_IMPORT_BYTES}) {
      this.error = 'file too large (max ${MAX_IMPORT_MB} MB)';
      return;
    }
    this.busy = true; this.error = null; this.result = null;
    try {
      const body = await file.arrayBuffer();
      const r = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': this.contentType,
          'x-dry-run': this.dryRun ? '1' : '0',
          'x-include-deleted': this.includeDeleted ? '1' : '0',
          'x-include-spam': this.includeSpam ? '1' : '0',
          ...(this.spec.domainFlag &amp;&amp; this.domain.trim()
            ? { 'x-import-domain': this.domain.trim() }
            : {}),
          ...(this.spec.siteFlag &amp;&amp; this.site.trim()
            ? { 'x-import-site': this.site.trim() }
            : {}),
        },
        body,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'import failed');
      this.result = j;
    } catch (e) {
      this.error = e.message || 'import failed';
    } finally {
      this.busy = false;
    }
  }
}">
  <h3>${isZh ? "匯入留言資料" : "Import comments"}</h3>
  <p>
    <label style="display:inline-flex;gap:0.3rem;align-items:center">
      ${isZh ? "來源平台" : "Source"}
      <select x-model="source" :disabled="busy">
        <option value="disqus">Disqus</option>
        <option value="remark42">Remark42</option>
        <option value="comentario">Comentario / Commento</option>
        <option value="isso">isso</option>
        <option value="cusdis">Cusdis</option>
      </select>
    </label>
  </p>
  <p class="muted" x-show="source === 'disqus'">${isZh ? "上傳 Disqus 匯出之 XML 檔案（支援 <code>.xml.gz</code> 壓縮或未壓縮），並寫入 D1 資料庫。具等冪性：重複匯入會依據 Disqus 留言 ID 自動去重。HTML 標籤將透過標準 Markdown 白名單重新過濾。" : "Uploads a Disqus comment-export XML file — gzipped (<code>.xml.gz</code>) or not — and ingests it into D1. Idempotent: re-running the same file is a no-op (deduplicated by Disqus comment ID). Imported HTML is stripped and re-rendered through the standard markdown allowlist."}</p>
  <p class="muted" x-show="source === 'remark42'">${isZh ? "上傳 Remark42 備份檔（<code>.gz</code> 或 JSONL 串流）。具等冪性，依 Remark42 留言 ID 自動去重。" : "Uploads a Remark42 backup — the <code>.gz</code> that <code>backup</code> writes nightly, or the plain JSONL the export API streams. Idempotent, deduplicated by Remark42 comment ID."}</p>
  <p class="muted" x-show="source === 'comentario'">${isZh ? "上傳 Comentario 或 Commento 匯出的 JSON 檔。具等冪性，依來源留言 ID 去重。" : "Uploads a Comentario export — the single JSON document its admin UI writes, gzipped or not — or a legacy Commento one."}</p>
  <p class="muted" x-show="source === 'isso'">${isZh ? "isso 無內建匯出，請於 host 上執行 <code>npm run dump-isso</code> 產出 JSON 後上傳至此。" : "isso ships no export at all — <code>comments.db</code> is its data store. Run <code>npm run dump-isso</code> against that file and upload the JSON."}</p>
  <p class="muted" x-show="source === 'cusdis'">${isZh ? "Cusdis 無內建匯出，請於 host 上執行 <code>npm run dump-cusdis</code> 產出 JSON 後上傳至此。" : "Cusdis is deprecated upstream and ships no export. Run <code>npm run dump-cusdis</code> against that file and upload the JSON."}</p>
  <p x-show="spec.domainFlag">
    <label style="display:inline-flex;gap:0.3rem;align-items:center">
      <span x-text="source === 'cusdis' ? '${isZh ? "專案 ID (選填)" : "Project (optional)"}' : '${isZh ? "網域 (選填)" : "Domain (optional)"}'"></span>
      <input type="text" x-model="domain" :disabled="busy"
             :placeholder="source === 'cusdis' ? 'project id UUID' : 'domainId UUID, or a host for Commento v1'"
             style="min-width:22rem">
    </label>
  </p>
  <p x-show="spec.siteFlag">
    <label style="display:inline-flex;gap:0.3rem;align-items:center">
      ${isZh ? "站台根網址 (選填)" : "Site origin (optional)"}
      <input type="url" x-model="site" :disabled="busy"
             placeholder="https://blog.example.com"
             style="min-width:22rem">
    </label>
  </p>
  <p>
    <label style="display:inline-flex;gap:0.3rem;align-items:center;margin-right:0.8rem">
      <input type="checkbox" x-model="dryRun"> ${isZh ? "試跑模式 (僅解析與規劃，不寫入)" : "Dry run (parse + plan only)"}
    </label>
    <label style="display:inline-flex;gap:0.3rem;align-items:center;margin-right:0.8rem">
      <input type="checkbox" x-model="includeDeleted"> ${isZh ? "包含已刪除留言" : "Include deleted"}
    </label>
    <label style="display:inline-flex;gap:0.3rem;align-items:center">
      <input type="checkbox" x-model="includeSpam"> ${isZh ? "包含垃圾留言" : "Include spam"}
    </label>
  </p>
  <input type="file" :accept="accept"
         :disabled="busy"
         @change="run($event.target.files[0])">
  <p class="muted" x-show="busy">${isZh ? "匯入中… 請勿離開此頁面。" : "Importing… don't navigate away."}</p>
  <pre x-show="result" x-text="result &amp;&amp; JSON.stringify(result, null, 2)"
       style="background:var(--bg);padding:0.6rem;border-radius:4px;font-size:0.85rem"></pre>
  <p style="color:var(--bad)" x-show="error" x-text="error"></p>
  <p class="muted">${isZh ? `上傳上限：${MAX_IMPORT_MB} MB（解壓後亦須低於 ${MAX_IMPORT_MB} MB）。更大檔案請使用 CLI 工具：` : `Max upload: ${MAX_IMPORT_MB} MB, and a gzipped file must also stay under ${MAX_IMPORT_MB} MB once expanded. For larger exports use the CLI: `}<code x-text="spec.cli"></code>。</p>
</div>
`;
};
