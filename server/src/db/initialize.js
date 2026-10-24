import { readFile } from 'node:fs/promises';

// Keep startup schema changes in one place and fail startup if any migration fails.
export async function initializeDatabase(pool) {
  try {
    const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    await pool.query("CREATE TABLE IF NOT EXISTS service_maintenance (id INTEGER PRIMARY KEY CHECK (id=1), enabled BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("INSERT INTO service_maintenance(id,enabled,reason) VALUES(1,FALSE,'') ON CONFLICT(id) DO NOTHING");
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

    console.log('VIBE database schema ready');
  } catch (error) {
    console.error('VIBE database schema initialization failed:', error.message);
    throw error;
  }
}
