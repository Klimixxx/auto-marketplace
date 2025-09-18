-- Ensure parser_trades table exists with fields required for moderation workflow
CREATE TABLE IF NOT EXISTS parser_trades (
  id           BIGSERIAL PRIMARY KEY,
  fedresurs_id TEXT,
  bidding_number TEXT,
  title        TEXT,
  description  TEXT,
  applications_count INT,
  lot_details  JSONB,
  debtor_details JSONB,
  contact_details JSONB,
  prices       JSONB,
  documents    JSONB,
  photos       JSONB DEFAULT '[]'::jsonb,
  raw_payload  JSONB,
  category     TEXT,
  region       TEXT,
  brand        TEXT,
  model        TEXT,
  year         TEXT,
  vin          TEXT,
  start_price  NUMERIC,
  date_start   TIMESTAMPTZ,
  date_finish  TIMESTAMPTZ,
  trade_place  TEXT,
  source_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

ALTER TABLE parser_trades
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS applications_count INT,
  ADD COLUMN IF NOT EXISTS lot_details JSONB,
  ADD COLUMN IF NOT EXISTS debtor_details JSONB,
  ADD COLUMN IF NOT EXISTS contact_details JSONB,
  ADD COLUMN IF NOT EXISTS prices JSONB,
  ADD COLUMN IF NOT EXISTS documents JSONB,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS start_price NUMERIC,
  ADD COLUMN IF NOT EXISTS date_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_finish TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trade_place TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE parser_trades
  ALTER COLUMN photos SET DEFAULT '[]'::jsonb,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'parser_trades_fedresurs_id_key'
  ) THEN
    ALTER TABLE parser_trades
      ADD CONSTRAINT parser_trades_fedresurs_id_key UNIQUE (fedresurs_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parser_trades_created_at
  ON parser_trades (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parser_trades_published_at
  ON parser_trades (published_at);
