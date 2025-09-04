-- Добавить колонку, если её нет
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Сделать пароль необязательным (для логина по телефону/OTP)
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;
