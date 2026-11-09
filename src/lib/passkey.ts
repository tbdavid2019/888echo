/**
 * WebAuthn & Passkey FIDO2 cryptographic verification for Cloudflare Workers.
 * Pure Web Crypto API (P-256 / ES256) with zero external dependencies.
 */

export const base64UrlToBytes = (base64url: string): Uint8Array => {
	const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
	const binary = atob(base64 + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

export const bytesToBase64Url = (bytes: Uint8Array): string => {
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const generateChallenge = (): string => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
};

/**
 * Converts ASN.1 DER signature (from browser WebAuthn response) to 64-byte IEEE P1363
 * format required by crypto.subtle.verify.
 */
export const derToP1363 = (derBytes: Uint8Array): Uint8Array => {
	let offset = 0;
	if (derBytes[offset++] !== 0x30) throw new Error("Invalid DER signature sequence");
	let seqLen = derBytes[offset++] ?? 0;
	if (seqLen & 0x80) offset += seqLen & 0x7f;

	if (derBytes[offset++] !== 0x02) throw new Error("Expected integer marker for r");
	const rLen = derBytes[offset++] ?? 0;
	let r = derBytes.slice(offset, offset + rLen);
	offset += rLen;

	if (derBytes[offset++] !== 0x02) throw new Error("Expected integer marker for s");
	const sLen = derBytes[offset++] ?? 0;
	let s = derBytes.slice(offset, offset + sLen);

	if (r.length === 33 && r[0] === 0x00) r = r.slice(1);
	if (s.length === 33 && s[0] === 0x00) s = s.slice(1);

	const p1363 = new Uint8Array(64);
	p1363.set(r, 32 - r.length);
	p1363.set(s, 64 - s.length);
	return p1363;
};

export type VerifyAssertionParams = {
	publicKeySpkiBase64: string;
	authenticatorDataBase64: string;
	clientDataJsonBase64: string;
	signatureBase64: string;
	expectedChallenge: string;
	expectedOrigin: string;
	expectedRpId: string;
};

export const verifyPasskeyAssertion = async (
	params: VerifyAssertionParams,
): Promise<{ ok: boolean; error?: string }> => {
	try {
		const clientDataBytes = base64UrlToBytes(params.clientDataJsonBase64);
		const clientData = JSON.parse(
			new TextDecoder("utf-8").decode(clientDataBytes),
		) as {
			type?: string;
			challenge?: string;
			origin?: string;
		};

		if (clientData.type !== "webauthn.get") {
			return { ok: false, error: "Invalid clientData type" };
		}
		if (clientData.challenge !== params.expectedChallenge) {
			return { ok: false, error: "Challenge mismatch" };
		}

		const parsedOrigin = new URL(clientData.origin ?? "").origin;
		const parsedExpectedOrigin = new URL(params.expectedOrigin).origin;
		if (parsedOrigin !== parsedExpectedOrigin) {
			return { ok: false, error: `Origin mismatch: ${parsedOrigin} != ${parsedExpectedOrigin}` };
		}

		const authDataBytes = base64UrlToBytes(params.authenticatorDataBase64);
		if (authDataBytes.length < 37) {
			return { ok: false, error: "authenticatorData too short" };
		}

		// Verify RP ID Hash (first 32 bytes)
		const rpIdHash = new Uint8Array(
			await crypto.subtle.digest(
				"SHA-256",
				new TextEncoder().encode(params.expectedRpId),
			),
		);
		for (let i = 0; i < 32; i++) {
			if (authDataBytes[i] !== rpIdHash[i]) {
				return { ok: false, error: "RP ID hash mismatch" };
			}
		}

		// Verify User Presence flag (byte 32, bit 0)
		const flags = authDataBytes[32] ?? 0;
		if (!(flags & 0x01)) {
			return { ok: false, error: "User Presence flag not set" };
		}

		// Construct signed payload: authenticatorData || SHA-256(clientDataJSON)
		const clientDataHash = await crypto.subtle.digest("SHA-256", clientDataBytes);
		const signedData = new Uint8Array(authDataBytes.length + 32);
		signedData.set(authDataBytes, 0);
		signedData.set(new Uint8Array(clientDataHash), authDataBytes.length);

		const publicKeyBytes = base64UrlToBytes(params.publicKeySpkiBase64);
		const cryptoKey = await crypto.subtle.importKey(
			"spki",
			publicKeyBytes,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);

		const derSig = base64UrlToBytes(params.signatureBase64);
		const p1363Sig = derToP1363(derSig);

		const isValid = await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			cryptoKey,
			p1363Sig,
			signedData,
		);

		if (!isValid) return { ok: false, error: "Cryptographic signature verification failed" };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
};
