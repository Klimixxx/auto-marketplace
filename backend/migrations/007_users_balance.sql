-- 007_users_balance.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0;
