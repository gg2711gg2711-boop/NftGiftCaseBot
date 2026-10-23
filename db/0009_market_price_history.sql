-- Real completed internal-market transactions only. Apply once after 0008.
CREATE TABLE IF NOT EXISTS market_price_history (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL UNIQUE REFERENCES market_listings(id),
  item_id TEXT NOT NULL REFERENCES case_items(id),
  inventory_id TEXT NOT NULL,
  background_key TEXT NOT NULL DEFAULT 'default',
  serial_number INTEGER,
  seller_id TEXT NOT NULL REFERENCES users(telegram_id),
  buyer_id TEXT NOT NULL REFERENCES users(telegram_id),
  price_credits INTEGER NOT NULL CHECK(price_credits > 0),
  fee_credits INTEGER NOT NULL DEFAULT 0 CHECK(fee_credits >= 0),
  sold_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_price_history_item_date ON market_price_history(item_id, background_key, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_price_history_seller ON market_price_history(seller_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_price_history_buyer ON market_price_history(buyer_id, sold_at DESC);

-- Backfill completed market sales that happened before this migration was applied.
INSERT OR IGNORE INTO market_price_history(id,listing_id,item_id,inventory_id,background_key,serial_number,seller_id,buyer_id,price_credits,fee_credits,sold_at)
SELECT lower(hex(randomblob(16))), ml.id, inv.item_id, ml.inventory_id, COALESCE(inv.background_key,'default'), inv.serial_number,
       ml.seller_id, ml.buyer_id, ml.price_credits, COALESCE(ml.fee_credits,0), COALESCE(ml.completed_at,ml.listed_at,CURRENT_TIMESTAMP)
FROM market_listings ml JOIN inventory inv ON inv.id=ml.inventory_id
WHERE ml.status='sold' AND ml.buyer_id IS NOT NULL;
