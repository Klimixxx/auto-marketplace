ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- на будущее, чтобы апдейты было видно
UPDATE users SET updated_at = now() WHERE updated_at IS NULL;
