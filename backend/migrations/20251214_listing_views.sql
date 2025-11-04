-- Track unique listing views per authenticated user and expose aggregate counters
CREATE TABLE IF NOT EXISTS listing_views (
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

-- Ensure default is enforced even if the column already existed without it
ALTER TABLE listings
  ALTER COLUMN view_count SET DEFAULT 0;

-- Backfill aggregate counters from existing raw view data if present
WITH counters AS (
  SELECT listing_id, COUNT(*)::INT AS c
    FROM listing_views
   GROUP BY listing_id
)
UPDATE listings l
   SET view_count = COALESCE(c.c, 0)
  FROM counters c
 WHERE l.id = c.listing_id;

-- Guarantee no NULL values remain
UPDATE listings
   SET view_count = 0
 WHERE view_count IS NULL;

