-- 6-значный код пользователя
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_code CHAR(6);

-- Уникальность
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_code_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_user_code_key UNIQUE (user_code);
  END IF;
END $$;

-- Заполнить код тем, у кого он пустой (с уникальностью)
DO $$
DECLARE
  r RECORD;
  v TEXT;
BEGIN
  FOR r IN SELECT id FROM users WHERE user_code IS NULL LOOP
    LOOP
      v := to_char(100000 + floor(random()*900000)::int, 'FM000000');
      BEGIN
        UPDATE users SET user_code = v WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- коллизия — пробуем снова
      END;
    END LOOP;
  END LOOP;
END $$;
