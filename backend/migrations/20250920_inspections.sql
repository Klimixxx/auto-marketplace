-- Осмотры (заказы на отчёт по конкретному объявлению)
-- Привязаны к существующим users(id) и listings(id), которые у тебя SERIAL (int)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inspection_status'
  ) THEN
    CREATE TYPE inspection_status AS ENUM ('Идет модерация','Выполняется осмотр машины','Завершен');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS inspections (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status inspection_status NOT NULL DEFAULT 'Идет модерация',
  base_price INTEGER NOT NULL DEFAULT 12000,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  final_amount INTEGER NOT NULL,
  report_pdf_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_user ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_listing ON inspections(listing_id);
