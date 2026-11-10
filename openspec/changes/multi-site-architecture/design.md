# Design: Multi-Site & Multi-Domain System-Level Architecture

## Context

Garrul (888echo) currently handles posts via a single global primary key `posts.slug` (`0001_init.sql`), and relies on `ALLOWED_ORIGINS` in `wrangler.toml` for CORS and Origin-header CSRF validation (`src/lib/cors.ts`). In addition, admin domain filtering relies on ad-hoc runtime string slicing on `posts.url` via `hostExpr("url")` (`src/db/host-expr.ts`), which classifies posts without a URL into `(no url)` and only discovers domains reactively after comments are posted.

To evolve 888echo into a multi-site platform capable of hosting multiple production domains (e.g. `news2.david888.com`, `blog.david888.com`, `docs.david888.com`) on a single Worker, we introduce a structured `sites` database entity, edge origin resolution, transparent slug namespacing, and site-scoped moderation and webhooks.

## Goals / Non-Goals

**Goals:**
- **Dynamic Site Provisioning**: Allow administrators to register and manage sites dynamically via `/admin/sites` and `/admin/api/sites` without editing configuration files or redeploying Workers.
- **Dynamic Origin Authorization**: Automatically include registered site domains in CORS preflights and Origin-header CSRF checks.
- **Cross-Domain Slug Isolation**: Allow identical post slugs (e.g., `welcome`, `changelog`) on different domains without thread collision or data bleeding.
- **Site-Scoped Moderation & Analytics**: Provide an administrative site switcher in the sidebar to filter Dashboard metrics, the Moderation Queue, Subscriptions, and Audit logs by site.
- **Site-Scoped Webhooks**: Allow webhook endpoints (Discord/Slack/generic) to be attached to a specific site or remain global.
- **100% Backward Compatibility**: Existing posts, database foreign keys (`comments`, `subscriptions`, `page_reactions`, `page_votes`), and existing client embed snippets must continue working without breaking changes.

**Non-Goals:**
- **Multi-Tenant User Accounts**: All administrators and moderators have instance-level authentication; we are not introducing tenant-partitioned administrator accounts in this phase.
- **Multiple D1 Databases**: All sites share the single Cloudflare D1 database instance with table-level tenant scoping.

## Decisions

### 1. Database Schema & Migration Strategy (`0036_multi_site_architecture.sql`)
- **`sites` Table**:
  ```sql
  CREATE TABLE IF NOT EXISTS sites (
      id               TEXT PRIMARY KEY,           -- ULID
      domain           TEXT NOT NULL UNIQUE,       -- Normalized hostname (e.g. news2.david888.com)
      name             TEXT NOT NULL,              -- Human-readable name
      description      TEXT,
      default_locale   TEXT NOT NULL DEFAULT 'zh-Hant',
      allow_anonymous  INTEGER NOT NULL DEFAULT 1,
      auto_close_days  INTEGER NOT NULL DEFAULT 0, -- 0 = use instance default
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
  ```
- **`posts` Table Extension**:
  ```sql
  ALTER TABLE posts ADD COLUMN site_id TEXT REFERENCES sites(id);
  ALTER TABLE posts ADD COLUMN raw_slug TEXT;
  CREATE INDEX IF NOT EXISTS idx_posts_site_raw ON posts(site_id, raw_slug);
  ```
- **`webhook_endpoints` Table Extension**:
  ```sql
  ALTER TABLE webhook_endpoints ADD COLUMN site_id TEXT REFERENCES sites(id);
  CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_site ON webhook_endpoints(site_id);
  ```
- **Slug Isolation Strategy**:
  - `posts.slug` remains the primary key referenced by `comments.post_slug`, `subscriptions.post_slug`, `page_reactions.post_slug`, and `page_votes.post_slug`.
  - For site-scoped posts, `posts.slug` is stored internally as `${site_id}::${raw_slug}`, while `posts.raw_slug` stores the clean user-facing slug.
  - For legacy / existing posts without a site, `posts.slug` remains unchanged (e.g. `welcome`), with `site_id = NULL` and `raw_slug = slug`.
  - *Rationale*: Modifying SQLite primary keys or altering existing foreign key constraints on live D1 databases is fraught with downtime and table rebuild risks. Storing the namespaced slug in `posts.slug` provides instant, guaranteed uniqueness across domains while keeping 100% of existing table relations and queries intact.

### 2. Edge Request Resolution & Origin Cache
- **Resolution Pipeline**:
  1. Inspect `c.req.header("origin")` or fallback to `c.req.header("referer")` (or query param `parent_origin` in iframe mode).
  2. Parse the hostname (e.g. `https://news2.david888.com/article/1` -> `news2.david888.com`).
  3. Match hostname against in-memory memoized site registry (`sitesMemo`, 60s TTL).
  4. If matched, attach `site` to Hono context (`c.set("site", site)`).
  5. If not matched, fallback to legacy mode (`c.set("site", null)`).
- **CORS Integration**:
  - `src/lib/cors.ts` checks `ALLOWED_ORIGINS` env var OR the cached active site domains from the `sites` table.
  - If a domain exists in the `sites` table, CORS automatically allows it and returns appropriate `Access-Control-Allow-*` headers.

### 3. Transparent Client Communication
- **Inbound**: When a client requests `GET /api/v1/bootstrap?slug=welcome` from `news2.david888.com`, the worker resolves `site_id` and internally maps target slug to `${site_id}::welcome`.
- **Outbound**: In `GET /api/v1/bootstrap` and `GET /api/v1/comments`, the server formats the response payload, replacing internal `slug` with `raw_slug ?? slug`. The client widget never sees the internal `${site_id}::` prefix.

### 4. Admin UI Architecture & Site Switcher
- **Site Switcher Component**:
  - Located in `src/admin-ui/layout.ts` right under the brand header.
  - Displays a clean dropdown: `🌐 全部站台 (All Sites)` or specific registered sites with comment counters.
  - Switching sets an `888echo_active_site` cookie and redirects with `?site_id=...`.
- **`/admin/sites` Management Page**:
  - Dedicated CRUD interface for sites (`src/admin-ui/pages/sites.ts`).
  - Lists domain, name, default locale, comment count, and action buttons (Edit, Delete).
  - Modal/Form to register new domains or adjust site-level settings.
- **Scoped Views**:
  - **Dashboard**: Filter metrics (`pending`, `approved`, `reactions`) by `site_id` if selected.
  - **Queue**: Displays site badge on comment cards; filters to comments belonging to the active site.
  - **Webhooks**: Displays target site badge; allows editing which site an endpoint listens to (or All Sites).

### 5. Webhook & Alert Dispatching
- In `src/lib/webhook.ts`, when an event occurs for a post, fetch active endpoints where:
  ```sql
  SELECT * FROM webhook_endpoints 
  WHERE enabled = 1 AND (site_id IS NULL OR site_id = ?)
  ```
- Events on posts with `site_id` trigger global endpoints AND endpoints explicitly bound to that `site_id`. Endpoints bound to other sites are skipped.

## Risks / Trade-offs

- **[Risk] Origin / Referer Missing on Direct Server Calls**:
  - *Mitigation*: Public comment submissions require Turnstile and CORS, which browsers always accompany with `Origin`. For internal test suites and curl calls, optional query parameter `?site_id=` or header `X-888echo-Site` can explicitly provide the site context.
- **[Risk] Stale In-Memory Site Cache on Multi-Isolate Workers**:
  - *Mitigation*: Keep `sitesMemo` TTL short (60 seconds) and provide an immediate cache bust within the isolate handling the `/admin/api/sites` write.
- **[Risk] Domain Renaming or Domain Migration**:
  - *Mitigation*: Because `posts` references `site_id` (ULID) rather than the raw domain, an operator can update the site's domain in `/admin/sites` without corrupting or losing any existing comment threads.

## Migration Plan

1. **Phase 1: Database Migration**: Apply `0036_multi_site_architecture.sql` to D1.
2. **Phase 2: Data Backfill**: Run backfill script/query to populate `posts.raw_slug = posts.slug` for all existing posts.
3. **Phase 3: Sites API & Admin Console**: Implement `/admin/api/sites` and `/admin/sites`.
4. **Phase 4: Dynamic Origin & Routing Pipeline**: Update `src/lib/cors.ts` and request resolution in `/api/v1/bootstrap` and `/api/v1/comments`.
5. **Phase 5: Scoped Moderation & Webhooks**: Implement the sidebar Site Switcher and site-filtered queries.
6. **Phase 6: Verification & Test Suite**: Run unit/integration tests covering cross-domain slug isolation, dynamic CORS, and admin site filtering.
