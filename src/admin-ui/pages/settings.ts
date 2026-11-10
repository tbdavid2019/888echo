import type { Bindings } from "../../index";
import { LOCALES } from "../../i18n";
import { AUTO_LOCALE } from "../../i18n/negotiate";
import {
	type FlagKey,
	type NumberKey,
	type ReactionKindsKey,
	type ResolvedFlags,
	type ResolvedNumbers,
	type ResolvedStrings,
	type ResolvedTexts,
	MAX_TEXT_SETTING_CHARS,
	STAFF_BADGE_LABEL_MAX,
	TEXT_KEYS,
	isReactionKindsKey,
	numberBounds,
	reactionKinds,
} from "../../lib/settings";
import {
	MAX_TERMS,
	MAX_TERM_CHARS,
	MAX_WILDCARDS,
} from "../../lib/spam/blocklist";
import { REACTION_KINDS } from "../../widget/reactions";
import { EN } from "../../widget/strings";
import {
	renderSelect,
	renderStepper,
	renderSwitch,
	renderTabs,
	renderTextarea,
} from "../controls";
import { escapeHtml, jsLiteralRaw } from "../escape";

// Glyph + English label per kind, seeded into Alpine for the chip lists.
// English only, like the rest of the admin UI; derived from the vocabulary so
// a new kind shows up here without an edit.
const VOCAB_SEED = JSON.stringify(
	Object.fromEntries(
		REACTION_KINDS.map((r) => [r.kind, { emoji: r.emoji, label: EN[r.labelKey] as string }]),
	),
);

// One surface's chip list. The canonical value stays the comma-joined string
// in texts.<key> (the hidden input), so save() posts it like any text setting
// and the server's strict check (canonicalReactionKinds) is the only gate.
const renderKindChips = (key: ReactionKindsKey, label: string, help: string): string => `
<div class="field-stack">
  <span class="field-text">
    <strong>${escapeHtml(label)}</strong>
    <span class="muted">${help}</span>
  </span>
  <input type="hidden" name="${key}" x-model="texts.${key}">
  <ul class="kind-chips">
    <template x-for="kind in chipOrder('${key}')" :key="kind">
      <li class="kind-chip">
        <label>
          <input type="checkbox" :checked="kindOn('${key}', kind)"
                 :disabled="kindOn('${key}', kind) &amp;&amp; kindsOf('${key}').length === 1"
                 @change="toggleKind('${key}', kind)">
          <span aria-hidden="true" x-text="vocab[kind].emoji"></span>
          <span x-text="vocab[kind].label"></span>
        </label>
        <button type="button" class="btn-secondary" x-show="kindOn('${key}', kind)"
                :disabled="kindsOf('${key}').indexOf(kind) === 0"
                :aria-label="'Move ' + vocab[kind].label + ' earlier'"
                @click="moveKind('${key}', kind, -1)">↑</button>
        <button type="button" class="btn-secondary" x-show="kindOn('${key}', kind)"
                :disabled="kindsOf('${key}').indexOf(kind) === kindsOf('${key}').length - 1"
                :aria-label="'Move ' + vocab[kind].label + ' later'"
                @click="moveKind('${key}', kind, 1)">↓</button>
      </li>
    </template>
  </ul>
</div>`;

const getTabs = (isZh: boolean) => [
	{ id: "features", label: isZh ? "功能特性" : "Features" },
	{ id: "display", label: isZh ? "顯示與分頁" : "Display" },
	{ id: "moderation", label: isZh ? "審核與防護" : "Moderation" },
	{ id: "config", label: isZh ? "環境變數配置" : "Configuration" },
];

const getFlagMeta = (isZh: boolean): { key: FlagKey; label: string; help: string }[] => [
	{
		key: "comments_enabled",
		label: isZh ? "留言功能" : "Comments",
		help: isZh
			? "接受新留言。關閉時將隱藏留言輸入框並拒絕送出留言。"
			: "Accept new comments. When off, the composer is hidden and posting is rejected.",
	},
	{
		key: "comment_email_confirmation_enabled",
		label: isZh ? "留言需 Email 驗證確認" : "Require email confirmation for comments",
		help: isZh
			? "每位留言者必須點擊發送至其電子信箱的確認連結後，留言才會顯示。需預先配置外發 Email 服務。"
			: "Require every commenter to confirm a link sent to their email before the comment can appear. Needs outbound email configured.",
	},
	{
		key: "oauth_login_enabled",
		label: isZh ? "OAuth 第三方登入" : "OAuth sign-in",
		help: isZh
			? "預設關閉。在此啟用已配置的 GitHub、Google、Facebook、X (Twitter) 與 Discord 登入。關閉時現有 Session 仍保持有效；請保留有效的管理員 Session 或使用文件記載的復原管道。"
			: "Off by default. Enable configured GitHub, Google, Facebook, X, and Discord sign-ins here. Existing sessions remain valid while OAuth is off; retain an active admin session or use the documented recovery path.",
	},
	{
		key: "reactions_enabled",
		label: isZh ? "表情符號反應 (留言)" : "Emoji reactions (comments)",
		help: isZh
			? "個別留言的表情符號反應。可在下方「留言表情符號」自訂啟用的表情符號及其排列順序。"
			: "Per-comment emoji reactions. Choose which emoji, and their order, under Reaction emoji below.",
	},
	{
		key: "votes_enabled",
		label: isZh ? "投票評分 (留言)" : "Votes (comments)",
		help: isZh
			? "留言的贊成/反對投票評分功能，以及「熱門/最高分優先」排序選項。"
			: "Up/down voting on comments and the sort-by-top option.",
	},
	{
		key: "downvotes_enabled",
		label: isZh ? "反對票 (噓)" : "Downvotes",
		help: isZh
			? "允許點擊反對票 (向下箭頭)。當留言投票功能關閉時將被忽略。"
			: "Allow the downvote arrow. Ignored while comment votes are off.",
	},
	{
		key: "page_reactions_enabled",
		label: isZh ? "頁面表情反應" : "Page reactions",
		help: isZh
			? "讓讀者無需撰寫留言即可對文章本體表達表情符號反應。"
			: "Let readers react to the article itself with an emoji, without leaving a comment.",
	},
	{
		key: "page_votes_enabled",
		label: isZh ? "頁面評分/投票" : "Page vote",
		help: isZh
			? "在文章本體提供簡單的「是否有幫助 / 贊成」計數統計。"
			: "A simple helpful/up vote tally on the article itself.",
	},
	{
		key: "show_deleted_placeholders",
		label: isZh ? "保留已刪除留言佔位符號" : "Show deleted-comment placeholders",
		help: isZh
			? "在討論串中保留已移除留言的佔位符號（「[已刪除]」/「[已由管理員移除]」）而不直接移除。無論如何下層回覆皆會完整保留。"
			: 'Keep removed comments in the thread as a placeholder ("[deleted]" / "[removed by a moderator]") instead of dropping them. Replies are preserved either way.',
	},
];

const getModFlagMeta = (isZh: boolean): { key: FlagKey; label: string; help: string }[] => [
	{
		key: "spam_first_comment_moderate",
		label: isZh ? "攔截每位作者的首則留言" : "Hold every author's first comment",
		help: isZh
			? "將每位作者發表的留言導向審核佇列，直到您手動核准其中一則為止。不會直接丟棄任何留言——由您決定核准或拒絕。成本：每則留言一次建立索引的 D1 讀取。"
			: "Route each author's comments to the moderation queue until you approve one of them. Nothing is dropped — you approve or reject it. Cost: one indexed D1 read per comment.",
	},
	{
		key: "turnstile_always",
		label: isZh ? "登入使用者亦需驗證 Turnstile" : "Challenge signed-in commenters too",
		help: isZh
			? "對所有留言皆強制進行 Turnstile 驗證，不限於匿名留言。預設關閉——已登入讀者發言無需驗證。需配置 TURNSTILE_SITE_KEY 與 TURNSTILE_SECRET。成本：Turnstile 本身免費。每次挑戰增加一次 Worker 驗證框架請求，發言時增加一次 siteverify 呼叫。"
			: "Require a Turnstile challenge on every comment, not just anonymous ones. Off by default — a signed-in reader posts without one. Needs TURNSTILE_SITE_KEY and TURNSTILE_SECRET configured; without them this does nothing. Cost: Turnstile itself is free. Each challenge adds one Worker request for the challenge frame and one siteverify call when the comment posts.",
	},
	{
		key: "turnstile_enabled",
		label: isZh ? "啟用 Turnstile 防垃圾驗證" : "Enable Turnstile anti-spam challenge",
		help: isZh
			? "對留言啟用 Turnstile 防垃圾挑戰。配置金鑰時預設啟用；取消勾選可完全停用 Turnstile。"
			: "Require a Turnstile challenge on comments. Enabled by default when credentials are configured; uncheck to disable Turnstile completely.",
	},
	{
		key: "moderator_email_enabled",
		label: isZh ? "佇列事件 Email 通知我" : "Email me about the queue",
		help: isZh
			? "當有留言進入審核佇列或被檢舉時，發送摘要郵件至 ADMIN_EMAILS（或 MODERATOR_NOTIFY_EMAILS）。需預先配置郵件服務——EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM 與 PUBLIC_BASE_URL。"
			: "Send a digest to ADMIN_EMAILS (or MODERATOR_NOTIFY_EMAILS) when comments land in the queue or get reported. Needs email configured — EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM and PUBLIC_BASE_URL — and stays silent without it.",
	},
];

const getNumberMeta = (isZh: boolean): { key: NumberKey; label: string; help: string }[] => [
	{
		key: "comments_per_page",
		label: isZh ? "每頁留言數" : "Comments per page",
		help: isZh
			? "初次載入顯示的頂層留言數量。點擊「載入更多留言」將顯示下一批次。"
			: 'Top-level comments shown per initial load. "Load older comments" reveals the next batch.',
	},
	{
		key: "replies_per_thread",
		label: isZh ? "摺疊前顯示之回覆數" : "Replies before “show more”",
		help: isZh
			? "每則留言下預設顯示的回覆數量，超過時顯示「查看其他 N 則回覆」按鈕。0 = 展開全部回覆。"
			: "Replies shown under each comment before a “Show N more replies” button. 0 = show all.",
	},
	{
		key: "auto_collapse_depth",
		label: isZh ? "自動摺疊層級深度" : "Auto-collapse depth",
		help: isZh
			? "巢狀層級達到或超過此深度的回覆預設摺疊。0 = 永不自動摺疊。"
			: "Replies nested at this depth or deeper start collapsed. 0 = never auto-collapse.",
	},
];

const getModNumberMeta = (isZh: boolean): { key: NumberKey; label: string; help: string }[] => [
	{
		key: "edit_window_minutes",
		label: isZh ? "留言編輯時限 (分鐘)" : "Edit window (minutes)",
		help: isZh
			? "作者發表留言後可修改自身內容的時間上限。0 = 完全不允許編輯。"
			: "How long after posting an author may still revise their own comment. 0 = no editing at all.",
	},
	{
		key: "auto_close_days",
		label: isZh ? "自動關閉討論天數 (天)" : "Auto-close after (days)",
		help: isZh
			? "在文章發布日（若主機未傳入則以首則留言時間為準）經過指定天數後，自動關閉討論串並拒絕新留言。0 = 永不依時間自動關閉。現有留言仍保持可見。"
			: "Close a thread to new comments this many days after the article's publish date (or, if the host page doesn't send one, the first comment's date). 0 = never auto-close by age. Existing comments stay visible.",
	},
	{
		key: "community_min_votes",
		label: isZh ? "社群自動摺疊：最低票數門檻" : "Auto-collapse: minimum votes",
		help: isZh
			? "留言需累積至少此總票數，反對票比例才會觸發自動摺疊。保護新留言避免因單一反對票即被摺疊。若下方反對票比例設為 0 則忽略此項。"
			: "A comment needs at least this many total votes before the downvote ratio can collapse it. Guards new comments from being folded by a single downvote. Ignored when the ratio below is 0.",
	},
	{
		key: "community_collapse_ratio",
		label: isZh ? "社群自動摺疊：反對票比例 (%)" : "Auto-collapse: downvote %",
		help: isZh
			? "當反對票達到此百分比且符合上方最低票數時自動摺疊留言（讀者仍可手動展開）。0 = 永不自動摺疊。需啟用反對票功能。"
			: "Fold a comment (readers can still expand it) once this percent of its votes are downvotes and it has met the minimum above. 0 = never auto-collapse. Needs downvotes enabled.",
	},
];

const getPrivacyNumberMeta = (isZh: boolean): { key: NumberKey; label: string; help: string }[] => [
	{
		key: "ip_hash_retention_days",
		label: isZh ? "清除已儲存之 IP 雜湊天數 (天)" : "Clear stored IP hashes after (days)",
		help: isZh
			? "當留言與檢舉達到此天數後，抹除其儲存之 IP 雜湊與使用者代理 (User-Agent)。0 = 永久保留 (預設值)。1 至 6 天的設定將被忽略（定時清理機制強制要求至少 7 天以防誤刪）。不可逆：清除後的雜湊無法復原，亦將無法比對同網路下的惡意規避者。匿名影子帳號不會被清理（雜湊即其身分識別）。"
			: "Erase the hashed IP and user-agent on comments and reports once they're this old. 0 = keep them for the life of the row (the default). Values from 1 to 6 are ignored — the sweep refuses anything under 7 days so a typo can't wipe nearly everything. Irreversible: a cleared hash is gone, and with it the ability to spot a ban evader on that network. Anonymous ghost accounts are never swept — their hash is the identity itself.",
	},
	{
		key: "audit_log_retention_days",
		label: isZh ? "刪除稽核日誌紀錄天數 (天)" : "Delete audit-log rows after (days)",
		help: isZh
			? "清理超過此天數的審核稽核軌跡。0 = 永久保留 (預設值)。1 至 29 天的設定將被忽略（定時清理機制強制要求至少 30 天，因審核紀錄具長期參考價值）。不可逆，且整列紀錄將直接刪除。若希望明確限制個資保留週期，可設定此項。"
			: 'Prune the moderation audit trail once entries are this old. 0 = keep it forever (the default). Values from 1 to 29 are ignored — the sweep refuses anything under 30 days, a higher floor than the IP one because a moderation record stays useful for months. Irreversible, and whole rows go rather than being redacted: an audit entry with the actor stripped out reads as evidence while proving nothing. Set this if "we keep moderation records indefinitely" is a retention period you\'d rather not have to justify.',
	},
];

const getEmailNumberMeta = (isZh: boolean): { key: NumberKey; label: string; help: string }[] => [
	{
		key: "confirm_send_burst_max",
		label: isZh ? "每分鐘確認信發信上限 (全域)" : "Confirmation emails per minute (global)",
		help: isZh
			? '此實例在任何 60 秒時間窗口內發送的訂閱確認信總數上限（跨全體讀者）。若熱門文章導致真實訂閱者遇到「請求過多 (429)」，可提高此數值。不可設為 0。'
			: 'Total subscription-confirmation emails this instance will send in any 60-second window, across all readers. Raise it if a post gets busy enough that genuine subscribers see "too many requests" — the log line to look for in `wrangler tail` is `confirmation email budget exhausted`. Cannot be set to 0: a 0 ceiling silently breaks all new subscriptions rather than disabling the check.',
	},
	{
		key: "confirm_send_daily_max",
		label: isZh ? "每日確認信發信上限 (全域)" : "Confirmation emails per day (global)",
		help: isZh
			? "在 24 小時時間窗口內的發信計數上限。預設值為 200，高於 Resend 免費方案的 100 封/日。若希望在郵件服務商拒絕前停止發信，可調降此數值。"
			: "Same counter over a 24-hour window. The default 200 sits deliberately above Resend's free-tier 100/day, so your mail provider's limit is what a normal instance meets first. Lower it below 100 (minus your expected digest volume) if you'd rather Garrul stop sending before your provider starts rejecting.",
	},
];

const getSpamNumberMeta = (isZh: boolean): { key: NumberKey; label: string; help: string }[] => [
	{
		key: "spam_link_threshold",
		label: isZh ? "超連結數量門檻" : "Link threshold",
		help: isZh
			? "留言包含超過此數量的超連結時送入審核佇列。-1 = 關閉檢查；0 = 只要包含任何連結即送入佇列。成本：零——完全在記憶體中計算。"
			: "Queue a comment carrying more than this many links. -1 = check off; 0 = queue anything with a link at all. Cost: none — it counts links in memory.",
	},
	{
		key: "spam_honeypot_min_ms",
		label: isZh ? "表單最短填寫時間 (毫秒)" : "Minimum fill time (ms)",
		help: isZh
			? "自表單載入後提交速度快於此毫秒數的留言將送入佇列——機器人會瞬間發言，人類不會。0 = 關閉檢查。成本：每位開始撰寫的讀者額外增加一次 Worker 請求以取得簽章之表單 Token。"
			: "Queue a comment submitted faster than this after the form loaded — bots post instantly, people don't. 0 = check off. Cost: one extra Worker request per reader who starts writing, to fetch the signed form token.",
	},
	{
		key: "spam_ai_threshold",
		label: isZh ? "AI 垃圾訊息判定閥值 (%)" : "AI spam threshold (%)",
		help: isZh
			? "僅在 SPAM_PROVIDER 為 workers-ai 時生效。當分類器判定為垃圾訊息的機率達到此百分比時送入佇列。數值越低抓得越嚴，但也可能攔截更多正常留言。成本：每則留言一次 Workers AI 呼叫，約 1–3 個神經元。每日免費 10,000 個神經元可支援數千則留言。"
			: "Only used when SPAM_PROVIDER is workers-ai. Queue a comment when the classifier rates it at least this likely to be spam. Lower catches more spam and queues more real comments. Each comment's detail page shows the classifier score (0–1), so you can tune this against real traffic. Cost: one Workers AI call per comment, roughly 1–3 neurons (an estimate; Usage shows the measured average per call). The 10,000 free neurons a day cover a few thousand comments. The threshold does not change the cost.",
	},
];

const localeOptions = (isZh: boolean): { value: string; label: string }[] => [
	{
		value: AUTO_LOCALE,
		label: isZh
			? "跟隨頁面 (<html lang>)，否則使用英文"
			: "Follow the page (<html lang>), else English",
	},
	...Object.entries(LOCALES).map(([tag, meta]) => {
		const name =
			meta.endonym === meta.label
				? `${meta.label} (${tag})`
				: `${meta.endonym} — ${meta.label} (${tag})`;
		return {
			value: tag,
			label:
				meta.status === "machine-seeded"
					? isZh
						? `${name} — 機器翻譯，尚未經人工校對`
						: `${name} — machine-translated, not yet reviewed`
					: name,
		};
	}),
];

export const renderSettings = (
	env: Bindings,
	flags: ResolvedFlags,
	numbers: ResolvedNumbers,
	strings: ResolvedStrings,
	texts: ResolvedTexts,
	isZh: boolean = false,
): string => {
	const flagMeta = getFlagMeta(isZh);
	const modFlagMeta = getModFlagMeta(isZh);
	const allFlagMeta = [...flagMeta, ...modFlagMeta];
	const numberMeta = getNumberMeta(isZh);
	const modNumberMeta = getModNumberMeta(isZh);
	const privacyNumberMeta = getPrivacyNumberMeta(isZh);
	const emailNumberMeta = getEmailNumberMeta(isZh);
	const spamNumberMeta = getSpamNumberMeta(isZh);

	const rows: [string, string][] = [
		["ENV", env.ENV ?? "(unset)"],
		["ALLOWED_ORIGINS", env.ALLOWED_ORIGINS ?? "(unset)"],
		["ADMIN_EMAILS", env.ADMIN_EMAILS ?? "(unset)"],
		["TURNSTILE_SITE_KEY", env.TURNSTILE_SITE_KEY ? "(set)" : "(unset)"],
		["GH_CLIENT_ID", env.GH_CLIENT_ID ? "(set)" : "(unset)"],
		["GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID ? "(set)" : "(unset)"],
		["FACEBOOK_CLIENT_ID", env.FACEBOOK_CLIENT_ID ? "(set)" : "(unset)"],
		["TWITTER_CLIENT_ID", env.TWITTER_CLIENT_ID ? "(set)" : "(unset)"],
		["DISCORD_CLIENT_ID", env.DISCORD_CLIENT_ID ? "(set)" : "(unset)"],
		[
			"OAUTH_CALLBACK_BASE",
			env.OAUTH_CALLBACK_BASE ?? (isZh ? "(預設使用請求來源 Origin)" : "(falls back to request origin)"),
		],
		["EMAIL_PROVIDER", env.EMAIL_PROVIDER ?? "(unset)"],
		["SPAM_PROVIDER", env.SPAM_PROVIDER || "(unset)"],
		["AKISMET_API_KEY", env.AKISMET_API_KEY ? "(set)" : "(unset)"],
		["AKISMET_SITE_URL", env.AKISMET_SITE_URL ?? "(unset)"],
		["SPAM_FORM_TS_SECRET", env.SPAM_FORM_TS_SECRET ? "(set)" : "(unset)"],
	];
	const body = rows
		.map(
			([k, v]) =>
				`<tr><td><code>${k}</code></td><td>${escapeHtml(v)}</td></tr>`,
		)
		.join("");

	const toggles = flagMeta.map((f) =>
		renderSwitch({
			name: f.key,
			model: `flags.${f.key}`,
			label: f.label,
			help: f.help,
		}),
	).join("");

	const stepper = (f: { key: NumberKey; label: string; help: string }) => {
		const b = numberBounds(f.key);
		return renderStepper({
			name: f.key,
			model: `nums.${f.key}`,
			min: b.min,
			max: b.max,
			label: f.label,
			help: f.help,
		});
	};
	const numberInputs = numberMeta.map(stepper).join("");
	const modNumberInputs = modNumberMeta.map(stepper).join("");
	const spamNumberInputs = spamNumberMeta.map(stepper).join("");
	const privacyNumberInputs = privacyNumberMeta.map(stepper).join("");
	const emailNumberInputs = emailNumberMeta.map(stepper).join("");
	const modToggles = modFlagMeta.map((f) =>
		renderSwitch({
			name: f.key,
			model: `flags.${f.key}`,
			label: f.label,
			help: f.help,
		}),
	).join("");

	const hasFormTsSecret = Boolean(env.SPAM_FORM_TS_SECRET);

	const localeSelect = renderSelect({
		name: "default_locale",
		model: "strs.default_locale",
		options: localeOptions(isZh),
		label: isZh ? "預設語系" : "Language",
		help: isZh
			? "Widget 介面、Atom Feed 與通知信件之預設語言。留言內容絕不會被翻譯。個別嵌入代碼可使用 data-lang 覆蓋此設定。「跟隨頁面」將讀取宿主頁面的 <html lang>（僅限已審核之語系）。"
			: 'Language for the widget, the Atom feed and notification emails. Comment text is never translated. An embed can override this per-page with data-lang. "Follow the page" reads the host page\'s <html lang> — reviewed translations only, so a machine-translated language has to be chosen here or on the embed.',
	});

	const sortSelect = renderSelect({
		name: "default_sort",
		model: "strs.default_sort",
		options: [
			{ value: "new", label: isZh ? "最新優先" : "Newest first" },
			{ value: "old", label: isZh ? "最早優先 — 按時間順序" : "Oldest first — chronological" },
			{
				value: "top",
				label: flags.votes_enabled
					? (isZh ? "最高分優先 (熱門)" : "Top — highest score first")
					: (isZh ? "最高分優先 (熱門) (未生效：投票功能已關閉)" : "Top — highest score first (inactive: voting is off)"),
			},
		],
		label: isZh ? "預設排序" : "Default order",
		help: isZh
			? "頂層留言初次載入時的排序方式。讀者仍可自行切換排序。「熱門/最高分優先」需啟用投票功能——關閉時將自動以「最新優先」載入，並保留您的設定以便重新啟用時生效。"
			: 'Order top-level comments load in. Readers can still switch order themselves; this is only where they start. "Top" needs voting enabled — with voting off it serves newest first instead, and your choice here is kept for if you turn voting back on.',
	});

	const blocklistTextarea = renderTextarea({
		name: "spam_blocklist",
		model: "texts.spam_blocklist",
		label: isZh ? "敏感詞 / 屏蔽詞清單" : "Muted words",
		help: isZh
			? `每行一個詞。單獨字詞僅進行全詞比對；使用 <code>*casino*</code> 可進行任意位置包含比對，或以 <code>t.me/*</code> 進行前綴比對。不區分大小寫，形似字元與零寬字元將自動摺疊標準化。此處並非正規表達式。以 <code>#</code> 開頭的行視為註解。將比對留言內容、作者名稱與頁面 URL。一旦命中將送入審核佇列，絕不會靜默丟棄。最多可設定 ${MAX_TERMS} 個詞，每個詞上限 ${MAX_TERM_CHARS} 字元與 ${MAX_WILDCARDS} 個萬用字元。成本：零——記憶體比對，不增加資料庫或 KV 負擔。`
			: `One term per line. A bare term matches whole words only, so
		<code>ass</code> does not flag "class"; wrap it in <code>*</code> to match
		anywhere (<code>*casino*</code>) or trail one for a prefix
		(<code>t.me/*</code>). Case-insensitive, and lookalike forms
		(<code>ｖｉａｇｒａ</code>) and zero-width characters are folded away —
		but accents are kept and leetspeak is not decoded. This is not a regex:
		<code>.</code> and <code>(</code> are literal. Lines starting with
		<code>#</code> are comments. Checked against the comment body, author name
		and page URL. A hit sends the comment to the queue; nothing is ever
		silently dropped. Up to ${MAX_TERMS} terms, ${MAX_TERM_CHARS} characters
		and ${MAX_WILDCARDS} wildcards each — a term over those limits is skipped,
		the rest of the list still applies. Cost: none — the list is matched in
		memory and adds no database or KV traffic.`,
		rows: 10,
		maxlength: MAX_TEXT_SETTING_CHARS,
		placeholder: "viagra\n*casino*\nt.me/*",
	});

	const reservedNamesTextarea = renderTextarea({
		name: "reserved_names",
		model: "texts.reserved_names",
		label: isZh ? "保留名稱清單" : "Reserved names",
		help: isZh
			? `每行一個名稱。匿名留言者無法使用此處任一名稱發言。比對時忽略大小寫、空格、<code>.</code> <code>_</code> <code>-</code> 與形似字元。僅比對全名。以 <code>#</code> 開頭的行視為註解。已登入使用者的名稱會自動受到保護，此處僅需填寫額外保留之名稱（例如您自己或站台名稱）。`
			: `One name per line. An anonymous commenter can't post under any of
		them. Matching ignores case, spaces, <code>.</code> <code>_</code>
		<code>-</code> and lookalike forms, so <code>Site Admin</code> also
		catches <code>site_admin</code> and <code>ＳＩＴＥＡＤＭＩＮ</code>. Whole names
		only: <code>admin</code> does not refuse "admin fan". Lines starting with
		<code>#</code> are comments. Names that signed-in users already post
		under are refused automatically; list only names you want held back on
		top of those — your own, or your site's.`,
		rows: 4,
		maxlength: MAX_TEXT_SETTING_CHARS,
		placeholder: isZh ? "站台管理員\n管理員" : "Site Admin\nModerator",
	});

	const securityContactTextarea = renderTextarea({
		name: "security_contact",
		model: "texts.security_contact",
		label: isZh ? "漏洞通報聯絡管道" : "Disclosure contact",
		help: isZh
			? `電子郵件地址，或 <code>https://</code> 或 <code>mailto:</code> 連結。若留空（預設值）則路由回傳 404。`
			: `An email address, or an <code>https://</code> or
		<code>mailto:</code> URI. Anything else is treated as unset. Empty (the
		default) keeps the route a 404 — the file is only served once there is a
		real contact behind it.`,
		rows: 2,
		maxlength: MAX_TEXT_SETTING_CHARS,
		placeholder: "security@example.com",
	});

	const staffLabelTextarea = renderTextarea({
		name: "staff_badge_label",
		model: "texts.staff_badge_label",
		label: isZh ? "官方徽章標籤文字" : "Staff badge label",
		help: isZh
			? `顯示於管理員以官方身分發言時其名稱旁的標籤。若留空（預設值）則依讀者語言顯示。上限 ${STAFF_BADGE_LABEL_MAX} 字元。`
			: `Shown next to a moderator's name on comments they chose to post as
		staff. Empty (the default) uses the reader's language — "Staff" in
		English. Up to ${STAFF_BADGE_LABEL_MAX} characters.`,
		rows: 1,
		maxlength: STAFF_BADGE_LABEL_MAX,
		placeholder: isZh ? "官方" : "Staff",
	});

	const commentKindChips = renderKindChips(
		"comment_reaction_kinds",
		isZh ? "留言表情符號" : "Comment reaction emoji",
		isZh
			? "讀者可在留言上留下的表情符號，由左至右排列。登入讀者會在每則留言看到所有啟用的表情符號，建議不超過 6 個以維持美觀。關閉某個表情會將其隱藏；已留下的反應仍會保留並在重新開啟時顯示。至少需保留一個開啟——若需完全停用請使用上方功能開關。"
			: "Which emoji readers can leave on a comment, left to right. Signed-in readers see every enabled emoji on every comment, so more than about six gets crowded. Turning one off hides it; reactions already left are kept and reappear if you turn it back on. At least one stays on — use the switch above to turn reactions off.",
	);
	const pageKindChips = renderKindChips(
		"page_reaction_kinds",
		isZh ? "頁面表情符號" : "Page reaction emoji",
		isZh
			? "文章反應列所提供的表情符號，由左至右排列。僅在「頁面表情反應」開關開啟時使用。"
			: "Which emoji the article bar offers, left to right. Each shows with its label, so a long list wraps onto more lines. Only used while Page reactions is on.",
	);

	const initial = JSON.stringify(
		Object.fromEntries(allFlagMeta.map((f) => [f.key, flags[f.key]])),
	);
	const numInitial = JSON.stringify(numbers);
	const strInitial = JSON.stringify(strings);
	const textInitial = `{${TEXT_KEYS.map(
		(k) =>
			`${jsLiteralRaw(k)}:${jsLiteralRaw(isReactionKindsKey(k) ? reactionKinds(texts, k).join(",") : texts[k])}`,
	).join(",")}}`;

	return `
<div x-data="{
  tab: 'features',
  busy: false,
  flags: ${escapeHtml(initial)},
  nums: ${escapeHtml(numInitial)},
  strs: ${escapeHtml(strInitial)},
  texts: ${escapeHtml(textInitial)},
  vocab: ${escapeHtml(VOCAB_SEED)},
  kindsOf(key) {
    return this.texts[key].split(',').map((k) => k.trim())
      .filter((k, i, a) => Object.prototype.hasOwnProperty.call(this.vocab, k) && a.indexOf(k) === i);
  },
  kindOn(key, kind) { return this.kindsOf(key).includes(kind); },
  chipOrder(key) {
    const on = this.kindsOf(key);
    return [...on, ...Object.keys(this.vocab).filter((k) => !on.includes(k))];
  },
  toggleKind(key, kind) {
    const l = this.kindsOf(key);
    const i = l.indexOf(kind);
    if (i === -1) l.push(kind);
    else if (l.length > 1) l.splice(i, 1);
    this.texts[key] = l.join(',');
  },
  moveKind(key, kind, d) {
    const l = this.kindsOf(key);
    const i = l.indexOf(kind);
    const j = i + d;
    if (i === -1 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.texts[key] = l.join(',');
  },
  hasFormTsSecret: ${hasFormTsSecret},
  get blocklistTermCount() {
    return this.texts.spam_blocklist
      .split('\\n')
      .filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;
  },
  get autoCloseDate() {
    return this.nums.auto_close_at
      ? new Date(this.nums.auto_close_at).toISOString().slice(0, 10)
      : '';
  },
  set autoCloseDate(v) {
    this.nums.auto_close_at = v ? Date.parse(v + 'T23:59:59Z') : 0;
  },
  async save() {
    this.busy = true;
    try {
      const r = await fetch('/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flags: this.flags, numbers: this.nums, strings: this.strs, texts: this.texts }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || ('${isZh ? "儲存失敗: " : "Save failed: "}' + r.status));
      }
      this.$dispatch('toast', { text: '${isZh ? "設定已儲存" : "Settings saved"}' });
    } catch (err) {
      this.$dispatch('toast', { text: err.message || '${isZh ? "儲存失敗" : "Save failed"}', kind: 'bad' });
    } finally {
      this.busy = false;
    }
  },
  async reset() {
    if (!confirm('${isZh ? "清除所有執行期設定覆蓋並恢復環境變數與系統預設值？" : "Clear all runtime overrides and fall back to env vars / defaults?"}')) return;
    this.busy = true;
    try {
      const r = await fetch('/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || ('${isZh ? "重設失敗: " : "Reset failed: "}' + r.status));
      }
      this.$dispatch('toast', { text: '${isZh ? "已恢復預設值" : "Reset to defaults"}' });
      setTimeout(() => location.reload(), 300);
    } catch (err) {
      this.$dispatch('toast', { text: err.message || '${isZh ? "重設失敗" : "Reset failed"}', kind: 'bad' });
      this.busy = false;
    }
  },
}">
  ${renderTabs("tab", getTabs(isZh))}

  <form @submit.prevent="save()">
    <div class="card" x-show="tab === 'features'">
      <h2>${isZh ? "功能特性開關" : "Features"}</h2>
      <p class="muted">${isZh ? "無需重新部署即可切換功能開關。此處設定將覆蓋對應的環境變數（VOTING_ENABLED, REACTIONS_ENABLED ...）；「重設為預設值」將清除覆蓋並恢復環境變數與系統預設值。" : `Toggle features without a redeploy. A toggle here overrides
      the matching env var (<code>VOTING_ENABLED</code>, <code>REACTIONS_ENABLED</code>,
      …); "Reset to defaults" clears the overrides so the env vars / built-in
      defaults apply again.`}</p>
      <p role="note" class="muted">${isZh ? "<strong>暫停 OAuth 登入：</strong>關閉此項將阻擋新的第三方登入、進行中的回調與權限交換。現有 Session 仍保持有效。請務必保留有效的管理員 Session；若無法登入，請依 <code>AGENTS-OPERATE.md</code> 進行 OAuth 恢復。" : `<strong>OAuth sign-in pause:</strong> Turning this off blocks new provider sign-ins, callbacks already in progress, and handoff exchanges. Existing sessions stay valid. Keep an active admin session; if no admin can sign in, follow the OAuth recovery steps in <code>AGENTS-OPERATE.md</code>.`}</p>
      ${toggles}
      <h3>${isZh ? "表情符號設定" : "Reaction emoji"}</h3>
      ${commentKindChips}${pageKindChips}
    </div>

    <div class="card" x-show="tab === 'display'" x-cloak>
      <h2>${isZh ? "顯示與分頁設定" : "Display &amp; pagination"}</h2>
      <p class="muted">${isZh ? "控制每次載入留言的數量以及巢狀回覆的摺疊規則。較小的數值可避免熱門討論串將頁面下方內容過度往下推擠。" : `Control how many comments load at once and how nested
      replies collapse. Smaller values keep a busy thread from pushing the rest
      of the page down.`}</p>
      ${numberInputs}
      ${sortSelect}
      ${localeSelect}
    </div>

    <div class="card" x-show="tab === 'moderation'" x-cloak>
      <h2>${isZh ? "內容審核" : "Moderation"}</h2>
      <p class="muted">${isZh ? "留言編輯時限、討論串自動關閉與社群自動摺疊規則。自動關閉與自動摺疊預設為關閉。關閉討論串僅阻擋<em>新留言</em>——現有留言仍保持可見，且評分/表情反應仍正常運作。自動摺疊僅收合反對票過多的留言，讀者仍可手動展開。" : `The edit window, thread auto-close and community
      auto-collapse. Auto-close and auto-collapse are off by default. Closing a
      thread only blocks <em>new</em> comments — existing ones stay visible and
      votes/reactions stay live. Auto-collapse just folds heavily-downvoted
      comments; readers can still expand them.`}</p>
      ${modNumberInputs}
      <div class="field-row">
        <span class="field-control">
          <input type="date" x-model="autoCloseDate">
          <button type="button" class="secondary" @click="autoCloseDate = ''"
                  x-show="nums.auto_close_at">${isZh ? "清除" : "Clear"}</button>
        </span>
        <span class="field-text">
          <strong>${isZh ? "在此日期關閉所有討論串" : "Close all threads on"}</strong>
          <span class="muted">${isZh ? "全站終止討論設定：一旦超過此日期，所有討論串均不再接受新留言。留空表示停用。在日期經過數分鐘內生效。" : `Instance-wide sunset: once this date passes, no
          thread accepts new comments. Leave empty to disable. Takes effect
          within a few minutes of the date passing.`}</span>
        </span>
      </div>
      <input type="hidden" name="auto_close_at" x-model.number="nums.auto_close_at"
             min="${numberBounds("auto_close_at").min}"
             max="${numberBounds("auto_close_at").max}">
      ${staffLabelTextarea}
    </div>

    <div class="card" x-show="tab === 'moderation'" x-cloak>
      <h2>${isZh ? "防垃圾啟發式規則" : "Anti-spam heuristics"}</h2>
      <p class="muted">${isZh ? "在選擇性的 AI 分類器之前執行的輕量本地檢查。觸發檢查絕不會丟棄留言——而是將其導向審核佇列。分類器提供者與其 API 金鑰保留於 <code>wrangler.toml</code>；請參閱環境變數配置標籤頁。" : `Cheap local checks that run before the optional
      classifier. A tripped check never drops a comment — it routes it to the
      queue, so tune these while watching what lands there. The classifier
      provider and its API keys stay in <code>wrangler.toml</code>; see the
      Configuration tab.`}</p>
      <p class="muted">${isZh ? "下方每個提示均標註了檢查成本。此外，每次檢查執行都會寫入一列判定記錄至 D1。若已有本地規則將留言送入佇列，則會跳過 AI 分類器。<a href=\"/admin/usage\">用量統計</a> 顯示當日累計統計。" : `Each hint below names what the check costs per comment.
      On top of that, any check that runs writes one verdict row to D1 (about
      three rows written with its indexes, against 100,000 a day on the free
      tier). The classifier is skipped when a check has already queued the
      comment. <a href="/admin/usage">Usage</a> shows today's totals.`}</p>
      ${modToggles}
      ${spamNumberInputs}
      <p class="muted" x-show="nums.spam_honeypot_min_ms > 0 && !hasFormTsSecret" x-cloak>
      <strong>${isZh ? "填寫時間檢查目前未啟用。" : "Fill-time check is inactive."}</strong> ${isZh ? "需要配置 <code>SPAM_FORM_TS_SECRET</code> 來為表單時間戳記簽章——沒有金鑰的時間戳記極易偽造，因此該檢查會被跳過。請使用 <code>wrangler secret put SPAM_FORM_TS_SECRET</code> 設定金鑰並重新部署。" : `It needs
      <code>SPAM_FORM_TS_SECRET</code> to sign the form timestamp — without it an
      unsigned time is trivially forged, so the check is skipped. Set the secret
      with <code>wrangler secret put SPAM_FORM_TS_SECRET</code> and redeploy.`}</p>
      ${blocklistTextarea}
      <p class="muted" x-show="blocklistTermCount > 0" x-cloak>
      <span x-text="blocklistTermCount"></span> ${isZh ? "個規則詞。" : "term(s)."}
      <span x-show="blocklistTermCount > ${MAX_TERMS}"><strong>${isZh ? `僅前 ${MAX_TERMS} 個規則會被檢查` : `Only the first ${MAX_TERMS} are checked`}</strong> — ${isZh ? "其餘將被忽略。" : "the rest are ignored."}</span></p>
      <p class="muted">${isZh ? "清空輸入框將儲存<em>空白清單</em>，這與從未設定不同：它將覆蓋您部署中包含的任何 <code>SPAM_BLOCKLIST</code>。點擊「重設為預設值」可恢復部署設定。" : `Clearing the box saves an <em>empty</em> list, which is not
      the same as never having set one: it overrides whatever
      <code>SPAM_BLOCKLIST</code> your deploy ships. "Reset to defaults" is the
      way back to that.`}</p>
      ${reservedNamesTextarea}
    </div>

    <div class="card" x-show="tab === 'moderation'" x-cloak>
      <h2>${isZh ? "確認信發送上限" : "Confirmation-email ceiling"}</h2>
      <p class="muted">${isZh ? "此實例允許發送訂閱確認信的嚴格上限，以全域而非個別讀者計算。已確認的訂閱者及其摘要通知絕不受此限制影響。拒絕記錄將記載於日誌中，請在調整前透過 <code>wrangler tail</code> 觀察。" : `A hard cap on how much subscription-confirmation mail this
      instance will send, counted globally rather than per reader. It exists
      because the other two limits on that endpoint can both be walked past by an
      attacker cycling email addresses, so this is the one that holds — at the
      cost of being shared: a spent window turns away genuine new subscribers
      until it rolls. Already-confirmed subscribers and their digests are never
      affected. Denials are logged, so watch <code>wrangler tail</code> before
      assuming these need raising.`}</p>
      ${emailNumberInputs}
    </div>

    <div class="card" x-show="tab === 'moderation'" x-cloak>
      <h2>${isZh ? "隱私保留政策" : "Privacy retention"}</h2>
      <p class="muted">${isZh ? "888echo 會儲存留言者 IP 的雜湊值（絕不儲存原始 IP），以便您識別同網路下的惡意規避者並去除重複檢舉。保留政策為其設定過期機制：超過時間窗口後，定時排程會清除留言與檢舉中的雜湊與 User-Agent。預設關閉。" : `Garrul stores a keyed hash of the commenter's IP (never
      the address itself) so you can spot a ban evader on the same network and
      dedupe abuse reports. Retention puts an expiry on that: past the window,
      the cron erases the hash and user-agent from comments and reports, so a
      database export carries a bounded slice of history instead of everything
      the instance has ever seen. Off by default.`}</p>
      ${privacyNumberInputs}
      <p class="muted"><strong>${isZh ? "此操作無法撤銷。" : "This one can't be undone."}</strong> ${isZh ? "將時間設定回 0 僅會停止未來的清理排程，無法復原已被清理的資料。可在 <a href=\"/admin/operator\">維運操作</a> 查看排程執行狀態或依需求手動清理。" : `Setting the
      window back to 0 stops future sweeps; it does not restore what a sweep
      already erased. Watch it run, and drain a backlog on demand, from
      <a href="/admin/operator">Operator</a>.`}</p>
    </div>

    <div class="card" x-show="tab === 'moderation'" x-cloak>
      <h2>${isZh ? "安全性漏洞通報聯絡管道" : "Vulnerability disclosure"}</h2>
      <p class="muted">${isZh ? "供資安研究人員通報此實例漏洞的聯絡方式。設定後將發布於 <a href=\"/.well-known/security.txt\" target=\"_blank\" rel=\"noopener\"><code>/.well-known/security.txt</code></a> (RFC 9116)。若未設定，該路徑將回傳 404。" : `Where a security researcher should report a
      vulnerability in this instance. When set, it is published at
      <a href="/.well-known/security.txt" target="_blank" rel="noopener"><code>/.well-known/security.txt</code></a>
      (RFC 9116), the standard place researchers look. Unset, that route
      answers 404.`}</p>
      ${securityContactTextarea}
    </div>

    <p class="settings-actions" x-show="tab !== 'config'">
      <button type="submit" class="btn-primary" :disabled="busy">${isZh ? "儲存設定" : "Save settings"}</button>
      <button type="button" class="secondary" @click="reset()" :disabled="busy">${isZh ? "重設為預設值" : "Reset to defaults"}</button>
    </p>
  </form>

  <div class="card" x-show="tab === 'config'" x-cloak>
    <h2>${isZh ? "部署環境變數 (唯讀)" : "Configuration"}</h2>
    <p class="muted">${isZh ? "以下為部署時環境變數。請使用 <code>wrangler secret put NAME</code> 修改金鑰（或修改 <code>wrangler.toml</code> 中的 <code>[vars]</code>）並重新部署。" : `These remain environment variables. Change them with
    <code>wrangler secret put NAME</code> (or edit <code>wrangler.toml</code>
    <code>[vars]</code> for non-secrets) and redeploy.`}</p>
    <table>
      <thead><tr><th>${isZh ? "變數名稱" : "Variable"}</th><th>${isZh ? "設定值" : "Value"}</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <h3>${isZh ? "資源綁定 (Bindings)" : "Bindings"}</h3>
    <ul>
      <li><code>DB</code> — ${isZh ? "D1 資料庫 (留言、使用者、表情反應、文章)" : "D1 database (comments, users, reactions, posts)"}</li>
      <li><code>RATE_LIMITS</code>, <code>OAUTH_STATE</code>, <code>SESSIONS</code>, <code>TREE_CACHE</code> — ${isZh ? "KV 命名空間" : "KV namespaces"}</li>
      <li><code>ANALYTICS</code> — ${isZh ? "Workers Analytics Engine 資料集 (可選)" : "Workers Analytics Engine dataset (optional)"}</li>
    </ul>
  </div>
</div>`;
};
