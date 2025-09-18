-- Ensure listings.source_id can be used for UPSERT operations
-- Normalize blank source identifiers
UPDATE listings
SET source_id = NULL
WHERE source_id IS NOT NULL AND btrim(source_id) = '';

-- Remove duplicate source_ids keeping the most recent record
DELETE FROM listings l
USING listings dup
WHERE l.id < dup.id
  AND l.source_id IS NOT NULL
  AND dup.source_id IS NOT NULL
  AND l.source_id = dup.source_id;

-- Enforce uniqueness required for ON CONFLICT clauses
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_source_id
  ON listings (source_id);
