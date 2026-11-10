# Proposal: Multi-Site & Multi-Domain System-Level Architecture

## Why

Currently, Garrul (888echo) operates as a single-tenant comment service where post slugs (`posts.slug`) are globally scoped and domain validation depends on a static environment variable (`ALLOWED_ORIGINS`). If multiple websites embed the system (e.g., `news2.david888.com` and `blog.david888.com`), identical slugs collide into the same comment thread, adding new domains requires manual Worker redeployment, and all notification webhooks (Discord/Telegram) and moderation queues are mixed together. 

This change introduces first-class, system-level multi-domain site support ("多 Domain 站台架構"), enabling administrators to register, manage, and isolate multiple websites from a single 888echo Worker instance with zero configuration drift and complete backward compatibility.

## What Changes

- **Site Management Entity & Dynamic Origin Allowlist**: Introduce a `sites` database table with CRUD API (`/admin/api/sites`) and admin console (`/admin/sites`). Adding a site dynamically authorises its domain for CORS/Origin checks without editing `wrangler.toml` or redeploying.
- **Cross-Domain Slug Isolation & Post Scoping**: Namespace and associate post records with `site_id` so identical slugs (e.g., `welcome` or `about`) on different domains remain completely isolated into independent comment threads.
- **Zero-Latency Origin Resolution**: Resolve incoming widget requests (`GET /api/v1/bootstrap`, `POST /api/v1/comments`, etc.) by matching request `Origin` or `Referer` against registered sites, cached in isolate memory / KV for edge performance.
- **Admin UI Global Site Switcher**: Add a site switcher dropdown in the sidebar to seamlessly toggle between "All Sites" and individual site views, instantly filtering the Dashboard metrics, Moderation Queue, and Subscriptions.
- **Site-Scoped Webhooks & Alert Routing**: Allow webhook endpoints (Discord, Slack, generic) and notification targets to bind to specific sites or remain global, ensuring moderation alerts reach the appropriate team channels.
- **Zero-Breaking-Change Guarantee**: Legacy embeds without site registration or unrecognised domains continue to work transparently via a default/unassigned fallback scope.

## Capabilities

### New Capabilities
- `site-management`: Administrator management of sites (domains, names, default locales, moderation policies, and site-level settings) via the admin UI and REST API, with dynamic CORS allowlist synchronization.
- `multi-site-routing`: Edge-level resolution of request origin/referer to site entities, namespacing post slugs across domains to prevent thread collisions while keeping the frontend embed snippet unchanged.
- `site-scoped-moderation`: Site-aware admin navigation with a global site switcher, filtering moderation queues, metrics, subscriptions, and routing outbound webhooks/notifications to site-specific channels.

### Modified Capabilities
- *(None: initial baseline specs for multi-site architecture)*

## Impact

- **Database**: New migration `0036_multi_site_architecture.sql` introducing `sites` table, adding `site_id` and `raw_slug` columns to `posts`, and adding `site_id` to `webhook_endpoints`.
- **CORS & Origin Security**: `src/lib/cors.ts` checks both legacy `ALLOWED_ORIGINS` env var and dynamic site domains loaded from DB/KV.
- **API & Routing**: `/api/v1/bootstrap`, `/api/v1/comments`, `/api/v1/page-engagement`, and embed iframe routes resolve `site_id` via request headers and isolate threads accordingly.
- **Admin UI**: New `/admin/sites` page, updated sidebar navigation with site switcher in `src/admin-ui/layout.ts`, and site filtering on Dashboard, Queue, and Webhooks.
- **Client Embed**: 100% backward compatible. No changes required to existing `<div id="garrul" data-slug="...">` or `<div id="888echo" ...>` client snippets.
