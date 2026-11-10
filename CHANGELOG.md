# 888echo Changelog

All notable changes to the **888echo** sovereign edge comment & discussion engine are documented in this file.

---

## [2.41.0] - 2026-11-10 — *The 888echo Genesis Release*

### 🚀 Rebranding & Ecosystem Convergence
- **Forked & Rebranded to 888echo**: Official bifurcation from upstream Garrul into **888echo**, a dedicated pillar within the 888 sovereign edge ecosystem (`888echo`, `888box`, `888a2a`, `888quant`).
- **Autonomous Release Tracking**: Repointed package repository and upgrade checking from upstream `KingPin/Garrul` to `https://github.com/tbdavid2019/Garrul`, eliminating stale upstream release banners and aligning with custom release cadence.
- **Unified Brand Surface**: Updated all administrative page titles, headings, about information, Atom generator tags, webhook signatures, and email headers to `888echo`.

### 🔐 Zero-Trust Admin Authentication & Passkey Portal
- **Direct Admin Login Portal (`/admin/login`)**:
  - Implemented standalone passwordless authentication portal with dark/light auto-theme support.
  - Built-in **Passkey (WebAuthn / FIDO2 / Touch ID / Face ID)** login utilizing native Web Crypto ECDSA P-256 (`ES256`) and RS256 with replay-attack-resistant challenge validation in Cloudflare KV.
  - Implemented **Email 2FA 6-digit OTP verification codes** with 10-minute expiry, automatic 5-attempt rate-limiting, and SHA-256 code hashing for administrators registered in `ADMIN_EMAILS`.
- **Passkey Hardware Device Management (`/admin/passkeys`)**:
  - Added dedicated administrator interface to register, rename, inspect, and revoke Passkeys / Touch ID / Face ID / YubiKeys.
  - Zero-dependency client & server WebAuthn cryptography implementation (`src/lib/passkey.ts`).
- **Database Schema Migration (`0035_admin_login_passkeys.sql`)**:
  - Added tables `admin_passkeys` and `admin_login_codes` with indices for fast credential lookups and expiry enforcement.

### 🛡️ Moderation & Dual-Backup Notifications
- **Discord Webhook Dual-Backup Moderation**:
  - Added real-time notification alerts forwarded directly to Discord channels upon comment submission requiring administrative review.
  - Discord embeds feature rich metadata, author info, post titles, direct moderation queue links, and status tags.
- **AI Classification Decoupling**:
  - Removed third-party `clef` AI spam dependencies in favor of Cloudflare edge-native heuristics and Turnstile validation.

### 🧭 Navigation & Admin UX Enhancements
- **Consolidated Integrations Sidebar**:
  - Reorganized administrative navigation by introducing a unified **INTEGRATIONS** section grouping **Webhooks** and **Telegram** bot settings together for clarity.
- **Admin Logout Feature**:
  - Added dedicated `/admin/logout` endpoint (`GET` & `POST`) executing immediate server-side session revocation (`destroySession`) and cookie purge.
  - Added interactive logout icon button with user confirmation prompt in the admin sidebar footer.
- **Access Denied Smart Recovery**:
  - Redesigned the 401 unauthorized / session-expired barrier page to provide a direct, one-click button redirecting to `/admin/login`.

### 🌐 Multi-Language Switching & Traditional Chinese (繁體中文) Supercharge
- **Admin UI Language Switcher (`/admin/set-lang`)**:
  - Added dedicated toggle button (`🌐 繁中 / EN`) in the admin sidebar footer.
  - Switches navigation sections (`內容審核`, `營運管理`, `整合服務`, `系統維運`, `說明與支援`), navigation links, role badges (`管理員`, `審核員`), and shortcuts help into native Traditional Chinese.
  - Automatically remembers preference via `888echo_admin_lang` cookie and `Accept-Language` detection.
- **Widget In-Place Language Switcher**:
  - Added interactive language toggle (`🌐 繁體中文 / English`) directly in the comment widget footer.
  - Allows site visitors to toggle language instantly without page reload, remembering their choice in `localStorage`.
- **100% Traditional Chinese (`zh-Hant`) Localization Coverage**:
  - Completed all 37 previously missing server strings in `src/i18n/zh-Hant.ts` (API validation errors, rate limit warnings, Turnstile hints, Telegram bot operator interactions).
  - Both server (`84/84`) and widget (`120/120`) tables for `zh-Hant` now achieve full 100% translation coverage.

### 🔌 Seamless Embed Backward Compatibility
- **Dual Container Target Support**:
  - `embed.js` now natively checks `document.getElementById("888echo") ?? document.getElementById("garrul")`.
  - All existing site embeds using `<div id="garrul">` continue to mount and function with zero code changes required.
  - New installations can use `<div id="888echo">`.
  - Updated widget powered-by attribution to link directly to `888echo`.

---

## [2.40.x] and Prior
- Foundation upstream architecture built on Cloudflare Workers, D1 SQLite, KV caching, Turnstile challenges, and Shadow-DOM isolated embeds.
