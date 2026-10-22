CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT NOT NULL,
  birth_date DATE,
  age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  age_verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (age_verification_status IN ('unverified','pending','verified','rejected','manual_review')),
  age_verified_at TIMESTAMPTZ,
  age_verification_provider TEXT,
  verified_birth_date DATE,
  gender TEXT CHECK (gender IN ('woman','man','nonbinary','prefer_not_to_say')),
  profile_review_status TEXT NOT NULL DEFAULT 'clear' CHECK (profile_review_status IN ('clear','flagged','reviewing','restricted')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','restricted','suspended','banned')),
  moderation_note TEXT,
  bio TEXT NOT NULL DEFAULT '',
  city TEXT,
  photo_url TEXT,
  goal TEXT NOT NULL DEFAULT 'friendship' CHECK (goal IN ('friendship','chat','relationship','both')),
  interests TEXT[] NOT NULL DEFAULT '{}',
  discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 100),
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  hobbies TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS listings_discovery_idx ON listings(status, created_at DESC);
CREATE TABLE IF NOT EXISTS likes (
  from_user BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_user, to_user),
  CHECK (from_user <> to_user)
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporter_id <> reported_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  match_low BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_high BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (match_low < match_high)
);
CREATE INDEX IF NOT EXISTS users_discovery_idx ON users (discoverable, created_at DESC);
CREATE INDEX IF NOT EXISTS likes_to_user_idx ON likes (to_user);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at);

-- Store verification metadata only. Passport/document images must be handled by a vetted
-- age-assurance provider, not uploaded to this API or sent to a general-purpose AI model.
CREATE TABLE IF NOT EXISTS age_verification_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','manual_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS moderation_flags (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('profile_photo_review','age_concern','impersonation','other')),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS age_verification_user_idx ON age_verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_flags_status_idx ON moderation_flags(status, created_at);
