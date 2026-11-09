-- Migration 0035: Admin login with Passkeys and Email Code OTP

CREATE TABLE IF NOT EXISTS admin_passkeys (
	id            TEXT PRIMARY KEY,
	user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name          TEXT NOT NULL,
	credential_id TEXT NOT NULL UNIQUE,
	public_key    TEXT NOT NULL,
	counter       INTEGER NOT NULL DEFAULT 0,
	created_at    INTEGER NOT NULL,
	last_used_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_user ON admin_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_cred ON admin_passkeys(credential_id);

CREATE TABLE IF NOT EXISTS admin_login_codes (
	id            TEXT PRIMARY KEY,
	email         TEXT NOT NULL,
	code_hash     TEXT NOT NULL,
	expires_at    INTEGER NOT NULL,
	attempts      INTEGER NOT NULL DEFAULT 0,
	created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_login_codes_lookup ON admin_login_codes(email, expires_at);
