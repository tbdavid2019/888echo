import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ID, ADMIN_SID, adminHarness, makeKv } from "./helpers/admin-sqlite";

describe("Admin Login & Passkeys Routes", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const setup = (extra: Record<string, unknown> = {}) => {
		const rateLimits = makeKv();
		const h = adminHarness({
			ADMIN_EMAILS: "admin@example.com",
			RATE_LIMITS: rateLimits,
			EMAIL_PROVIDER: "resend",
			RESEND_API_KEY: "re_test_key",
			...extra,
		});
		return { ...h, rateLimits };
	};

	it("serves /admin/login page and client script without authentication", async () => {
		const { request } = setup();

		// Unauthenticated request
		const pageRes = await request("/admin/login", { headers: { cookie: "" } });
		expect(pageRes.status).toBe(200);
		const html = await pageRes.text();
		expect(html).toContain("Garrul 管理員登入");
		expect(html).toContain("btn-passkey");
		expect(html).toContain("email-input");

		const jsRes = await request("/admin/login/app.js", { headers: { cookie: "" } });
		expect(jsRes.status).toBe(200);
		expect(jsRes.headers.get("content-type")).toContain("text/javascript");
	});

	it("redirects to /admin if already logged in as admin", async () => {
		const { request } = setup();
		const res = await request("/admin/login", { sid: ADMIN_SID });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/admin");
	});

	it("handles email OTP code sending and verification", async () => {
		const { request, sqlite } = setup();

		vi.stubGlobal("fetch", async () => {
			return new Response(JSON.stringify({ id: "email_123" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		// Non-admin email rejected
		const nonAdminRes = await request("/admin/api/login/email-code/send", {
			method: "POST",
			headers: { cookie: "" },
			body: { email: "stranger@example.com" },
		});
		expect(nonAdminRes.status).toBe(403);

		// Admin email accepted
		const sendRes = await request("/admin/api/login/email-code/send", {
			method: "POST",
			headers: { cookie: "" },
			body: { email: "admin@example.com" },
		});
		expect(sendRes.status).toBe(200);

		// Verify database row
		const row = sqlite
			.prepare("SELECT * FROM admin_login_codes WHERE email = ?")
			.get("admin@example.com") as { id: string; code_hash: string } | undefined;
		expect(row).toBeDefined();

		// Wrong code fails
		const wrongRes = await request("/admin/api/login/email-code/verify", {
			method: "POST",
			headers: { cookie: "" },
			body: { email: "admin@example.com", code: "000000" },
		});
		expect(wrongRes.status).toBe(400);

		const afterWrong = sqlite
			.prepare("SELECT attempts FROM admin_login_codes WHERE email = ?")
			.get("admin@example.com") as { attempts: number };
		expect(afterWrong.attempts).toBe(1);
	});

	it("generates passkey challenge for login", async () => {
		const { request } = setup();
		const res = await request("/admin/api/login/passkey/challenge", {
			method: "POST",
			headers: { cookie: "" },
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as { challenge: string; rpId: string };
		expect(data.challenge).toBeDefined();
		expect(data.rpId).toBeDefined();
	});

	it("gates /admin/passkeys behind admin authentication", async () => {
		const { request } = setup();

		// Unauthenticated
		const unauthRes = await request("/admin/passkeys", { headers: { cookie: "" } });
		expect(unauthRes.status).toBe(401);

		// Authenticated
		const authRes = await request("/admin/passkeys", { sid: ADMIN_SID });
		expect(authRes.status).toBe(200);
		const html = await authRes.text();
		expect(html).toContain("Passkey 生物辨識與安全金鑰管理");
		expect(html).toContain("btn-add-passkey");
	});

	it("serves /admin/passkeys/app.js client script", async () => {
		const { request } = setup();
		const res = await request("/admin/passkeys/app.js");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/javascript");
	});
});
