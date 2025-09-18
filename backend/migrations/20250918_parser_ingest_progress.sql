-- Track progress of parser ingest runs per search term
CREATE TABLE IF NOT EXISTS parser_ingest_progress (
  search_key   TEXT PRIMARY KEY,
  search_term  TEXT NOT NULL,
  next_offset  INT DEFAULT 0,
  last_offset  INT DEFAULT 0,
  last_received INT DEFAULT 0,
  last_upserted INT DEFAULT 0,
  last_limit   INT DEFAULT 0,
  total_found  INT,
  has_more     BOOLEAN,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Ensure updated_at is refreshed on change
CREATE OR REPLACE FUNCTION touch_parser_ingest_progress()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_parser_ingest_progress_touch'
  ) THEN
    CREATE TRIGGER trg_parser_ingest_progress_touch
    BEFORE UPDATE ON parser_ingest_progress
    FOR EACH ROW EXECUTE FUNCTION touch_parser_ingest_progress();
  END IF;
END;
$$;
