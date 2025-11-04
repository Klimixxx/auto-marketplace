-- 20251214_listing_views.sql (fixed, idempotent)
-- Track unique listing views per authenticated user and expose aggregate counters

BEGIN;

----------------------------------------------------------------------
-- 1) Убедимся, что у listings.id и users.id есть PRIMARY KEY.
--    Добавляем PK ТОЛЬКО если его нет (без попыток «поверх» существующего).
----------------------------------------------------------------------

-- listings: ensure PK(id)
DO $$
DECLARE
  has_pk boolean;
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
DECLARE
  has_pk boolean;
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
-- 2) Создаём listing_views (без FK), затем приведём типы под реальные.
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listing_views (
  listing_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

-- Полезные индексы (не мешают PK)
CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user    ON listing_views(user_id);

----------------------------------------------------------------------
-- 3) Приведём типы listing_views.listing_id/user_id к типам listings.id/users.id
----------------------------------------------------------------------

DO $$
DECLARE
  t_listings_id text;
  t_users_id    text;
BEGIN
  SELECT a.atttypid::regtype::text
    INTO t_listings_id
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname = 'listings'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

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
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF t_users_id IS NULL THEN
    RAISE EXCEPTION 'Column users.id not found';
  END IF;

  -- Приводим типы в listing_views к точным типам целевых PK
  EXECUTE format(
    'ALTER TABLE listing_views ALTER COLUMN listing_id TYPE %I USING listing_id::%I',
    t_listings_id, t_listings_id
  );
  EXECUTE format(
    'ALTER TABLE listing_views ALTER COLUMN user_id TYPE %I USING user_id::%I',
    t_users_id, t_users_id
  );
END$$;

----------------------------------------------------------------------
-- 4) Добавим внешние ключи, ТОЛЬКО если их ещё нет
----------------------------------------------------------------------

-- FK -> listings(id)
DO $$
DECLARE
  has_fk boolean;
BEGIN
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
END$$;

-- FK -> users(id)
DO $$
DECLARE
  has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
     WHERE n.nspname = current_schema()
       AND rel.relname = 'listing_views'
       AND con.contype = 'f'
       AND con.conname = 'listing_views_user_id_fkey'
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
-- 5) Счётчик просмотров
----------------------------------------------------------------------

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

ALTER TABLE listings
  ALTER COLUMN view_count SET DEFAULT 0;

-- Гарантия отсутствия NULL
UPDATE listings
   SET view_count = 0
 WHERE view_count IS NULL;

----------------------------------------------------------------------
-- 6) Бэкфилл (уникальные просмотры per user)
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
