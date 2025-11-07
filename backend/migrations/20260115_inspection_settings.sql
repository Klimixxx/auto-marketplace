CREATE TABLE IF NOT EXISTS inspection_settings (
  settings_key TEXT PRIMARY KEY,
  price NUMERIC(12, 2) NOT NULL DEFAULT 12000,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO inspection_settings (settings_key, price)
SELECT 'default', 12000
WHERE NOT EXISTS (
  SELECT 1 FROM inspection_settings WHERE settings_key = 'default'
);
