// db.js — token persistence on Render's persistent disk
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';

const DIR = process.env.DATA_DIR || '/var/data';
mkdirSync(DIR, { recursive: true });

const db = new Database(`${DIR}/tokens.db`);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    account_key TEXT NOT NULL,
    cookies_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE(domain, account_key)
  );
  CREATE INDEX IF NOT EXISTS idx_lookup ON tokens(domain, account_key);
  CREATE INDEX IF NOT EXISTS idx_expiry ON tokens(expires_at);
`);

export const store = {
  save({ domain, account_key, cookies, ttl_seconds }) {
    const now = Math.floor(Date.now() / 1000);
    const expires = now + (ttl_seconds || 1800);
    db.prepare(`
      INSERT INTO tokens (domain, account_key, cookies_json, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain, account_key) DO UPDATE SET
        cookies_json = excluded.cookies_json,
        created_at   = excluded.created_at,
        expires_at   = excluded.expires_at
    `).run(domain, account_key, JSON.stringify(cookies), now, expires);
    return { domain, account_key, expires_at: expires };
  },

  get(domain, account_key) {
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare(
      `SELECT * FROM tokens WHERE domain = ? AND account_key = ? AND expires_at > ?`
    ).get(domain, account_key, now);
    if (!row) return null;
    return {
      domain: row.domain,
      account_key: row.account_key,
      cookies: JSON.parse(row.cookies_json),
      expires_at: row.expires_at,
      remaining: row.expires_at - now
    };
  },

  purgeExpired() {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`DELETE FROM tokens WHERE expires_at <= ?`).run(now).changes;
  }
};