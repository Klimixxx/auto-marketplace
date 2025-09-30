CREATE TABLE IF NOT EXISTS trade_pricing_tiers (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  max_amount NUMERIC,
  amount NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_pricing_tiers_sort ON trade_pricing_tiers(sort_order, max_amount);

INSERT INTO trade_pricing_tiers (label, max_amount, amount, sort_order, created_at, updated_at)
SELECT label, max_amount, amount, sort_order, now(), now()
FROM (
  VALUES
    ('Лот до 500 000 ₽', 500000, 15000, 10),
    ('Лот до 1 500 000 ₽', 1500000, 25000, 20),
    ('Лот до 3 000 000 ₽', 3000000, 35000, 30),
    ('Лот свыше 3 000 000 ₽', NULL, 50000, 40)
) AS defaults(label, max_amount, amount, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM trade_pricing_tiers);
