CREATE TABLE IF NOT EXISTS trade_pricing_settings (
  settings_key TEXT PRIMARY KEY,
  deposit_percent NUMERIC NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS idx_trade_pricing_tiers_sort;
DROP TABLE IF EXISTS trade_pricing_tiers;

INSERT INTO trade_pricing_settings (settings_key, deposit_percent)
VALUES ('default', 10)
ON CONFLICT (settings_key) DO NOTHING;
