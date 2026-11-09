/**
 * Admin Login: Passwordless authentication supporting Passkey (WebAuthn/Touch ID)
 * and Email OTP (2FA code).
 *
 * Routes:
 *   GET  /admin/login           Interactive login page
 *   GET  /admin/login/app.js    Client-side WebAuthn & OTP logic (external for CSP)
 *   POST /admin/api/login/email-code/send
 *   POST /admin/api/login/email-code/verify
 *   POST /admin/api/login/passkey/challenge
 *   POST /admin/api/login/passkey/verify
 */

import { Hono } from "hono";
import type { Bindings } from "../index";
import { getUser, type User } from "../db/queries";
import { sendEmail } from "../lib/email";
import { log } from "../lib/log";
import {
	generateChallenge,
	verifyPasskeyAssertion,
} from "../lib/passkey";
import { issueSession, readSession } from "../lib/session";
import { ulid } from "../lib/ulid";

export const adminLogin = new Hono<{ Bindings: Bindings }>();

// ----------------------------- HTML & Client Script -----------------------------

const LOGIN_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex">
  <title>Garrul 管理員登入 — Passkey &amp; 2FA 無密碼安全登入</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 44, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --fg: #f1f5f9;
      --fg-muted: #94a3b8;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --input-bg: rgba(15, 23, 42, 0.7);
      --input-border: rgba(255, 255, 255, 0.12);
      --success: #10b981;
      --error: #ef4444;
      --radius: 12px;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card-bg: rgba(255, 255, 255, 0.95);
        --card-border: rgba(0, 0, 0, 0.08);
        --fg: #0f172a;
        --fg-muted: #64748b;
        --accent: #2563eb;
        --accent-hover: #1d4ed8;
        --input-bg: #f1f5f9;
        --input-border: rgba(0, 0, 0, 0.12);
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      line-height: 1.5;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 440px;
      padding: 2.5rem 2rem;
    }
    .header { text-align: center; margin-bottom: 2rem; }
    .header .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      border-radius: 12px;
      margin-bottom: 1rem;
      color: #fff;
    }
    .header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .header p { font-size: 0.875rem; color: var(--fg-muted); margin-top: 0.35rem; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: var(--accent);
      color: #ffffff;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-passkey {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-passkey:hover:not(:disabled) {
      background: #334155;
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.5rem 0;
      color: var(--fg-muted);
      font-size: 0.78rem;
    }
    .divider::before, .divider::after {
      content: "";
      flex: 1;
      border-bottom: 1px solid var(--input-border);
    }
    .divider::before { margin-right: 0.75rem; }
    .divider::after { margin-left: 0.75rem; }
    .field { margin-bottom: 1.25rem; }
    .field label {
      display: block;
      font-size: 0.825rem;
      font-weight: 500;
      margin-bottom: 0.4rem;
      color: var(--fg-muted);
    }
    .input-row { display: flex; gap: 0.5rem; }
    input[type="email"], input[type="text"] {
      width: 100%;
      padding: 0.7rem 0.875rem;
      font-size: 0.95rem;
      border: 1px solid var(--input-border);
      border-radius: 8px;
      background: var(--input-bg);
      color: var(--fg);
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: var(--accent); }
    .otp-input {
      letter-spacing: 0.35em;
      font-family: monospace;
      font-size: 1.3rem !important;
      text-align: center;
      font-weight: 700;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--error);
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
    }
    .footer {
      text-align: center;
      margin-top: 1.75rem;
      font-size: 0.775rem;
      color: var(--fg-muted);
    }
    .footer a { color: var(--accent); text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <h1>Garrul 管理員登入</h1>
      <p>支援 Passkey 生物辨識與 Email 2FA 無密碼安全登入</p>
    </div>

    <div id="alert-box" class="alert"></div>

    <!-- Passkey Login Section -->
    <div id="passkey-section">
      <button id="btn-passkey" type="button" class="btn btn-passkey">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
        使用 Passkey (Touch ID / Face ID) 登入
      </button>
    </div>

    <div class="divider">或使用 Email 驗證碼登入</div>

    <!-- Email OTP Section -->
    <div id="otp-section">
      <div class="field">
        <label for="email-input">管理員電子郵件 (Admin Email)</label>
        <div class="input-row">
          <input id="email-input" type="email" placeholder="you@example.com" autocomplete="email" required>
          <button id="btn-send-code" type="button" class="btn btn-primary" style="width:auto;white-space:nowrap;padding:0.7rem 1.1rem;">發送代碼</button>
        </div>
      </div>

      <div id="code-entry" class="field" style="display:none;">
        <label for="code-input">請輸入 6 位數登入驗證碼</label>
        <input id="code-input" class="otp-input" type="text" maxlength="6" placeholder="······" inputmode="numeric" autocomplete="one-time-code">
        <button id="btn-verify-code" type="button" class="btn btn-primary" style="margin-top:0.75rem;">驗證並進入後台</button>
      </div>
    </div>

    <div class="footer">
      <p>採用 FIDO2 / WebAuthn 零信任端對端密碼學驗證</p>
    </div>
  </div>

  <script src="/admin/login/app.js"></script>
</body>
</html>`;

const LOGIN_JS = `(function () {
  function showAlert(msg, isError) {
    var b = document.getElementById("alert-box");
    b.textContent = msg;
    b.className = "alert " + (isError ? "alert-error" : "alert-success");
    b.style.display = "block";
  }
  function clearAlert() {
    var b = document.getElementById("alert-box");
    b.style.display = "none";
  }

  function b64ToBytes(b64url) {
    var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    var pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    var bin = atob(b64 + pad);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  }

  // --- Passkey Flow ---
  var passkeyBtn = document.getElementById("btn-passkey");
  if (!window.PublicKeyCredential) {
    passkeyBtn.disabled = true;
    passkeyBtn.title = "此瀏覽器不支援 WebAuthn / Passkey";
  } else {
    passkeyBtn.addEventListener("click", async function () {
      clearAlert();
      passkeyBtn.disabled = true;
      try {
        var chRes = await fetch("/admin/api/login/passkey/challenge", {
          method: "POST",
          headers: { "content-type": "application/json" }
        });
        var chData = await chRes.json();
        if (!chRes.ok || !chData.challenge) {
          throw new Error(chData.error || "無法取得驗證挑戰");
        }

        var assertion = await navigator.credentials.get({
          publicKey: {
            challenge: b64ToBytes(chData.challenge),
            rpId: window.location.hostname,
            userVerification: "preferred"
          }
        });
        if (!assertion) throw new Error("使用者取消或認證失敗");

        var payload = {
          credentialId: bytesToB64(new Uint8Array(assertion.rawId)),
          authenticatorData: bytesToB64(new Uint8Array(assertion.response.authenticatorData)),
          clientDataJSON: bytesToB64(new Uint8Array(assertion.response.clientDataJSON)),
          signature: bytesToB64(new Uint8Array(assertion.response.signature)),
          challenge: chData.challenge
        };

        var verRes = await fetch("/admin/api/login/passkey/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        var verData = await verRes.json();
        if (verRes.ok && verData.ok) {
          showAlert("🎉 Passkey 認證成功！正在進入後台...", false);
          setTimeout(function () { location.href = verData.redirect || "/admin"; }, 500);
        } else {
          throw new Error(verData.error || "Passkey 簽章驗證失敗");
        }
      } catch (err) {
        if (err.name === "NotAllowedError") {
          showAlert("已取消生物辨識或裝置上尚未儲存此網站的 Passkey（若未綁定請先用 Email 驗證碼登入後台綁定）", true);
        } else {
          showAlert("Passkey 登入失敗: " + err.message, true);
        }
      } finally {
        passkeyBtn.disabled = false;
      }
    });
  }

  // --- Email Code Flow ---
  var emailInput = document.getElementById("email-input");
  var btnSend = document.getElementById("btn-send-code");
  var codeEntry = document.getElementById("code-entry");
  var codeInput = document.getElementById("code-input");
  var btnVerify = document.getElementById("btn-verify-code");

  btnSend.addEventListener("click", async function () {
    clearAlert();
    var email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      showAlert("請輸入正確的管理員電子郵件", true);
      return;
    }

    btnSend.disabled = true;
    btnSend.textContent = "發送中...";

    try {
      var res = await fetch("/admin/api/login/email-code/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "發送失敗");

      showAlert("✅ 6 位數登入驗證碼已寄送至信箱，請查收 (有效 10 分鐘)", false);
      codeEntry.style.display = "block";
      codeInput.focus();

      var countdown = 60;
      var timer = setInterval(function () {
        countdown--;
        if (countdown > 0) {
          btnSend.textContent = countdown + "s";
        } else {
          clearInterval(timer);
          btnSend.disabled = false;
          btnSend.textContent = "重新發送";
        }
      }, 1000);
    } catch (err) {
      btnSend.disabled = false;
      btnSend.textContent = "發送代碼";
      showAlert(err.message, true);
    }
  });

  btnVerify.addEventListener("click", async function () {
    clearAlert();
    var email = emailInput.value.trim().toLowerCase();
    var code = codeInput.value.trim();
    if (code.length !== 6) {
      showAlert("請輸入完整的 6 位數驗證碼", true);
      return;
    }

    btnVerify.disabled = true;
    btnVerify.textContent = "驗證中...";

    try {
      var res = await fetch("/admin/api/login/email-code/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, code: code })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "驗證失敗");

      showAlert("🎉 驗證成功！正在進入後台...", false);
      setTimeout(function () { location.href = data.redirect || "/admin"; }, 500);
    } catch (err) {
      btnVerify.disabled = false;
      btnVerify.textContent = "驗證並進入後台";
      showAlert(err.message, true);
    }
  });
})();
`;

const handleLoginPage = async (c: any) => {
	const session = await readSession(c);
	if (session) {
		const user = await getUser(c.env.DB, session.user_id);
		if (user && !user.is_banned && user.role === "admin") {
			return c.redirect("/admin");
		}
	}
	return c.html(LOGIN_HTML);
};

adminLogin.get("/login", handleLoginPage);

adminLogin.get("/login/app.js", (c) =>
	c.body(LOGIN_JS, 200, { "content-type": "text/javascript; charset=utf-8" }),
);

// ----------------------------- Backend APIs -----------------------------

const sha256Hex = async (text: string): Promise<string> => {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
};

/**
 * Send an Email 6-digit OTP code to an admin email.
 */
adminLogin.post("/api/login/email-code/send", async (c) => {
	const body = await c.req.json<{ email?: string }>().catch(() => null);
	const email = (body?.email ?? "").trim().toLowerCase();
	if (!email || !email.includes("@")) {
		return c.json({ error: "請輸入有效的電子郵件" }, 400);
	}

	// Verify that email is in ADMIN_EMAILS
	const adminEmails = (c.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter((e) => e.length > 0);

	if (!adminEmails.includes(email)) {
		return c.json({ error: "此電子郵件不在管理員名單中，無法發送登入代碼" }, 403);
	}

	const now = Date.now();
	// Check cooldown: max 1 code per 60 seconds
	const recent = await c.env.DB.prepare(
		`SELECT id FROM admin_login_codes WHERE email = ? AND created_at > ? LIMIT 1`,
	)
		.bind(email, now - 60_000)
		.first();
	if (recent) {
		return c.json({ error: "發送過於頻繁，請等待 60 秒後再試" }, 429);
	}

	// Generate 6-digit random code
	const code = Math.floor(100000 + Math.random() * 900000).toString();
	const codeHash = await sha256Hex(code);
	const expiresAt = now + 10 * 60 * 1000; // 10 minutes

	await c.env.DB.prepare(
		`INSERT INTO admin_login_codes (id, email, code_hash, expires_at, attempts, created_at)
		 VALUES (?, ?, ?, ?, 0, ?)`,
	)
		.bind(ulid(), email, codeHash, expiresAt, now)
		.run();

	const html = `<!doctype html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a;line-height:1.6;">
  <div style="text-align:center;margin-bottom:20px;">
    <h2 style="font-size:20px;font-weight:700;margin:0 0 8px;">Garrul 管理員登入驗證碼</h2>
    <p style="color:#64748b;font-size:14px;margin:0;">請使用下方驗證碼登入管理後台</p>
  </div>
  <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
    <span style="font-size:32px;font-weight:800;letter-spacing:6px;font-family:monospace;color:#1e293b;">${code}</span>
  </div>
  <p style="font-size:13px;color:#64748b;text-align:center;margin:0;">
    此驗證碼有效時間為 <strong>10 分鐘</strong>。若非您本人操作，請忽略此郵件。
  </p>
</body>
</html>`;

	const sent = await sendEmail(c.env, {
		from: (c.env.EMAIL_FROM as string) || "Garrul <notifications@garrul.com>",
		to: email,
		subject: `【Garrul 登入驗證碼】${code}`,
		html,
	});

	if (!sent) {
		log.error("login.email_code.send_failed", { email });
		return c.json({ error: "寄送驗證碼失敗，請確認發信服務配置" }, 500);
	}

	return c.json({ ok: true });
});

/**
 * Verify Email OTP code and issue an Admin Session.
 */
adminLogin.post("/api/login/email-code/verify", async (c) => {
	const body = await c.req.json<{ email?: string; code?: string }>().catch(() => null);
	const email = (body?.email ?? "").trim().toLowerCase();
	const code = (body?.code ?? "").trim();

	if (!email || code.length !== 6) {
		return c.json({ error: "請輸入正確的 6 位數代碼" }, 400);
	}

	const now = Date.now();
	const codeHash = await sha256Hex(code);

	const row = await c.env.DB.prepare(
		`SELECT id, attempts FROM admin_login_codes
		  WHERE email = ? AND expires_at > ?
		  ORDER BY created_at DESC LIMIT 1`,
	)
		.bind(email, now)
		.first<{ id: string; attempts: number }>();

	if (!row) {
		return c.json({ error: "驗證碼已過期或不存在，請重新發送" }, 400);
	}

	if (row.attempts >= 5) {
		return c.json({ error: "錯誤次數過多，此驗證碼已失效，請重新發送" }, 429);
	}

	const match = await c.env.DB.prepare(
		`SELECT id FROM admin_login_codes WHERE id = ? AND code_hash = ?`,
	)
		.bind(row.id, codeHash)
		.first();

	if (!match) {
		await c.env.DB.prepare(
			`UPDATE admin_login_codes SET attempts = attempts + 1 WHERE id = ?`,
		)
			.bind(row.id)
			.run();
		return c.json({ error: "驗證碼不正確，請重新輸入" }, 400);
	}

	// Consume all codes for this email
	await c.env.DB.prepare(`DELETE FROM admin_login_codes WHERE email = ?`).bind(email).run();

	// Resolve or create Admin User
	let user = await c.env.DB.prepare(
		`SELECT * FROM users WHERE email = ? AND is_admin = 1 LIMIT 1`,
	)
		.bind(email)
		.first<User>();

	if (!user) {
		// Update Owner row email if owner exists
		const owner = await c.env.DB.prepare(
			`SELECT * FROM users WHERE provider = 'owner' AND role = 'admin' LIMIT 1`,
		).first<User>();

		if (owner) {
			await c.env.DB.prepare(`UPDATE users SET email = ? WHERE id = ?`)
				.bind(email, owner.id)
				.run();
			user = { ...owner, email };
		} else {
			const newId = ulid();
			await c.env.DB.prepare(
				`INSERT INTO users (id, provider, provider_id, name, email, is_admin, role, created_at)
				 VALUES (?, 'admin_email', ?, 'Admin', ?, 1, 'admin', ?)`,
			)
				.bind(newId, email, email, now)
				.run();
			user = await getUser(c.env.DB, newId);
		}
	}

	if (!user) return c.json({ error: "無法建立管理員會話" }, 500);

	await issueSession(c, user.id);
	log.info("admin_login.email_code.success", { email, userId: user.id });
	return c.json({ ok: true, redirect: "/admin" });
});

/**
 * Generate a WebAuthn Assertion Challenge for Passkey Login.
 */
adminLogin.post("/api/login/passkey/challenge", async (c) => {
	const challenge = generateChallenge();
	const key = `passkey_chal:${challenge}`;
	// Store challenge in KV (120 seconds TTL)
	await c.env.RATE_LIMITS.put(key, "1", { expirationTtl: 120 });
	return c.json({
		challenge,
		rpId: new URL(c.req.url).hostname,
	});
});

/**
 * Verify WebAuthn Assertion and issue an Admin Session.
 */
adminLogin.post("/api/login/passkey/verify", async (c) => {
	const body = await c.req.json<{
		credentialId?: string;
		authenticatorData?: string;
		clientDataJSON?: string;
		signature?: string;
		challenge?: string;
	}>().catch(() => null);

	if (
		!body?.credentialId ||
		!body?.authenticatorData ||
		!body?.clientDataJSON ||
		!body?.signature ||
		!body?.challenge
	) {
		return c.json({ error: "缺少 Passkey 驗證參數" }, 400);
	}

	// Verify challenge was issued by server and consume it
	const key = `passkey_chal:${body.challenge}`;
	const stored = await c.env.RATE_LIMITS.get(key);
	if (!stored) {
		return c.json({ error: "Passkey 驗證挑戰無效或已過期，請重試" }, 400);
	}
	await c.env.RATE_LIMITS.delete(key);

	// Look up Passkey by credentialId
	const passkey = await c.env.DB.prepare(
		`SELECT * FROM admin_passkeys WHERE credential_id = ? LIMIT 1`,
	)
		.bind(body.credentialId)
		.first<{
			id: string;
			user_id: string;
			public_key: string;
			counter: number;
		}>();

	if (!passkey) {
		return c.json({ error: "此裝置的 Passkey 尚未在此系統註冊" }, 404);
	}

	const reqUrl = new URL(c.req.url);
	const origin = `${reqUrl.protocol}//${reqUrl.host}`;
	const rpId = reqUrl.hostname;

	const result = await verifyPasskeyAssertion({
		publicKeySpkiBase64: passkey.public_key,
		authenticatorDataBase64: body.authenticatorData,
		clientDataJsonBase64: body.clientDataJSON,
		signatureBase64: body.signature,
		expectedChallenge: body.challenge,
		expectedOrigin: origin,
		expectedRpId: rpId,
	});

	if (!result.ok) {
		log.warn("admin_login.passkey.verify_failed", { error: result.error });
		return c.json({ error: result.error || "Passkey 驗證失敗" }, 400);
	}

	// Update counter and last_used_at
	await c.env.DB.prepare(
		`UPDATE admin_passkeys SET counter = counter + 1, last_used_at = ? WHERE id = ?`,
	)
		.bind(Date.now(), passkey.id)
		.run();

	// Verify user is valid admin
	const user = await getUser(c.env.DB, passkey.user_id);
	if (!user || user.is_banned || !user.is_admin) {
		return c.json({ error: "此 Passkey 關聯的管理員帳號已被停用" }, 403);
	}

	await issueSession(c, user.id);
	log.info("admin_login.passkey.success", { userId: user.id, passkeyId: passkey.id });
	return c.json({ ok: true, redirect: "/admin" });
});
