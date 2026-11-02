# Garrul 多站點整合實戰指南 (Multi-Site Integration Guide)

本文件完整記錄將 **Garrul 留言系統** 整合至多個獨立站台（如 `blog.david888.com`、`news2.david888.com`、`podcast.david888.com`）的實戰經驗、踩坑紀錄、架構規範與標準作業程序（SOP）。

---

## 1. 架構全景：單一後端支援多站台 (Single Backend, Multi-Origin)

Garrul 原生設計為獨立部署在 Cloudflare Workers 上的無伺服器留言服務，底層依賴 Cloudflare D1（SQLite）、KV 與 Analytics Engine。

單一 Garrul Worker 完全可以作為多個站台的「集中式留言引擎」，無須為每個網站各部署一套 Worker：

```
                        ┌─────────────────────────────────────┐
                        │   Cloudflare Worker (Garrul API)     │
                        │    garrul.ai360.workers.dev         │
                        │    (D1 Database / KV / Mail / AI)   │
                        └──────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ blog.david888.com│             │news2.david888.com│             │podcast.david888  │
│  (個人技術部落格) │             │(888news 資訊聚合) │             │ (每日科技 Podcast)│
│  Hugo / Static   │             │Docker + Remix SSR│             │Next.js + OpenNext│
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

---

## 2. 核心設定與跨網域白名單 (CORS & ALLOWED_ORIGINS)

### 2.1 `wrangler.toml` 跨來源允許清單
Garrul 對所有 `/api/*` 端點實施嚴格的 Origin 來源驗證（`src/lib/cors.ts`）。任何未在 `ALLOWED_ORIGINS` 內的請求均會直接被拒絕，回傳 `HTTP 403 {"error":"err.origin.forbidden"}`。

多站點部署時，必須在 `Garrul/wrangler.toml` 的 `[vars]` 中加入所有站台網址（以逗號分隔，無空格）：

```toml
[vars]
ENV = "production"
ALLOWED_ORIGINS = "https://blog.david888.com,https://news2.david888.com,https://podcast.david888.com,https://garrul.ai360.workers.dev"
OAUTH_CALLBACK_BASE = "https://garrul.ai360.workers.dev"
PUBLIC_BASE_URL = "https://garrul.ai360.workers.dev"
```

> [!IMPORTANT]
> 1. 網址必須包含通訊協定（`https://`），且不可有結尾斜線（`/`）。
> 2. 修改 `wrangler.toml` 後，必須執行 `pnpm run deploy` 重新發布 Worker 方能生效。
> 3. 用戶若從非瀏覽器工具（如未帶 `Origin` 標頭的 `curl`）測試 API，預設會觸發 `err.origin.forbidden`，測試時請務必附帶 `-H "Origin: https://podcast.david888.com"`。

---

## 3. 文章識別碼規範（Slug 命名避坑）

### 3.1 嚴禁冒號（`:`）
Garrul 後端（`src/lib/slug.ts`、`src/routes/api.bootstrap.ts`）對文章 slug 的正規表達式約束為：
```regex
/^[a-zA-Z0-9_\-./]{1,200}$/
```
**冒號（`:`）被視為非法字元**（為防止與 URL 協定或匯入邏輯產生衝突）。若在 `data-slug` 中傳入冒號（如 `news:${id}` 或 `podcast:${date}`），Garrul 會直接拒絕並回傳 `HTTP 400 {"error":"Invalid post identifier."}`，前端會直接顯示：
```
Could not load comments.
```

### 3.2 推薦命名命名法（Namespacing with Hyphen）
為了讓多個站台共用同一個 Garrul 資料庫而不發生文章 ID 碰撞，推薦使用**站台前綴 + 連字號（`-`）**命名：

| 站台 | 頁面類型 | 錯誤命名（禁冒號） | 正確命名（連字號） |
| :--- | :--- | :--- | :--- |
| **888news** | 新聞條目 | `news:dr231y6c...` ❌ | `news-dr231y6c...` ✅ |
| **888news** | 專題故事 | `story:ev1234...` ❌ | `story-ev1234...` ✅ |
| **Podcast** | 每日單集 | `podcast:2026-11-02` ❌ | `podcast-2026-11-02` ✅ |
| **Podcast** | 多語言版本 | `podcast:2026-11-02:en` ❌ | `podcast-2026-11-02-en` ✅ |
| **Blog** | 部落格文章 | `blog:why-ai` ❌ | `blog-why-ai` ✅ |

---

## 4. 放置位置與 UX 規範（Placement Anti-Patterns）

> [!CAUTION]
> **切勿將留言板放置在首頁或清單列表（List/Feed View）中！**

### 4.1 為什麼不能放在清單列表？
1. **DOM ID 碰撞與 Shadow DOM 限制**：
   * Garrul 依賴全域唯一的 `<div id="garrul">`。
   * 一個頁面若渲染多個文章卡片，會產生多個 `id="garrul"`，導致只有第一個元素能成功掛載 Shadow DOM，其餘皆會靜默失效或拋出 `DOMException: Existing shadow root`。
2. **網路效能衝擊**：
   * 每個留言板掛載時皆會發送 `/api/v1/bootstrap` 請求。首頁若有 10 篇文章，瞬間發出 10 次 Worker 請求，容易浪費 Cloudflare 額度。
3. **版面佈局破碎**：
   * 列表頁應專注於快速瀏覽與導讀，內嵌巨大的留言板與編輯器會破壞使用者閱讀節奏。

### 4.2 正確放置位置
* **僅放置於單篇「詳細文章頁（Detail Page）」底部**：
  * Next.js: `app/post/[date]/page.tsx`
  * Remix: `apps/web/app/routes/item.tsx`、`apps/web/app/routes/story.tsx`
  * Hugo / Jekyll: `single.html`、`_layouts/post.html`
* 放置於正文、逐字稿、參考連結下方，並預留最小高度：
  ```css
  #garrul { min-height: 220px; }
  ```
  避免留言板非同步載入時引發 Cumulative Layout Shift (CLS) 視覺跳動。

---

## 5. 前端框架整合實戰

### 5.1 Next.js (App Router) + OpenNext / Cloudflare Workers
在 Next.js App Router 中，需封裝為 Client Component，並妥善處理 SPA 路由切換與 Strict Mode 重複掛載。

#### `components/comments.tsx`：
```tsx
'use client'

import React, { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CommentsProps {
  date: string
  title?: string
  url?: string
  slug?: string
  variant?: string
  published?: string
  className?: string
  showHeader?: boolean
}

const GARRUL_API = 'https://garrul.ai360.workers.dev'
const GARRUL_SCRIPT_SRC = 'https://garrul.ai360.workers.dev/embed.js'
const GARRUL_SCRIPT_ID = 'garrul-embed-script'

export function Comments({
  date,
  title,
  url,
  slug,
  variant,
  published,
  className,
  showHeader = true,
}: CommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isEn = variant === 'en'
  const lang = isEn ? 'en' : 'zh-Hant'
  const defaultSlug = variant && variant !== 'hacker-news' ? `podcast-${date}-${variant}` : `podcast-${date}`
  const finalSlug = slug || defaultSlug
  const canonicalUrl = url || (typeof window !== 'undefined'
    ? `${window.location.origin}/post/${date}${variant && variant !== 'hacker-news' ? `/${variant}` : ''}`
    : `https://podcast.david888.com/post/${date}`)
  const publishedDate = published || (date ? new Date(date).toISOString() : undefined)

  useEffect(() => {
    // 處理 SPA 切換時的 Shadow DOM 重建
    const existingHost = document.getElementById('garrul')
    if (existingHost && existingHost.shadowRoot && containerRef.current) {
      const freshHost = document.createElement('div')
      freshHost.id = 'garrul'
      freshHost.dataset.api = GARRUL_API
      freshHost.dataset.slug = finalSlug
      if (title) freshHost.dataset.title = title
      if (canonicalUrl) freshHost.dataset.url = canonicalUrl
      if (publishedDate) freshHost.dataset.published = publishedDate
      if (lang) freshHost.dataset.lang = lang
      freshHost.style.minHeight = '220px'
      existingHost.replaceWith(freshHost)
    }

    // 移除舊腳本並重新注入 embed.js
    const existingScript = document.getElementById(GARRUL_SCRIPT_ID)
    if (existingScript) existingScript.remove()

    const script = document.createElement('script')
    script.id = GARRUL_SCRIPT_ID
    script.src = GARRUL_SCRIPT_SRC
    script.async = true
    document.body.appendChild(script)

    return () => {
      const currentScript = document.getElementById(GARRUL_SCRIPT_ID)
      if (currentScript) currentScript.remove()
    }
  }, [finalSlug, title, canonicalUrl, publishedDate, lang])

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{
        '--garrul-font': 'var(--font-jetbrains-mono), var(--font-gen-jyuu-gothic), system-ui, sans-serif',
        '--garrul-accent': '#0F4C81',
        '--garrul-radius': '12px',
        '--garrul-border': '#e4e4e7',
      } as React.CSSProperties}
    >
      {showHeader && (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200/60">
          <MessageSquare className="size-4.5 text-pantone-blue" aria-hidden="true" />
          <h3 className="text-base font-bold text-zinc-900 tracking-tight">
            {isEn ? 'Discussion' : '留言討論'}
          </h3>
        </div>
      )}
      <div
        key={finalSlug}
        id="garrul"
        data-api={GARRUL_API}
        data-slug={finalSlug}
        data-title={title}
        data-url={canonicalUrl}
        data-published={publishedDate}
        data-lang={lang}
        style={{ minHeight: '220px' }}
      />
    </div>
  )
}
```

> [!WARNING]
> **OpenNext 編譯發布注意事項**：
> 當專案使用 `@opennextjs/cloudflare` 時，直接下 `wrangler deploy` **不會**重新編譯 Next.js 原始碼！
> 必須先執行打包命令，再發布：
> ```bash
> pnpm run opennext && WRANGLER_BUILD_PLATFORM=node pnpm exec wrangler deploy
> ```

---

### 5.2 Docker + Remix / SSR 整合 (`888news`)

在 Remix SSR 應用中，在路由元件中直接掛載：
```tsx
<Comments
  slug={`news-${item.id}`}
  title={item.title}
  url={`https://news2.david888.com/items/${item.id}`}
  published={item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined}
  lang="zh-Hant"
/>
```

#### 伺服器部署注意事項（Docker CI/CD & Watchtower）
* 當 GitHub Actions 完成 Docker 映像檔建置並推送至 GitHub Packages (`ghcr.io`) 後：
* 若遠端伺服器未設定自動 Webhook 觸發，需手動或自動執行：
  ```bash
  ssh ec2-user@<HOST_IP> "cd /home/ec2-user/888news && git pull origin main && docker compose pull && docker compose up -d"
  ```
* 側邊導航欄若出現預設垂直捲軸，可在 `<nav>` 加上 `scrollbar-none` class 消除突兀捲軸。

---

## 6. 留言確認與隱私體驗優化

在匿名留言模式下（`COMMENT_EMAIL_CONFIRMATION_ENABLED="true"`）：
1. **信箱驗證提示**：前端提示訊息提供完整雙語指引（繁中 / 英文），告知用戶需前往電子信箱點擊確認連結。
2. **作者資料記憶**：利用 LocalStorage（`garrul:author:<origin>`）記憶作者名稱、電子信箱及頭像，下次訪問時自動帶入，免去重複填寫。
3. **確認頁面附帶留言原文**：用戶點入 Email 確認信連結時，確認頁面會完整顯示使用者當初填寫的留言內容，避免「不知道自己送出了什麼」的困惑。
4. **視覺圖標現代化**：全面改用 Lucide Icons（`MessageSquare`、`Bell`、`Flame`、`Heart`），避免作業系統預設 Emoji 在不同平台呈現樣式不一致。

---

## 7. 驗證檢核清單 (Production Verification Checklist)

- [ ] `wrangler.toml` 的 `ALLOWED_ORIGINS` 包含全部前端站點，無多餘斜線。
- [ ] 所有站台的 `data-slug` 格式符合 `/^[a-zA-Z0-9_\-./]{1,200}$/`，**不包含冒號 `:`**。
- [ ] 留言板僅存在於單篇文章/單集詳細頁面，**列表頁面無任何 `#garrul` 元素**。
- [ ] Next.js 每次修改後確實執行 `opennextjs-cloudflare build` 再 `wrangler deploy`。
- [ ] 透過 `curl -s -i -H "Origin: <SITE_URL>" "<GARRUL_API>/api/v1/bootstrap?slug=<SLUG>&lang=zh-Hant"` 檢查：
  * HTTP 狀態碼為 `200 OK`。
  * `access-control-allow-origin` 正確對應當前站台。
  * 回傳完整的 `config` 與 `comments` 陣列。
