CREATE TABLE IF NOT EXISTS balance_topups (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_topups_user ON balance_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_topups_created ON balance_topups(created_at DESC);
