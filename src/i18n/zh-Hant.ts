/**
 * Traditional Chinese server strings for 888echo.
 * Fully localized for Taiwan, Hong Kong, and Macau.
 */
import type { LocaleTable } from "./index";

export const zhHant = {
	// Validation / API errors
	"err.body.required": "請輸入留言內容。",
	"err.body.too_long": "留言內容過長（最多 {max} 個字元）。",
	"err.post.required": "缺少文章識別碼。",
	"err.post.invalid": "無效的文章識別碼。",
	"err.parent.not_found": "找不到回覆的父留言。",
	"err.parent.different_post": "回覆的留言屬於不同的文章。",
	"err.parent.too_deep": "留言巢狀層級過深，請在較上層發表回覆。",
	"err.name.required": "請輸入顯示名稱。",
	"err.name.too_long": "顯示名稱過長（最多 {max} 個字元）。",
	"err.name.reserved": "此名稱已保留，匿名留言無法使用，請更換名稱或登入。",
	"err.turnstile.required": "安全驗證未完成，請重新整理頁面後再試。",
	"err.turnstile.invalid": "安全驗證失敗，請重新整理頁面後再試。",
	"err.ratelimit": "留言頻率過高，請稍候片刻再試。",
	"err.honeypot": "留言已被系統拒絕。",
	"err.origin.forbidden": "請求被攔截：來源不被允許。",
	"err.session.expired": "登入階段已過期，請重新整理頁面後登入。",
	"err.edit.window_expired": "編輯時限已過，無法再編輯此留言。",
	"err.edit.not_author": "你只能編輯自己的留言。",
	"err.delete.not_author": "你只能刪除自己的留言。",
	"err.not_found": "找不到目標資源。",
	"err.banned": "你的帳號已被封鎖。",
	"err.staff.forbidden": "只有登入的工作人員能標記為官方回覆。",
	"err.thread_closed": "這篇文章已關閉留言功能。",
	"err.email.invalid": "請輸入有效的電子郵件地址。",
	"err.comment.confirm_unavailable":
		"目前暫時無法寄送電子郵件確認信，請稍後再試。",
	"err.internal": "系統發生錯誤，請稍後再試。",

	// Server-rendered UI strings
	"ui.deleted": "[已刪除]",
	"ui.subscribe.pending": "請查看收件匣以確認訂閱。",
	"ui.subscribe.confirmed": "訂閱已確認。",

	// Subscription confirmation and unsubscribe pages
	"ui.subscribe.link_expired": "連結已過期或已使用。",
	"ui.subscribe.confirmed_page": "你已確認訂閱「{title}」的留言通知。",
	"ui.subscribe.already_unsubscribed": "你已取消訂閱「{title}」的留言通知。",
	"ui.subscribe.unsubscribed": "你已取消訂閱「{title}」的留言通知。",
	"ui.subscribe.unsubscribe_confirm": "要取消訂閱「{title}」的留言通知嗎？",
	"ui.subscribe.unsubscribe_cta": "是，取消訂閱",
	"ui.subscribe.unsubscribe_note": "尚未變更；確認前你仍會收到通知。",
	"ui.subscribe.confirm_prompt": "要開啟「{title}」的留言通知嗎？",
	"ui.subscribe.confirm_cta": "是，通知我",
	"ui.subscribe.confirm_note": "尚未變更；確認前你不會收到通知。",
	"ui.subscribe.manage_others": "此電子郵件地址也有訂閱以下討論串的通知：",
	"ui.subscribe.unsubscribe_row_cta": "取消訂閱",
	"ui.subscribe.unsubscribe_all_cta": "取消所有討論串的訂閱",
	"ui.subscribe.unsubscribed_all": "你已取消所有討論串的留言通知。",

	// Transactional email
	"email.confirm.subject": "請確認你對「{title}」留言的訂閱",
	"email.confirm.heading": "確認訂閱",
	"email.confirm.intro": "有人要求訂閱「{title}」的新留言通知，請確認此訂閱。",
	"email.confirm.ignore":
		"如果這不是你提出的要求，請忽略這封電子郵件。若未點擊下方的確認連結，我們不會再寄送此討論串的通知。",
	"email.confirm.cta": "確認訂閱",
	"email.confirm.paste": "或將此連結貼到瀏覽器中：",
	"email.digest.subject": "「{title}」有新留言",
	"email.digest.heading": { other: "「{title}」有 {count} 則新留言" },
	"email.digest.permalink": "永久連結",
	"email.digest.unsubscribe": "取消此討論串的訂閱",

	// Comment inbox confirmation
	"ui.comment.confirm_pending":
		"確認信已寄送！請至電子信箱點擊確認連結，完成後留言將立即發佈（若未收到請檢查垃圾郵件匣）。",
	"ui.comment.confirm_prompt": "確認要在「{title}」發布這則留言嗎？",
	"ui.comment.confirm_cta": "確認並發布留言",
	"ui.comment.confirm_note": "按下確認前，這則留言不會公開。",
	"ui.comment.confirmed_page": "留言已確認並發布。",
	"ui.comment.confirmed_moderation": "電子郵件已確認，留言正在等待管理員審核。",
	"ui.comment.link_expired": "此留言確認連結已過期或已使用。",
	"ui.comment.thread_closed": "此文章已不接受留言，因此留言未發布。",
	"ui.comment.parent_unavailable": "回覆對象已無法使用，因此留言未發布。",
	"ui.comment.return_to_post": "返回文章",
	"email.comment_confirm.subject": "請確認你在「{title}」的留言",
	"email.comment_confirm.heading": "確認留言",
	"email.comment_confirm.intro": "請確認這則發佈於「{title}」的留言是你提交的。確認後才會發布。",
	"email.comment_confirm.ignore": "如果這不是你提交的，請忽略此郵件；留言不會發布。",
	"email.comment_confirm.cta": "查看並確認留言",
	"email.comment_confirm.paste": "或在瀏覽器中開啟此連結：",

	// Atom feed
	"feed.title": "「{title}」的留言",
	"feed.entry_title": "{author} 發表了留言",

	// Telegram operator bot
	"telegram.not_linked":
		"此 Telegram 帳號尚未綁定。請至管理後台 → Telegram 進行綁定。",
	"telegram.not_authorized": "你的帳號沒有審核權限。",
	"telegram.unknown_action": "未知或已過期的操作。",
	"telegram.comment_not_found": "該留言已不存在。",
	"telegram.action_applied": "✓ 已執行 {action}",
	"telegram.reports_resolved": "✓ 已處理 {count} 則檢舉",
	"telegram.author_banned": "✓ 已封鎖留言作者",
	"telegram.ban_refused":
		"無法封鎖：這是你自己的帳號，或為最後一位可用管理員。",
	"telegram.link_ok":
		"✅ 已成功綁定至 {name}。你將會收到管理員通知，並可直接在此審核留言。",
	"telegram.link_invalid":
		"綁定代碼無效或已過期，請在管理後台重新產生代碼。",
	"telegram.link_user_missing": "綁定失敗：該管理員帳號已不存在。",
	"telegram.ratelimited": "操作過於頻繁，請稍候片刻再試。",
	"telegram.start_help":
		"請輸入 /start &lt;code&gt; 並帶入管理後台產生的代碼來綁定管理員帳號。",
} satisfies LocaleTable;
