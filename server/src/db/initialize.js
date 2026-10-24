import { readFile } from 'node:fs/promises';

// Keep startup schema changes in one place and fail startup if any migration fails.
export async function initializeDatabase(pool) {
  try {
    const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    await pool.query("CREATE TABLE IF NOT EXISTS service_maintenance (id INTEGER PRIMARY KEY CHECK (id=1), enabled BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("INSERT INTO service_maintenance(id,enabled,reason) VALUES(1,FALSE,'') ON CONFLICT(id) DO NOTHING");
    await pool.query('ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_exact_unique_idx ON users(email)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(LOWER(email)) WHERE email IS NOT NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx ON users(google_sub) WHERE google_sub IS NOT NULL');
    await pool.query("CREATE TABLE IF NOT EXISTS web_sessions (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query('CREATE INDEX IF NOT EXISTS web_sessions_user_idx ON web_sessions(user_id, expires_at DESC)');
    await pool.query("CREATE TABLE IF NOT EXISTS email_login_codes (id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), request_ip TEXT)");
    await pool.query('CREATE INDEX IF NOT EXISTS email_login_codes_lookup_idx ON email_login_codes(LOWER(email), created_at DESC)');
    await pool.query("CREATE TABLE IF NOT EXISTS admin_active_roles (telegram_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('developer','chief_admin','admin','moderator','helper')), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query('CREATE TABLE IF NOT EXISTS admin_access_passwords (telegram_id TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    await pool.query('CREATE TABLE IF NOT EXISTS admin_access_sessions (telegram_id TEXT PRIMARY KEY, unlocked_until TIMESTAMPTZ NOT NULL)');
    await pool.query('CREATE TABLE IF NOT EXISTS admin_access_timezones (telegram_id TEXT PRIMARY KEY, time_zone TEXT NOT NULL)');
    await pool.query("ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check");
    await pool.query("ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('draft','pending','published','hidden','rejected')) NOT VALID");
    // Existing databases retain old CREATE TABLE constraints; migrate listing ages for the teen band.
    await pool.query("ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_age_check");
    // Keep legacy rows intact during the policy migration; new writes still enforce the 14–100 range.
    await pool.query("ALTER TABLE listings ADD CONSTRAINT listings_age_check CHECK (age BETWEEN 14 AND 100) NOT VALID");
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_roles (telegram_id TEXT PRIMARY KEY, username TEXT, role TEXT NOT NULL CHECK (role IN ('chief_admin','admin','moderator','helper')), assigned_by TEXT NOT NULL, is_public BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await pool.query('ALTER TABLE admin_roles ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE');
      await pool.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS media_url TEXT');
      await pool.query("ALTER TABLE listings ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'");
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_telegram_username TEXT');
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_telegram_username TEXT');
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence TEXT');
      await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'profile'");
      await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS listing_id BIGINT');
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_issuer TEXT NOT NULL DEFAULT 'moderator'");
      await pool.query("CREATE TABLE IF NOT EXISTS telegram_support_tickets (id BIGSERIAL PRIMARY KEY, telegram_id TEXT NOT NULL, username TEXT, first_name TEXT NOT NULL DEFAULT 'Пользователь', user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      await pool.query("CREATE TABLE IF NOT EXISTS telegram_support_messages (id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES telegram_support_tickets(id) ON DELETE CASCADE, sender_telegram_id TEXT NOT NULL, sender_role TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      await pool.query("CREATE TABLE IF NOT EXISTS telegram_support_sessions (telegram_id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK (mode IN ('new_ticket','staff_reply')), ticket_id BIGINT REFERENCES telegram_support_tickets(id) ON DELETE CASCADE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      await pool.query("CREATE TABLE IF NOT EXISTS referrals (id BIGSERIAL PRIMARY KEY, referrer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, referred_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, referred_telegram_id TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (referrer_user_id <> referred_user_id))");
      await pool.query('CREATE INDEX IF NOT EXISTS referrals_referrer_created_idx ON referrals(referrer_user_id, created_at DESC)');

    await pool.query("CREATE TABLE IF NOT EXISTS stories (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_url TEXT NOT NULL, media_type TEXT NOT NULL CHECK (media_type IN ('image','video')), caption TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'))");
    await pool.query('CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories(expires_at DESC)');
    console.log('VIBE database schema ready');
  } catch (error) {
    console.error('VIBE database schema initialization failed:', error.message);
    throw error;
  }
}
