# Tasks

## 1. Database Schema & Migration

- [x] 1.1 Create migration `src/db/migrations/0036_multi_site_architecture.sql` with `sites` table, `posts.site_id`, `posts.raw_slug`, `webhook_endpoints.site_id`, and verify migration execution on test SQLite instance.
- [x] 1.2 Implement site database CRUD queries (`createSite`, `getSiteByDomain`, `getSiteById`, `listSites`, `updateSite`, `deleteSite`) in `src/db/queries.ts` and verify unit tests in `tests/sites-db.test.ts`.
- [x] 1.3 Add backfill routine in database layer to ensure `posts.raw_slug = posts.slug` for all legacy posts and verify existing thread queries succeed without regression.

## 2. Dynamic Origin Authorization & Edge Resolution

- [x] 2.1 Implement in-memory site caching helper (`src/lib/sites.ts`) with 60s TTL and cache-invalidation on site updates, verifying TTL and eviction with unit tests in `tests/sites-cache.test.ts`.
- [x] 2.2 Update `src/lib/cors.ts` to authorize origins dynamically against cached active sites in addition to static `ALLOWED_ORIGINS`, verifying with `tests/cors-dynamic.test.ts`.
- [x] 2.3 Implement site resolution helper (`resolveRequestSite`) extracting hostname from `Origin`, `Referer`, and `parent_origin`, verifying resolution behavior with unit tests in `tests/site-resolution.test.ts`.

## 3. Site Management REST API & Admin UI

- [x] 3.1 Implement `/admin/api/sites` REST endpoints (GET list, POST create, PATCH update, DELETE) in `src/routes/admin.ts` and verify with integration tests in `tests/admin-sites-api.test.ts`.
- [x] 3.2 Build Admin Sites management console in `src/admin-ui/pages/sites.ts` supporting creation, editing, and deletion with Traditional Chinese and English localization, verifying HTML rendering.
- [x] 3.3 Add "站台管理 / Sites" navigation item under Manage section in `src/admin-ui/layout.ts` and verify admin role gating.

## 4. Multi-Domain Post Slug Isolation & Ingestion

- [x] 4.1 Update `upsertPost`, `getPost`, and comment retrieval queries in `src/db/queries.ts` to support site-namespaced internal slugs (`${site_id}::${raw_slug}`) while maintaining legacy slug compatibility.
- [x] 4.2 Update `/api/v1/bootstrap` and `/api/v1/comments` in `src/routes/api.bootstrap.ts` and `src/routes/api.comments.ts` to resolve caller site context and emit clean, un-prefixed slugs in JSON responses.
- [x] 4.3 Verify cross-domain slug isolation with integration test in `tests/cross-domain-isolation.test.ts` ensuring identical slugs on separate domains create completely isolated comment threads.

## 5. Site-Scoped Moderation & Webhook Routing

- [x] 5.1 Implement Admin Global Site Switcher dropdown in `src/admin-ui/layout.ts`, preserving selected site via cookie/query param across admin navigation.
- [x] 5.2 Update Dashboard metrics, Moderation Queue, and Subscriptions queries to filter by active `site_id` when selected, and verify in `tests/admin-site-filtering.test.ts`.
- [x] 5.3 Update `src/lib/webhook.ts` dispatch logic to route events to site-specific endpoints and global endpoints while ignoring other sites, verifying in `tests/site-webhooks.test.ts`.

## 6. End-to-End Verification & Compatibility

- [x] 6.1 Run full project test suite (`npm test`) across all 200+ test files to confirm zero regression for existing single-site deployments.
- [x] 6.2 Run `npm run build:assets` to verify frontend bundle builds cleanly and stays within size limits.

## Workflow follow-up

- Deploy migration `0036_multi_site_architecture.sql` to live Cloudflare D1 instance.
- Register initial production sites (e.g., `news2.david888.com`, `blog.david888.com`) in the Admin Console.
