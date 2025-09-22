-- Enrich listings table with additional vehicle metadata and featured flag
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS trade_type TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS production_year TEXT,
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_price NUMERIC,
  ADD COLUMN IF NOT EXISTS max_price NUMERIC,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE listings
  ALTER COLUMN photos SET DEFAULT '[]'::jsonb,
  ALTER COLUMN published SET DEFAULT false;

-- Backfill the new columns from existing JSON payloads where possible
UPDATE listings
SET
  brand = COALESCE(brand, details ->> 'brand', details -> 'lot_details' ->> 'brand'),
  model = COALESCE(model, details ->> 'model', details -> 'lot_details' ->> 'model'),
  production_year = COALESCE(production_year, details ->> 'year', details -> 'lot_details' ->> 'year', details -> 'lot_details' ->> 'production_year', details -> 'lot_details' ->> 'manufacture_year'),
  vin = COALESCE(vin, details ->> 'vin', details -> 'lot_details' ->> 'vin'),
  city = COALESCE(city, details ->> 'city', details -> 'lot_details' ->> 'city', details -> 'lot_details' ->> 'location'),
  trade_type = COALESCE(
    trade_type,
    details ->> 'trade_type',
    details -> 'lot_details' ->> 'trade_type',
    details -> 'lot_details' ->> 'procedure_type',
    details -> 'lot_details' ->> 'type',
    details -> 'fedresurs_meta' ->> 'procedureType',
    details -> 'fedresurs_meta' ->> 'procedure_type'
  ),
  photos = COALESCE(
    NULLIF(photos, 'null'::jsonb),
    CASE WHEN jsonb_typeof(details -> 'photos') = 'array' THEN details -> 'photos' END,
    CASE WHEN jsonb_typeof(details -> 'lot_details' -> 'photos') = 'array' THEN details -> 'lot_details' -> 'photos' END,
    CASE WHEN jsonb_typeof(details -> 'lot_details' -> 'images') = 'array' THEN details -> 'lot_details' -> 'images' END,
    '[]'::jsonb
  )
WHERE details IS NOT NULL;

UPDATE listings
SET
  min_price = COALESCE(
    min_price,
    (
      CASE
        WHEN details -> 'lot_details' ? 'min_price' THEN
          NULLIF(replace(regexp_replace(details -> 'lot_details' ->> 'min_price', '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
        WHEN details -> 'lot_details' ? 'minimal_price' THEN
          NULLIF(replace(regexp_replace(details -> 'lot_details' ->> 'minimal_price', '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
        ELSE NULL
      END
    )
  ),
  max_price = COALESCE(
    max_price,
    (
      CASE
        WHEN details -> 'lot_details' ? 'max_price' THEN
          NULLIF(replace(regexp_replace(details -> 'lot_details' ->> 'max_price', '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
        WHEN details -> 'lot_details' ? 'maximum_price' THEN
          NULLIF(replace(regexp_replace(details -> 'lot_details' ->> 'maximum_price', '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
        ELSE NULL
      END
    )
  )
WHERE details IS NOT NULL
  AND (min_price IS NULL OR max_price IS NULL);

UPDATE listings
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE published = true AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_published ON listings(published);
CREATE INDEX IF NOT EXISTS idx_listings_trade_type ON listings(trade_type);
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_brand ON listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_is_featured ON listings(is_featured) WHERE is_featured = true;
