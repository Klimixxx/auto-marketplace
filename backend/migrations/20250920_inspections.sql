DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inspection_status'
  ) THEN
    CREATE TYPE inspection_status AS ENUM (
      'Оплачен/Ожидание модерации',
      'Заказ принят, Приступаем к Осмотру',
      'Производится осмотр',
      'Осмотр завершен'
    );
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
       AND table_name = 'inspections'
  ) THEN
    v_sql := format($fmt$
      CREATE TABLE inspections (
        id BIGSERIAL PRIMARY KEY,
        user_id %1$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        listing_id %2$s NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        status inspection_status NOT NULL DEFAULT 'Оплачен/Ожидание модерации',
        base_price INTEGER NOT NULL DEFAULT 12000,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        final_amount INTEGER NOT NULL,
        report_pdf_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    $fmt$, v_user_id_type, v_listing_id_type);
    EXECUTE v_sql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'inspections'
      AND column_name = 'admin_last_viewed_at'
  ) THEN
    EXECUTE 'ALTER TABLE inspections ADD COLUMN admin_last_viewed_at TIMESTAMP';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'inspections'
      AND column_name = 'user_last_viewed_at'
  ) THEN
    EXECUTE 'ALTER TABLE inspections ADD COLUMN user_last_viewed_at TIMESTAMP';
  END IF;

  BEGIN
    EXECUTE 'ALTER TABLE inspections ALTER COLUMN user_last_viewed_at SET DEFAULT now()';
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END;

  UPDATE inspections
     SET admin_last_viewed_at = updated_at
   WHERE admin_last_viewed_at IS NULL;

  UPDATE inspections
     SET user_last_viewed_at = updated_at
   WHERE user_last_viewed_at IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_inspections_user ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_listing ON inspections(listing_id);
