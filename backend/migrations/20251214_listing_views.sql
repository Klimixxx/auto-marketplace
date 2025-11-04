-- 20251214_listing_views.sql
-- Track unique listing views per authenticated user and expose aggregate counters

BEGIN;

----------------------------------------------------------------------
-- 1) БЕЗОПАСНО: убедимся, что в listings.id и users.id есть уникальность
--    (PRIMARY KEY или хотя бы UNIQUE). Если уже есть — блоки просто «проглотят» ошибку.
----------------------------------------------------------------------

-- listings: требуем уникальность id
DO $$
BEGIN
  -- попробуем добавить PRIMARY KEY
  EXECUTE 'ALTER TABLE listings ADD CONSTRAINT listings_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_table THEN RAISE; -- таблицы нет — пусть валится явно
  WHEN duplicate_object THEN
    -- PK уже есть или конфликт по имени. Попробуем хотя бы UNIQUE (на случай отсутствия PK).
    BEGIN
      EXECUTE 'ALTER TABLE listings ADD CONSTRAINT listings_id_key UNIQUE (id)';
    EXCEPTION
      WHEN duplicate_object THEN
        -- уже есть UNIQUE/PK — ничего не делаем
        NULL;
    END;
END$$;

-- users: требуем уникальность id
DO $$
BEGIN
  EXECUTE 'ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_table THEN RAISE;
  WHEN duplicate_object THEN
    BEGIN
      EXECUTE 'ALTER TABLE users ADD CONSTRAINT users_id_key UNIQUE (id)';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
END$$;

----------------------------------------------------------------------
-- 2) Создаём таблицу listing_views (пока БЕЗ внешних ключей),
--    используем широкие типы, затем подгоним под реальные.
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listing_views (
  listing_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

-- Индексы для ускорения джойнов/агрегаций (не мешают PK)
CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user    ON listing_views(user_id);

----------------------------------------------------------------------
-- 3) Подгоним ТИПЫ listing_views.* под ФАКТИЧЕСКИЕ типы listings.id и users.id
--    (если они не BIGINT). Это устраняет причину "foreign key ... cannot be implemented".
----------------------------------------------------------------------

DO $$
DECLARE
  t_listings_id text;
  t_users_id    text;
BEGIN
  SELECT a.atttypid::regtype::text
    INTO t_listings_id
  FROM   pg_attribute a
  JOIN   pg_class c ON c.oid = a.attrelid
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = current_schema()
    AND  c.relname = 'listings'
    AND  a.attname = 'id'
    AND  a.attnum > 0
    AND  NOT a.attisdropped;

  IF t_listings_id IS NULL THEN
    RAISE EXCEPTION 'Column listings.id not found';
  END IF;

  SELECT a.atttypid::regtype::text
    INTO t_users_id
  FROM   pg_attribute a
  JOIN   pg_class c ON c.oid = a.attrelid
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = current_schema()
    AND  c.relname = 'users'
    AND  a.attname = 'id'
    AND  a.attnum > 0
    AND  NOT a.attisdropped;

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
-- 4) Теперь добавим ВНЕШНИЕ КЛЮЧИ (типы уже совпадают)
----------------------------------------------------------------------

DO $$
BEGIN
  EXECUTE '
    ALTER TABLE listing_views
      ADD CONSTRAINT listing_views_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  ';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  EXECUTE '
    ALTER TABLE listing_views
      ADD CONSTRAINT listing_views_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

----------------------------------------------------------------------
-- 5) Колонка-счётчик и дефолты
----------------------------------------------------------------------

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

-- На случай, если колонка существовала без DEFAULT
ALTER TABLE listings
  ALTER COLUMN view_count SET DEFAULT 0;

-- Гарантия отсутствия NULL
UPDATE listings
   SET view_count = 0
 WHERE view_count IS NULL;

----------------------------------------------------------------------
-- 6) Бэкфилл агрегатов по уже имеющимся данным (уникальные просмотры)
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
