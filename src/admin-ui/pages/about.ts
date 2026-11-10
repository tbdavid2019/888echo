import type { ReleaseSummary } from "../../lib/version-check";
import {
	CURRENT_VERSION,
	REPO_NAME,
	REPO_OWNER,
} from "../../lib/version.gen";
import { escapeHtml } from "../escape";

const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

const formatDate = (iso: string): string => {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString().slice(0, 10);
};

const renderRelease = (r: ReleaseSummary, isZh: boolean = false): string => {
	const date = formatDate(r.publishedAt);
	const dateHtml = date ? `<span class="muted"> · ${escapeHtml(date)}</span>` : "";
	const body =
		r.bodyHtml ||
		`<p class="muted">${isZh ? "無版本資訊。" : "No release notes."}</p>`;
	return `
<article class="release-card">
  <h3 class="release-head">
    <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.tag)}</a>
    ${r.name && r.name !== r.tag ? `<span class="release-name">${escapeHtml(r.name)}</span>` : ""}
    ${dateHtml}
  </h3>
  <div class="md release-body">${body}</div>
</article>`;
};

export const renderAbout = (releases: ReleaseSummary[] | null, isZh: boolean = false): string => {
	const releasesHtml =
		releases && releases.length > 0
			? releases.map((r) => renderRelease(r, isZh)).join("")
			: `<p class="muted">${isZh ? "暫無快取的版本發布資料 — 請稍後重新整理。" : "No release data cached yet — reload in a moment."}</p>`;

	return `
<div class="card">
  <h2>${isZh ? "關於 888echo" : "About 888echo"}</h2>
  <p>${isZh ? "888echo — 構建於 Cloudflare Workers、D1 與 KV 之上的高效能邊緣主權自託管留言系統。" : "888echo — Sovereign edge comment &amp; discussion engine on Cloudflare Workers, D1, and KV."}</p>
  <p>${isZh ? "目前運行版本：" : "Running version:"} <code>v${escapeHtml(CURRENT_VERSION)}</code></p>
</div>

<div class="card">
  <h2>${isZh ? "相關連結" : "Links"}</h2>
  <ul class="link-list">
    <li><a href="${REPO_URL}" target="_blank" rel="noopener">${isZh ? "GitHub 原始碼倉庫" : "Repository on GitHub"}</a></li>
    <li><a href="${REPO_URL}/releases" target="_blank" rel="noopener">${isZh ? "所有版本發布" : "All releases"}</a></li>
    <li><a href="${REPO_URL}/issues" target="_blank" rel="noopener">${isZh ? "問題回報與建議" : "Report an issue"}</a></li>
    <li><a href="${REPO_URL}/blob/main/README.zh-Hant.md" target="_blank" rel="noopener">${isZh ? "繁體中文說明文件 (README.zh-Hant.md)" : "README"}</a></li>
    <li><a href="/AGENTS.md" target="_blank" rel="noopener">${isZh ? "AI 整合指南 (AGENTS.md)" : "AGENTS.md (AI integration)"}</a></li>
    <li><a href="${REPO_URL}/blob/main/AGENTS-OPERATE.md" target="_blank" rel="noopener">${isZh ? "系統維護與運維手冊 (AGENTS-OPERATE.md)" : "AGENTS-OPERATE.md (operations)"}</a></li>
  </ul>
  <p class="muted">${isZh ? "運維提示：可在本地執行 <code>npm run upgrade</code> 檢視與最新發布版本之間的差異。" : "Operators: run <code>npm run upgrade</code> from your checkout to see the drift plan against the latest release."}</p>
</div>

<div class="card">
  <h2>${isZh ? "近期版本更新" : "Recent releases"}</h2>
  <p class="muted">${isZh ? `顯示來自 <code>${escapeHtml(REPO_OWNER)}/${escapeHtml(REPO_NAME)}</code> 最近最多 5 個版本更新（快取 1 小時）。` : `Showing up to the 5 most recent releases from <code>${escapeHtml(REPO_OWNER)}/${escapeHtml(REPO_NAME)}</code>. Cached for 1h.`}</p>
  ${releasesHtml}
</div>`;
};
