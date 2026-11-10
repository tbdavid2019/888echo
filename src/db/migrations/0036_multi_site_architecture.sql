-- Migration 0036: Multi-Site & Multi-Domain Architecture

CREATE TABLE IF NOT EXISTS sites (
	id               TEXT PRIMARY KEY,
	domain           TEXT NOT NULL UNIQUE,
	name             TEXT NOT NULL,
	description      TEXT,
	default_locale   TEXT NOT NULL DEFAULT 'zh-Hant',
	allow_anonymous  INTEGER NOT NULL DEFAULT 1,
	auto_close_days  INTEGER NOT NULL DEFAULT 0,
	created_at       INTEGER NOT NULL,
	updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);

ALTER TABLE posts ADD COLUMN site_id TEXT REFERENCES sites(id);
ALTER TABLE posts ADD COLUMN raw_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_site_raw ON posts(site_id, raw_slug);

ALTER TABLE webhook_endpoints ADD COLUMN site_id TEXT REFERENCES sites(id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_site ON webhook_endpoints(site_id);

UPDATE posts SET raw_slug = slug WHERE raw_slug IS NULL;
