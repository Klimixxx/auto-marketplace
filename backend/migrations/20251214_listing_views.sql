-- 20251214_listing_views.sql (robust & idempotent)
-- Track unique listing views per authenticated user and expose aggregate counters

BEGIN;

----------------------------------------------------------------------
-- 1) Гарантируем, что у listings.id и users.id есть PRIMARY KEY
----------------------------------------------------------------------

-- listings: ensure PK(id)
DO $$
DECLARE has_pk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = current_schema()
      AND rel.relname = 'listings'
      AND con.contype = 'p'
  ) INTO has_pk;

  IF NOT has_pk THEN
    EXECUTE 'ALTER TABLE ONLY listings ADD PRIMARY KEY (id)';
  END IF;
END$$;

-- users: ensure PK(id)
DO $$
DECLARE has_pk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = current_schema()
      AND rel.relname = 'users'
      AND con.contype = 'p'
  ) INTO has_pk;

  IF NOT has_pk THEN
    EXECUTE 'ALTER TABLE ONLY users ADD PRIMARY KEY (id)';
  END IF;
END$$;

----------------------------------------------------------------------
-- 2) Определяем целевые типы id и создаём/нормализуем listing_views
----------------------------------------------------------------------

DO $$
DECLARE
  t_listings_id text;
  t_users_id    text;

  lv_exists  boolean;
  lv_empty   boolean;
  lv_lid_ty  text;
  lv_uid_ty  text;

  create_sql text;
BEGIN
  -- типы целевых PK
  SELECT a.atttypid::regtype::text
    INTO t_listings_id
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname = 'listings'
    AND a.attname = 'id'
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF t_listings_id IS NULL THEN
    RAISE EXCEPTION 'Column listings.id not found';
  END IF;

  SELECT a.atttypid::regtype::text
    INTO t_users_id
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname = 'users'
    AND a.attname = 'id'
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF t_users_id IS NULL THEN
    RAISE EXCEPTION 'Column users.id not found';
  END IF;

  -- существует ли listing_views
  SELECT to_regclass((current_schema()||'.listing_views')) IS NOT NULL INTO lv_exists;

  IF NOT lv_exists THEN
    -- создаём сразу с точными типами
    create_sql := format($SQL$
      CREATE TABLE listing_views (
        listing_id %s NOT NULL,
        user_id    %s NOT NULL,
        first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (listing_id, user_id)
      )$SQL$, t_listings_id, t_users_id);
    EXECUTE create_sql;

  ELSE
    -- таблица есть: проверим типы
    SELECT a.atttypid::regtype::text
      INTO lv_lid_ty
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'listing_views'
      AND a.attname = 'listing_id'
      AND a.attnum > 0 AND NOT a.attisdropped;

    SELECT a.atttypid::regtype::text
      INTO lv_uid_ty
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'listing_views'
      AND a.attname = 'user_id'
      AND a.attnum > 0 AND NOT a.attisdropped;

    -- пустая ли таблица
    EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM listing_views LIMIT 1)' INTO lv_empty;

    IF lv_lid_ty IS NULL OR lv_uid_ty IS NULL THEN
      RAISE EXCEPTION 'listing_views exists but lacks required columns listing_id/user_id';
    END IF;

    IF lv_lid_ty = t_listings_id AND lv_uid_ty = t_users_id THEN
      -- типы уже совпадают — ничего не делаем
      NULL;
    ELSE
      -- Если пустая — дропаем и пересоздаём с корректными типами (самый безопасный путь)
      IF lv_empty THEN
        EXECUTE 'DROP TABLE listing_views';
        create_sql := format($SQL$
          CREATE TABLE listing_views (
            listing_id %s NOT NULL,
            user_id    %s NOT NULL,
            first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (listing_id, user_id)
          )$SQL$, t_listings_id, t_users_id);
        EXECUTE create_sql;
      ELSE
        -- Несовместимые типы при непустой таблице — не трогаем данные автоматически
        RAISE EXCEPTION
          'listing_views has incompatible types (listing_id: %, user_id: %) while targets are (%, %). Table is not empty — manual data migration required.',
          lv_lid_ty, lv_uid_ty, t_listings_id, t_users_id;
      END IF;
    END IF;
  END IF;
END$$;

-- Индексы (повторные вызовы безопасны)
CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user    ON listing_views(user_id);

----------------------------------------------------------------------
-- 3) FK после того, как типы точно совпадают
----------------------------------------------------------------------

DO $$
DECLARE has_fk boolean;
BEGIN
  -- FK -> listings(id)
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = current_schema()
      AND rel.relname = 'listing_views'
      AND con.contype = 'f'
      AND con.conname = 'listing_views_listing_id_fkey'
  ) INTO has_fk;

  IF NOT has_fk THEN
    EXECUTE '
      ALTER TABLE listing_views
        ADD CONSTRAINT listing_views_listing_id_fkey
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    ';
  END IF;

  -- FK -> users(id)
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = current_schema()
      AND rel.relname = ''listing_views''
      AND con.contype = ''f''
      AND con.conname = ''listing_views_user_id_fkey''
  ) INTO has_fk;

  IF NOT has_fk THEN
    EXECUTE '
      ALTER TABLE listing_views
        ADD CONSTRAINT listing_views_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ';
  END IF;
END$$;

----------------------------------------------------------------------
-- 4) Счётчик просмотров в listings
----------------------------------------------------------------------

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

ALTER TABLE listings
  ALTER COLUMN view_count SET DEFAULT 0;

UPDATE listings
   SET view_count = 0
 WHERE view_count IS NULL;

----------------------------------------------------------------------
-- 5) Бэкфилл агрегатов (уникальные просмотры per user)
----------------------------------------------------------------------

WITH counters AS (
  SELECT listing_id, COUNT(*)::INT AS c
  FROM listing_views
  GROUP BY listing_id
)
UPDATE listings l
SET view_count = COALESCE(c.c, 0)
FROM counters c
WHERE l.id = c.listing_id;

COMMIT;
