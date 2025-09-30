DO $m$
DECLARE
  v_user_id_type TEXT;
  v_listing_id_type TEXT;
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

  -- типы users.id и listings.id
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

  -- таблица trade_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'trade_orders'
  ) THEN
    EXECUTE format($q$
      CREATE TABLE trade_orders (
        id BIGSERIAL PRIMARY KEY,
        user_id %1$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        listing_id %2$s NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        status trade_order_status NOT NULL DEFAULT 'Оплачен/Ожидание модерации',
        base_price INTEGER NOT NULL,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        final_amount INTEGER NOT NULL,
        service_tier TEXT,
        lot_price_estimate NUMERIC,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        admin_last_viewed_at TIMESTAMP,
        user_last_viewed_at TIMESTAMP DEFAULT now()
      )
    $q$, v_user_id_type, v_listing_id_type);
  END IF;

  -- индексы
  EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_trade_orders_user ON trade_orders(user_id)$q$;
  EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_trade_orders_listing ON trade_orders(listing_id)$q$;

  -- backfill viewed_at
  EXECUTE $q$
    UPDATE trade_orders
       SET admin_last_viewed_at = COALESCE(admin_last_viewed_at, updated_at),
           user_last_viewed_at  = COALESCE(user_last_viewed_at,  updated_at)
     WHERE admin_last_viewed_at IS NULL OR user_last_viewed_at IS NULL
  $q$;
END
$m$;
