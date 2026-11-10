/**
 * Cloudflare usage dashboard — renders today's Workers / D1 / KV / Workers AI usage
 * against the free-tier ceilings. Two render modes:
 *
 *   renderUsageSetup()    — token absent. Shows the wrangler secret put
 *                           commands and the required token scopes.
 *   renderUsageDashboard() — token present. Shows four usage panels,
 *                           each with its own success/error state.
 *
 * Chart strategy: each panel emits a tiny inline SVG bar with the
 * free-tier ceiling drawn as a vertical line. No JS chart library —
 * keeps the admin bundle thin and the page renderable without
 * client-side execution.
 */
import { escapeHtml } from "../escape";
import type { Panel, UsageSnapshot } from "../../lib/cf-usage";
import type { CommentsByHostRow } from "../../db/queries";

// Free-tier limits as of 2026-05. Update alongside Cloudflare's docs.
const LIMITS = {
	workers_requests_per_day: 100_000,
	d1_reads_per_day: 5_000_000,
	d1_writes_per_day: 100_000,
	d1_storage_bytes: 5 * 1024 * 1024 * 1024,
	kv_reads_per_day: 100_000,
	kv_writes_per_day: 1_000,
	ai_neurons_per_day: 10_000,
} as const;

const fmt = (n: number): string => n.toLocaleString("en-US");

const pct = (used: number, ceiling: number): number =>
	ceiling === 0 ? 0 : Math.min(100, (used / ceiling) * 100);

const barColor = (p: number): string =>
	p >= 90 ? "var(--bad)" : p >= 75 ? "var(--warn)" : "var(--ok)";

// Single-bar SVG with the ceiling tick. Width is fluid via viewBox so
// it scales inside the card.
const usageBar = (used: number, ceiling: number, label: string, isZh: boolean = false): string => {
	const p = pct(used, ceiling);
	const c = barColor(p);
	const ceilingText = isZh
		? `${p.toFixed(1)}% 免費方案上限`
		: `${p.toFixed(1)}% of free-tier ceiling`;
	return `
<div class="usage-row">
  <div class="usage-label">
    <strong>${escapeHtml(label)}</strong>
    <span class="muted">${fmt(used)} / ${fmt(ceiling)}</span>
  </div>
  <svg viewBox="0 0 200 14" preserveAspectRatio="none"
       style="width:100%;height:14px;background:var(--surface-2);border-radius:3px"
       role="img" aria-label="${escapeHtml(`${label}: ${p.toFixed(1)}%`)}">
    <rect x="0" y="0" width="${p * 2}" height="14" fill="${c}"/>
  </svg>
  <div class="muted" style="font-size:0.75rem">${ceilingText}</div>
</div>`;
};

const panelError = (label: string, err: string, isZh: boolean = false): string => `
<div class="card">
  <h3 style="margin-top:0">${escapeHtml(label)}</h3>
  <p class="muted">${isZh ? "無法取得此項指標：" : "Couldn't fetch this metric:"} <code>${escapeHtml(err)}</code></p>
</div>`;

const workersPanel = (
	w: Panel<{ today: number; last30d: number }>,
	isZh: boolean = false,
): string => {
	if (!w.ok) return panelError(isZh ? "Workers 請求數" : "Workers", w.error, isZh);
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "Workers 請求數" : "Workers requests"}</h3>
  ${usageBar(w.data.today, LIMITS.workers_requests_per_day, isZh ? "今日" : "Today", isZh)}
  <p class="muted" style="margin-top:0.6rem">
    ${
			isZh
				? `過去 30 天：累計 <strong>${fmt(w.data.last30d)}</strong> 次請求。`
				: `Last 30 days: <strong>${fmt(w.data.last30d)}</strong> total requests.`
		}
  </p>
</div>`;
};

const d1Panel = (
	d: Panel<{
		reads_today: number;
		writes_today: number;
		storage_bytes: number | null;
	}>,
	isZh: boolean = false,
): string => {
	if (!d.ok) return panelError(isZh ? "D1 資料庫" : "D1", d.error, isZh);
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "D1 資料庫" : "D1 database"}</h3>
  ${usageBar(d.data.reads_today, LIMITS.d1_reads_per_day, isZh ? "資料列讀取 (今日)" : "Row reads (today)", isZh)}
  ${usageBar(d.data.writes_today, LIMITS.d1_writes_per_day, isZh ? "資料列寫入 (今日)" : "Row writes (today)", isZh)}
  <p class="muted" style="font-size:0.8rem;margin-top:0.6rem">
    ${
			isZh
				? `儲存容量目前未透過分析 API 公開——請至 <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare 控制台</a> 查看當前使用量（免費額度上限：${fmt(LIMITS.d1_storage_bytes / 1024 / 1024 / 1024)} GB）。`
				: `Storage size is not exposed via the analytics API — check the
    <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare dashboard</a>
    for current consumption (free-tier ceiling: ${fmt(LIMITS.d1_storage_bytes / 1024 / 1024 / 1024)} GB).`
		}
  </p>
</div>`;
};

const kvPanel = (
	k: Panel<{
		reads_today: number;
		writes_today: number;
		storage_bytes: number | null;
	}>,
	isZh: boolean = false,
): string => {
	if (!k.ok) return panelError(isZh ? "KV 命名空間" : "KV", k.error, isZh);
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "KV 命名空間" : "KV namespaces"}</h3>
  ${usageBar(k.data.reads_today, LIMITS.kv_reads_per_day, isZh ? "讀取次數 (今日)" : "Reads (today)", isZh)}
  ${usageBar(k.data.writes_today, LIMITS.kv_writes_per_day, isZh ? "寫入次數 (今日)" : "Writes (today)", isZh)}
  <p class="muted" style="font-size:0.8rem;margin-top:0.6rem">
    ${
			isZh
				? "包含帳戶下的所有 KV 命名空間。888echo 使用了四個：<code>SESSIONS</code>、<code>OAUTH_STATE</code>、<code>RATE_LIMITS</code> 與 <code>TREE_CACHE</code>。"
				: `Includes every KV namespace on the account. Garrul uses four:
    <code>SESSIONS</code>, <code>OAUTH_STATE</code>, <code>RATE_LIMITS</code>,
    <code>TREE_CACHE</code>.`
		}
  </p>
</div>`;
};

const aiPanel = (
	a: Panel<{ neurons_today: number; inferences_today: number }>,
	isZh: boolean = false,
): string => {
	if (!a.ok) return panelError("Workers AI", a.error, isZh);
	const { neurons_today: neurons, inferences_today: calls } = a.data;
	const avg = calls > 0
		? isZh
			? `平均：今日共 ${fmt(calls)} 次呼叫，每次呼叫使用 <strong>${(neurons / calls).toFixed(2)}</strong> 個神經元。`
			: `Average: <strong>${(neurons / calls).toFixed(2)}</strong> neurons per call
    across ${fmt(calls)} call${calls === 1 ? "" : "s"} today.`
		: isZh
			? "今日尚無 Workers AI 呼叫。"
			: "No Workers AI calls today.";
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "Workers AI 神經元" : "Workers AI"}</h3>
  ${usageBar(Math.round(neurons), LIMITS.ai_neurons_per_day, isZh ? "神經元使用量 (今日)" : "Neurons (today)", isZh)}
  <p class="muted" style="margin-top:0.6rem">${avg}</p>
  <p class="muted" style="font-size:0.8rem;margin-top:0.6rem">
    ${
			isZh
				? "包含帳戶下的所有 Worker。當 <code>SPAM_PROVIDER</code> 為 <code>workers-ai</code> 時，每則新留言將呼叫一次 Workers AI。所有方案每日均包含 10,000 個免費神經元（於 UTC 00:00 重設）。若超過限制，超過部分將不經 AI 檢查直接發表。"
				: `Includes every Worker on the account. Garrul calls Workers AI once per
    new comment when <code>SPAM_PROVIDER</code> is <code>workers-ai</code>.
    Both Workers plans include 10,000 neurons a day (reset 00:00 UTC). On the
    Free plan, calls past that fail and comments are posted without an AI check.`
		}
  </p>
</div>`;
};

const HOSTS_VISIBLE = 10;

const byHostPanel = (rows: CommentsByHostRow[], isZh: boolean = false): string => {
	if (rows.length === 0) return "";
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
  <td class="muted">${rate}%</td>
</tr>`;
		})
		.join("");
	const more = overflow > 0
		? `<div class="muted" style="font-size:0.85em;margin-top:0.4rem">${
				isZh
					? `…以及其他 ${overflow} 個網域`
					: `…and ${overflow} more domain${overflow === 1 ? "" : "s"}`
			}</div>`
		: "";
	return `
<div class="card">
  <h3 style="margin-top:0">${isZh ? "各網域留言分佈" : "Comments by domain"}</h3>
  <table>
    <thead><tr><th>${isZh ? "網域 (Host)" : "Host"}</th><th>${isZh ? "總留言數" : "Total"}</th><th>${isZh ? "垃圾比例" : "Spam %"}</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
  ${more}
</div>`;
};

export const renderUsageDashboard = (
	snapshot: UsageSnapshot,
	byHost: CommentsByHostRow[] = [],
	isZh: boolean = false,
): string => {
	const asOf = new Date(snapshot.asOf).toISOString().replace("T", " ").slice(0, 16);
	const ai = snapshot.ai ? aiPanel(snapshot.ai, isZh) : "";
	return `
<div class="card">
  <h2 style="margin-top:0">${isZh ? "Cloudflare 資源用量統計" : "Cloudflare usage"}</h2>
  <p class="muted">
    ${
			isZh
				? `來自 Cloudflare GraphQL Analytics API 的即時監控數據。快取 5 分鐘（快照時間：<code>${escapeHtml(asOf)} UTC</code>）。長條圖旁標示免費額度上限；使用率達 75% 顯示黃色，達 90% 顯示紅色警告。`
				: `Live counters from Cloudflare's GraphQL Analytics API.
    Cached for 5 minutes (snapshot: <code>${escapeHtml(asOf)} UTC</code>).
    Free-tier ceilings shown next to each bar; bars turn yellow at 75%
    and red at 90%.`
		}
  </p>
</div>
${workersPanel(snapshot.workers, isZh)}
${d1Panel(snapshot.d1, isZh)}
${kvPanel(snapshot.kv, isZh)}
${ai}
${byHostPanel(byHost, isZh)}`;
};

export const renderUsageSetup = (byHost: CommentsByHostRow[] = [], isZh: boolean = false): string => `
<div class="card">
  <h2 style="margin-top:0">${isZh ? "Cloudflare 資源用量 — 尚未配置" : "Cloudflare usage — not configured"}</h2>
  <p>
    ${
			isZh
				? "本頁面對比當日 Workers、D1、KV 與 Workers AI 使用量與免費方案上限，讓您在達到限制前掌握剩餘空間。此功能完全選填——未配置不影響其他後台功能正常運作。"
				: `This page surfaces today's Workers, D1, KV and Workers AI usage against the
    free-tier ceilings so you can see headroom before you hit a limit.
    It's fully optional — the rest of the admin works without it.`
		}
  </p>
  <h3>${isZh ? "配置步驟" : "Setup"}</h3>
  <ol>
    <li>
      ${
				isZh
					? `在 <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">dash.cloudflare.com/profile/api-tokens</a> 建立 Cloudflare API Token，需具備以下最小權限：`
					: `Create a Cloudflare API token at
      <a href="https://dash.cloudflare.com/profile/api-tokens"
         target="_blank" rel="noopener">dash.cloudflare.com/profile/api-tokens</a>
      with the following least-privilege scopes:`
			}
      <ul>
        <li><code>Account · Account Analytics · Read</code></li>
        <li><code>Account · D1 · Read</code></li>
        <li><code>Account · Workers KV Storage · Read</code></li>
      </ul>
    </li>
    <li>
      ${
				isZh
					? "在任一 Zone 概覽頁面右側邊欄找到您的 Account ID（或在終端機執行 <code>wrangler whoami</code>）。"
					: "Find your account ID in the right sidebar of any zone's overview page (or run <code>wrangler whoami</code>)."
			}
    </li>
    <li>
      ${
				isZh
					? "設定這兩個 Secrets 並重新部署："
					: "Set the two secrets and redeploy:"
			}
      <pre><code>wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID</code></pre>
    </li>
  </ol>
  <p class="muted">
    ${
			isZh
				? "Token 絕不會離開 Worker——前端無任何 JS 可以存取，亦不會在任何介面回顯。Worker 會在初次載入時以最小權限之 <code>/user/tokens/verify</code> 進行驗證。"
				: `The token never leaves the Worker — there is no client-side JS that
    sees it, and it's not echoed in any UI. The Worker validates it on
    first load with a low-privilege <code>/user/tokens/verify</code>
    probe.`
		}
  </p>
</div>
${byHostPanel(byHost, isZh)}`;

export const renderUsageTokenError = (
	error: string,
	byHost: CommentsByHostRow[] = [],
	isZh: boolean = false,
): string => `
<div class="card">
  <h2 style="margin-top:0">${isZh ? "Cloudflare 資源用量 — Token 驗證錯誤" : "Cloudflare usage — token error"}</h2>
  <p>
    ${
			isZh
				? `目前配置的 <code>CF_API_TOKEN</code> 驗證失敗。Cloudflare 驗證端點回傳錯誤訊息：<code>${escapeHtml(error)}</code>。`
				: `The <code>CF_API_TOKEN</code> currently configured did not validate.
    Cloudflare's verify endpoint returned: <code>${escapeHtml(error)}</code>.`
		}
  </p>
  <p>
    ${
			isZh
				? "常見原因：Token 已被撤銷或過期，或者儲存的值在設定時被截斷。請依照設定指南重新建立具備三項權限的 Token，並再次執行 <code>wrangler secret put CF_API_TOKEN</code>。"
				: `Common causes: the token was revoked or expired, or the stored value
    was truncated when it was set. Re-create the token with the three
    scopes listed in the setup guide and run <code>wrangler secret put
    CF_API_TOKEN</code> again.`
		}
  </p>
  <p class="muted">
    ${
			isZh
				? "系統同時支援帳戶權限（<code>cfat</code> 前綴）與使用者權限之 Token。若缺少權限或 <code>CF_ACCOUNT_ID</code> 不正確，將會直接在儀表板各卡片呈現錯誤。"
				: `Both account-owned (<code>cfat</code>-prefixed) and user-owned tokens
    are accepted — Garrul probes each verify endpoint. A dropped scope or
    a wrong <code>CF_ACCOUNT_ID</code> does <em>not</em> land here: those
    surface as a per-panel error on the dashboard instead.`
		}
  </p>
</div>
${byHostPanel(byHost, isZh)}`;
