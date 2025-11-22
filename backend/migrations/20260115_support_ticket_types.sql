-- Добавляем нужные колонки
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS listing_id UUID NULL,
  ADD COLUMN IF NOT EXISTS listing_region TEXT NULL;

-- Добавляем внешний ключ отдельно, только если его ещё нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_tickets_listing_id_fkey'
  ) THEN
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_listing_id_fkey
      FOREIGN KEY (listing_id)
      REFERENCES listings(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_support_tickets_type
  ON support_tickets(type);

CREATE INDEX IF NOT EXISTS idx_support_tickets_listing
  ON support_tickets(listing_id);
