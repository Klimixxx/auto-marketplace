DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'autoteka_status'
  ) THEN
    CREATE TYPE autoteka_status AS ENUM ('В процессе', 'Обработано');
  END IF;
END $$;

DO $$
DECLARE
  v_user_id_type TEXT;
  v_listing_id_type TEXT;
  v_sql TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_user_id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'users'::regclass
     AND a.attname = 'id'
     AND a.attnum > 0
     AND NOT a.attisdropped
   LIMIT 1;

  IF v_user_id_type IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить тип users.id';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_listing_id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'listings'::regclass
     AND a.attname = 'id'
     AND a.attnum > 0
     AND NOT a.attisdropped
   LIMIT 1;

  IF v_listing_id_type IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить тип listings.id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = 'autoteka_orders'
  ) THEN
    v_sql := format($fmt$
      CREATE TABLE autoteka_orders (
        id BIGSERIAL PRIMARY KEY,
        user_id %1$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        listing_id %2$s NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        status autoteka_status NOT NULL DEFAULT 'В процессе',
        final_amount INTEGER NOT NULL DEFAULT 0,
        report_pdf_url TEXT,
        comment TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        admin_last_viewed_at TIMESTAMP,
        user_last_viewed_at TIMESTAMP NOT NULL DEFAULT now()
      )
    $fmt$, v_user_id_type, v_listing_id_type);
    EXECUTE v_sql;
  END IF;
END $$;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS autoteka_pdf_url TEXT;

CREATE INDEX IF NOT EXISTS idx_autoteka_orders_user ON autoteka_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_autoteka_orders_listing ON autoteka_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_autoteka_orders_status ON autoteka_orders(status);

CREATE TABLE IF NOT EXISTS autoteka_settings (
  settings_key TEXT PRIMARY KEY,
  price INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO autoteka_settings (settings_key, price, created_at, updated_at)
SELECT 'default', 2500, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM autoteka_settings WHERE settings_key = 'default'
);
