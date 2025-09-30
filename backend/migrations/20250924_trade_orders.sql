-- 20250924_trade_orders.sql
-- Создает enum, таблицу, добивает недостающие поля/индексы и триггер updated_at.

DO $m$
DECLARE
  v_user_id_type    TEXT;
  v_listing_id_type TEXT;
  has_tbl           BOOLEAN;
  has_fk_user       BOOLEAN;
  has_fk_listing    BOOLEAN;
BEGIN
  -- enum trade_order_status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_order_status') THEN
    EXECUTE $q$
      CREATE TYPE trade_order_status AS ENUM (
        'Оплачен/Ожидание модерации',
        'Заявка подтверждена',
        'Подготовка к торгам',
        'Торги завершены'
      )
    $q$;
  END IF;

  -- типы ключей users.id и listings.id
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_user_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'users'::regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped
  LIMIT 1;
  IF v_user_id_type IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить тип users.id';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_listing_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'listings'::regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped
  LIMIT 1;
  IF v_listing_id_type IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить тип listings.id';
  END IF;

  -- таблица trade_orders
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'trade_orders'
  ) INTO has_tbl;

  IF NOT has_tbl THEN
    EXECUTE format($q$
      CREATE TABLE trade_orders (
        id BIGSERIAL PRIMARY KEY,
        user_id   %1$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        listing_id %2$s NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        status trade_order_status NOT NULL DEFAULT 'Оплачен/Ожидание модерации',
        base_price        INTEGER NOT NULL,
        discount_percent  INTEGER NOT NULL DEFAULT 0,
        final_amount      INTEGER NOT NULL,
        service_tier      TEXT,
        lot_price_estimate NUMERIC,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        admin_last_viewed_at TIMESTAMP,
        user_last_viewed_at  TIMESTAMP DEFAULT now()
      )
    $q$, v_user_id_type, v_listing_id_type);
  ELSE
    -- добиваем недостающие колонки
    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS user_id ' || v_user_id_type;
    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS listing_id ' || v_listing_id_type;

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS status trade_order_status';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN status SET DEFAULT ''Оплачен/Ожидание модерации''';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS base_price INTEGER';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN base_price SET NOT NULL';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS discount_percent INTEGER';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN discount_percent SET DEFAULT 0';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS final_amount INTEGER';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN final_amount SET NOT NULL';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS service_tier TEXT';
    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS lot_price_estimate NUMERIC';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN created_at SET DEFAULT now()';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN updated_at SET DEFAULT now()';

    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS admin_last_viewed_at TIMESTAMP';
    EXECUTE 'ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS user_last_viewed_at TIMESTAMP';
    EXECUTE 'ALTER TABLE trade_orders ALTER COLUMN user_last_viewed_at SET DEFAULT now()';
  END IF;

  -- внешние ключи: только если отсутствуют
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'trade_orders_user_fk'
      AND c.conrelid = 'trade_orders'::regclass
  ) INTO has_fk_user;

  IF NOT has_fk_user THEN
    EXECUTE 'ALTER TABLE trade_orders
             ADD CONSTRAINT trade_orders_user_fk
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'trade_orders_listing_fk'
      AND c.conrelid = 'trade_orders'::regclass
  ) INTO has_fk_listing;

  IF NOT has_fk_listing THEN
    EXECUTE 'ALTER TABLE trade_orders
             ADD CONSTRAINT trade_orders_listing_fk
             FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE';
  END IF;

  -- индексы
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_trade_orders_user    ON trade_orders(user_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_trade_orders_listing ON trade_orders(listing_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_trade_orders_created ON trade_orders(created_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_trade_orders_status  ON trade_orders(status)';

  -- backfill viewed_at
  EXECUTE $q$
    UPDATE trade_orders
       SET admin_last_viewed_at = COALESCE(admin_last_viewed_at, updated_at),
           user_last_viewed_at  = COALESCE(user_last_viewed_at,  updated_at)
     WHERE admin_last_viewed_at IS NULL OR user_last_viewed_at IS NULL
  $q$;
END
$m$;

-- триггер updated_at
DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trade_orders_set_updated_at'
  ) THEN
    CREATE FUNCTION trade_orders_set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_trade_orders_set_updated_at'
  ) THEN
    CREATE TRIGGER tr_trade_orders_set_updated_at
      BEFORE UPDATE ON trade_orders
      FOR EACH ROW EXECUTE FUNCTION trade_orders_set_updated_at();
  END IF;
END
$m$;
