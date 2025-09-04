-- Сделать email nullable (если раньше был NOT NULL)
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

-- Убедиться, что колонка phone есть
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Сделать phone уникальным (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;

