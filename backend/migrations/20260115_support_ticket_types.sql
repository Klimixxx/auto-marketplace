ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS listing_id INT NULL REFERENCES listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_region TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_listing ON support_tickets(listing_id);

