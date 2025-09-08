CREATE TABLE IF NOT EXISTS visits_daily (
  day        DATE PRIMARY KEY,
  cnt        INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);
