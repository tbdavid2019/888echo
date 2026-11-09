/**
 * Admin Passkey Management: register, list, and delete FIDO2/Touch ID/Face ID Passkeys.
 */

import { Hono } from "hono";
import type { Bindings } from "../index";
import { adminInsertAudit, getUser, type User } from "../db/queries";
import { generateChallenge } from "../lib/passkey";
import { readSession } from "../lib/session";
import { ulid } from "../lib/ulid";
import { escapeHtml } from "../admin-ui/escape";

export const adminPasskeys = new Hono<{ Bindings: Bindings }>();

const getAdminUser = async (c: any): Promise<User | null> => {
	const session = await readSession(c);
	if (!session) return null;
	const user = await getUser(c.env.DB, session.user_id);
	if (!user || user.is_banned || user.role !== "admin") return null;
	return user;
};

type PasskeyRow = {
	id: string;
	user_id: string;
	name: string;
	credential_id: string;
	counter: number;
	created_at: number;
	last_used_at: number | null;
};

const formatDate = (ts: number | null): string => {
	if (!ts) return "從未使用";
	return new Date(ts).toLocaleString("zh-TW", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const renderPasskeysPage = (passkeys: PasskeyRow[]): string => {
	const rows = passkeys.length === 0
		? `<tr><td colspan="5" style="text-align:center;padding:2rem;" class="muted">目前尚未在此帳號綁定任何 Passkey 裝置金鑰。點擊上方按鈕即可綁定！</td></tr>`
		: passkeys.map((p) => `
<tr>
  <td style="font-weight:600;">
    <span style="display:inline-flex;align-items:center;gap:0.4rem;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
      ${escapeHtml(p.name)}
    </span>
  </td>
  <td><code style="font-size:0.8rem;">${escapeHtml(p.credential_id.slice(0, 16))}…</code></td>
  <td class="muted">${formatDate(p.created_at)}</td>
  <td class="muted">${formatDate(p.last_used_at)}</td>
  <td>
    <button type="button" class="btn" style="color:#ef4444;padding:0.3rem 0.6rem;font-size:0.8rem;" onclick="deletePasskey('${escapeHtml(p.id)}', '${escapeHtml(p.name)}')">刪除</button>
  </td>
</tr>`).join("");

	return `
<div class="card" style="margin-bottom:1.5rem;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <div>
      <h3 style="margin:0 0 0.35rem 0;">Passkey 生物辨識與安全金鑰管理</h3>
      <p class="muted" style="margin:0;font-size:0.875rem;">
        在此綁定您的 Touch ID、Face ID 或 Windows Hello，未來在 <code>/admin/login</code> 即可免密碼一秒登入！
      </p>
    </div>
    <button id="btn-add-passkey" type="button" class="btn btn-primary" style="display:flex;align-items:center;gap:0.4rem;padding:0.6rem 1rem;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      綁定此裝置 Passkey (Touch ID / Face ID)
    </button>
  </div>

  <div id="passkey-alert" style="display:none;padding:0.75rem 1rem;border-radius:6px;margin-bottom:1rem;font-size:0.875rem;"></div>

  <table>
    <thead>
      <tr>
        <th>裝置名稱</th>
        <th>金鑰 ID</th>
        <th>建立時間</th>
        <th>最後使用</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>

<script src="/admin/passkeys/app.js"></script>
`;
};

const PASSKEYS_JS = `(function () {
  var alertBox = document.getElementById("passkey-alert");
  function showMsg(msg, isError) {
    if (!alertBox) return;
    alertBox.style.display = "block";
    alertBox.textContent = msg;
    alertBox.style.background = isError ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)";
    alertBox.style.color = isError ? "#ef4444" : "#10b981";
    alertBox.style.border = isError ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)";
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

  var btnAdd = document.getElementById("btn-add-passkey");
  if (btnAdd) {
    if (!window.PublicKeyCredential) {
      btnAdd.disabled = true;
      btnAdd.title = "此瀏覽器不支援 WebAuthn / Passkey";
    } else {
      btnAdd.addEventListener("click", async function () {
        var name = prompt("請為此裝置的 Passkey 命名（例如：MacBook Touch ID）：", "我的 Passkey (" + (navigator.platform || "裝置") + ")");
        if (!name || !name.trim()) return;

        btnAdd.disabled = true;
        try {
          var chRes = await fetch("/admin/api/passkeys/register-challenge", {
            method: "POST",
            headers: { "content-type": "application/json" }
          });
          var chData = await chRes.json();
          if (!chRes.ok || !chData.challenge) {
            throw new Error(chData.error || "無法取得註冊挑戰");
          }

          var cred = await navigator.credentials.create({
            publicKey: {
              challenge: b64ToBytes(chData.challenge),
              rp: { name: "Garrul Admin", id: window.location.hostname },
              user: {
                id: new TextEncoder().encode(chData.userId),
                name: chData.userName || "Admin",
                displayName: chData.userName || "Admin"
              },
              pubKeyCredParams: [
                { alg: -7, type: "public-key" },  // ES256 (ECDSA P-256)
                { alg: -257, type: "public-key" } // RS256
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "preferred",
                residentKey: "preferred"
              },
              timeout: 60000
            }
          });

          if (!cred) throw new Error("使用者取消或認證失敗");

          var credentialId = bytesToB64(new Uint8Array(cred.rawId));
          var publicKeySpki = "";
          if (cred.response.getPublicKey) {
            var spki = cred.response.getPublicKey();
            if (spki) publicKeySpki = bytesToB64(new Uint8Array(spki));
          }

          var regRes = await fetch("/admin/api/passkeys/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              credentialId: credentialId,
              publicKeySpki: publicKeySpki,
              challenge: chData.challenge
            })
          });
          var regData = await regRes.json();
          if (regRes.ok && regData.ok) {
            showMsg("🎉 Passkey 綁定成功！頁面即將重新載入...", false);
            setTimeout(function () { location.reload(); }, 800);
          } else {
            throw new Error(regData.error || "註冊失敗");
          }
        } catch (err) {
          if (err.name === "NotAllowedError") {
            showMsg("已取消生物辨識操作", true);
          } else {
            showMsg("Passkey 綁定失敗: " + err.message, true);
          }
        } finally {
          btnAdd.disabled = false;
        }
      });
    }
  }

  window.deletePasskey = async function (id, name) {
    if (!confirm("確定要刪除「" + name + "」這組 Passkey 嗎？刪除後將無法再以此金鑰登入。")) return;
    try {
      var res = await fetch("/admin/api/passkeys/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: { "content-type": "application/json" }
      });
      var data = await res.json();
      if (res.ok && data.ok) {
        showMsg("Passkey 已成功刪除", false);
        setTimeout(function () { location.reload(); }, 500);
      } else {
        throw new Error(data.error || "刪除失敗");
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  };
})();
`;

adminPasskeys.get("/passkeys/app.js", (c) =>
	c.body(PASSKEYS_JS, 200, { "content-type": "text/javascript; charset=utf-8" }),
);

// ----------------------------- Backend APIs -----------------------------

/**
 * Register challenge for admin user
 */
adminPasskeys.post("/api/passkeys/register-challenge", async (c) => {
	const user = await getAdminUser(c);
	if (!user) {
		return c.json({ error: "not_authorized" }, 403);
	}

	const challenge = generateChallenge();
	const key = `passkey_reg_chal:${challenge}`;
	await c.env.RATE_LIMITS.put(key, user.id, { expirationTtl: 120 });

	return c.json({
		challenge,
		rpId: new URL(c.req.url).hostname,
		userId: user.id,
		userName: user.name || "Admin",
	});
});

/**
 * Complete passkey registration
 */
adminPasskeys.post("/api/passkeys/register", async (c) => {
	const user = await getAdminUser(c);
	if (!user) {
		return c.json({ error: "not_authorized" }, 403);
	}

	const body = await c.req.json<{
		name?: string;
		credentialId?: string;
		publicKeySpki?: string;
		challenge?: string;
	}>().catch(() => null);

	if (!body?.name || !body?.credentialId || !body?.challenge) {
		return c.json({ error: "缺少註冊參數" }, 400);
	}

	// Verify challenge
	const key = `passkey_reg_chal:${body.challenge}`;
	const storedUserId = await c.env.RATE_LIMITS.get(key);
	if (!storedUserId || storedUserId !== user.id) {
		return c.json({ error: "挑戰已過期或無效，請重試" }, 400);
	}
	await c.env.RATE_LIMITS.delete(key);

	// Insert into admin_passkeys
	const id = ulid();
	const now = Date.now();
	await c.env.DB.prepare(
		`INSERT INTO admin_passkeys (id, user_id, name, credential_id, public_key, counter, created_at, last_used_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?, NULL)`,
	)
		.bind(id, user.id, body.name.trim(), body.credentialId, body.publicKeySpki ?? "", now)
		.run();

	await adminInsertAudit(c.env.DB, {
		admin_id: user.id,
		action: "passkey.create",
		target_kind: "passkey",
		target_id: id,
		meta: { name: body.name },
	});

	return c.json({ ok: true, id });
});

/**
 * Delete a passkey
 */
adminPasskeys.delete("/api/passkeys/:id", async (c) => {
	const user = await getAdminUser(c);
	if (!user) {
		return c.json({ error: "not_authorized" }, 403);
	}

	const id = c.req.param("id");
	await c.env.DB.prepare(`DELETE FROM admin_passkeys WHERE id = ? AND user_id = ?`)
		.bind(id, user.id)
		.run();

	await adminInsertAudit(c.env.DB, {
		admin_id: user.id,
		action: "passkey.delete",
		target_kind: "passkey",
		target_id: id,
		meta: { id },
	});

	return c.json({ ok: true });
});
