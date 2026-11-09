import { describe, expect, it } from "vitest";
import {
	base64UrlToBytes,
	bytesToBase64Url,
	derToP1363,
	generateChallenge,
	verifyPasskeyAssertion,
} from "../src/lib/passkey";

describe("passkey crypto utilities", () => {
	it("converts bytes to base64url and back symmetrically", () => {
		const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16]);
		const b64 = bytesToBase64Url(original);
		expect(b64).not.toContain("+");
		expect(b64).not.toContain("/");
		expect(b64).not.toContain("=");
		const recovered = base64UrlToBytes(b64);
		expect(Array.from(recovered)).toEqual(Array.from(original));
	});

	it("generates a 32-byte (43 chars) random base64url challenge", () => {
		const c1 = generateChallenge();
		const c2 = generateChallenge();
		expect(c1).not.toBe(c2);
		expect(base64UrlToBytes(c1).length).toBe(32);
	});

	it("converts DER signature to 64-byte P1363 correctly", async () => {
		// Generate an ECDSA P-256 key pair and sign some data
		const keyPair = (await crypto.subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		const data = new TextEncoder().encode("test payload");
		// Note: Web Crypto subtle.sign outputs P1363 (64 bytes)
		const p1363 = new Uint8Array(await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			keyPair.privateKey,
			data,
		));
		expect(p1363.length).toBe(64);

		// Now craft a DER signature from r (first 32) and s (last 32)
		const r = p1363.slice(0, 32);
		const s = p1363.slice(32, 64);
		// Prepend 0x00 if highest bit is set
		const rEncoded = (r[0]! & 0x80) ? new Uint8Array([0x00, ...r]) : r;
		const sEncoded = (s[0]! & 0x80) ? new Uint8Array([0x00, ...s]) : s;
		const der = new Uint8Array([
			0x30,
			2 + rEncoded.length + 2 + sEncoded.length,
			0x02,
			rEncoded.length,
			...rEncoded,
			0x02,
			sEncoded.length,
			...sEncoded,
		]);

		const converted = derToP1363(der);
		expect(converted.length).toBe(64);
		expect(Array.from(converted)).toEqual(Array.from(p1363));
	});

	it("verifies a full simulated passkey assertion", async () => {
		const keyPair = (await crypto.subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		const spki = new Uint8Array((await crypto.subtle.exportKey("spki", keyPair.publicKey)) as ArrayBuffer);
		const publicKeySpkiBase64 = bytesToBase64Url(spki);

		const challenge = generateChallenge();
		const origin = "https://garrul.ai360.workers.dev";
		const rpId = "garrul.ai360.workers.dev";

		const clientDataJSON = JSON.stringify({
			type: "webauthn.get",
			challenge,
			origin,
		});
		const clientDataBytes = new TextEncoder().encode(clientDataJSON);
		const clientDataJsonBase64 = bytesToBase64Url(clientDataBytes);

		// AuthenticatorData: 32 bytes rpIdHash + 1 byte flags (0x01 = UP) + 4 bytes counter
		const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
		const authData = new Uint8Array(37);
		authData.set(rpIdHash, 0);
		authData[32] = 0x01; // User Present
		authData[36] = 0x01; // counter = 1
		const authenticatorDataBase64 = bytesToBase64Url(authData);

		// Signed data: authData || sha256(clientDataBytes)
		const clientDataHash = await crypto.subtle.digest("SHA-256", clientDataBytes);
		const signedData = new Uint8Array(37 + 32);
		signedData.set(authData, 0);
		signedData.set(new Uint8Array(clientDataHash), 37);

		// Sign with private key (P1363 format)
		const p1363Sig = new Uint8Array(await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			keyPair.privateKey,
			signedData,
		));

		// Wrap as DER signature
		const r = p1363Sig.slice(0, 32);
		const s = p1363Sig.slice(32, 64);
		const rEncoded = (r[0]! & 0x80) ? new Uint8Array([0x00, ...r]) : r;
		const sEncoded = (s[0]! & 0x80) ? new Uint8Array([0x00, ...s]) : s;
		const derSig = new Uint8Array([
			0x30,
			2 + rEncoded.length + 2 + sEncoded.length,
			0x02,
			rEncoded.length,
			...rEncoded,
			0x02,
			sEncoded.length,
			...sEncoded,
		]);
		const signatureBase64 = bytesToBase64Url(derSig);

		const result = await verifyPasskeyAssertion({
			publicKeySpkiBase64,
			authenticatorDataBase64,
			clientDataJsonBase64,
			signatureBase64,
			expectedChallenge: challenge,
			expectedOrigin: origin,
			expectedRpId: rpId,
		});

		expect(result.ok).toBe(true);
	});
});
