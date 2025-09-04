-- USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT now()
);

-- AUTH CODES
CREATE TABLE IF NOT EXISTS auth_codes (
  id SERIAL PRIMARY KEY,
  phone TEXT,
  code TEXT,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  used_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_created
  ON auth_codes (phone, created_at DESC);

-- LISTINGS (минимально, под твой код /admin и /ingest)
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  source_id TEXT,
  title TEXT,
  description TEXT,
  asset_type TEXT,
  region TEXT,
  currency TEXT,
  start_price NUMERIC,
  current_price NUMERIC,
  status TEXT,
  end_date TIMESTAMP NULL,
  source_url TEXT,
  details JSONB,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- PARSER TOKENS (если используешь)
CREATE TABLE IF NOT EXISTS parser_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- На случай старой схемы — мягкие добивки полей
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

