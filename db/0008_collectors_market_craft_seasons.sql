-- GiftCase collector systems: marketplace, craft traits/serials, public showcases and seasonal collections.
-- Apply this once after migrations 0001-0007 have completed successfully.

ALTER TABLE inventory ADD COLUMN background_key TEXT NOT NULL DEFAULT 'default';
ALTER TABLE inventory ADD COLUMN serial_number INTEGER;
ALTER TABLE inventory ADD COLUMN collection_id TEXT;
ALTER TABLE inventory ADD COLUMN sale_batch_id TEXT;
ALTER TABLE inventory ADD COLUMN craft_batch_id TEXT;

-- Existing inventory records receive stable per-item serial numbers.
UPDATE inventory AS inv
SET serial_number = (
  SELECT COUNT(*) FROM inventory AS older
  WHERE older.item_id = inv.item_id
    AND (older.created_at < inv.created_at OR (older.created_at = inv.created_at AND older.id <= inv.id))
)
WHERE inv.serial_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_serial ON inventory(item_id, serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_sale_batch ON inventory(sale_batch_id) WHERE sale_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_owner_status_item ON inventory(telegram_id, status, item_id);

CREATE TABLE IF NOT EXISTS item_serial_counters (
  item_id TEXT PRIMARY KEY REFERENCES case_items(id) ON DELETE CASCADE,
  next_serial INTEGER NOT NULL DEFAULT 0 CHECK(next_serial >= 0)
);
INSERT INTO item_serial_counters(item_id, next_serial)
SELECT item_id, MAX(serial_number) FROM inventory WHERE serial_number IS NOT NULL GROUP BY item_id
ON CONFLICT(item_id) DO UPDATE SET next_serial=MAX(item_serial_counters.next_serial, excluded.next_serial);

CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL REFERENCES inventory(id),
  seller_id TEXT NOT NULL REFERENCES users(telegram_id),
  buyer_id TEXT REFERENCES users(telegram_id),
  price_credits INTEGER NOT NULL CHECK(price_credits > 0),
  fee_credits INTEGER NOT NULL DEFAULT 0 CHECK(fee_credits >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','processing','sold','cancelled')),
  listed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_one_live_listing ON market_listings(inventory_id) WHERE status IN ('active','processing');
CREATE INDEX IF NOT EXISTS idx_market_status_date ON market_listings(status, listed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id, status);

CREATE TABLE IF NOT EXISTS craft_log (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  item_id TEXT NOT NULL REFERENCES case_items(id),
  input_inventory_ids TEXT NOT NULL,
  output_inventory_id TEXT NOT NULL REFERENCES inventory(id),
  background_key TEXT NOT NULL,
  serial_number INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_craft_log_player ON craft_log(telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seasonal_collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT 'case-halloween.png',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reward_title TEXT NOT NULL DEFAULT 'Коллекционер',
  reward_frame_key TEXT NOT NULL DEFAULT 'default',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_seasonal_collections_active_dates ON seasonal_collections(active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS seasonal_collection_items (
  collection_id TEXT NOT NULL REFERENCES seasonal_collections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES case_items(id) ON DELETE CASCADE,
  is_secret INTEGER NOT NULL DEFAULT 0 CHECK(is_secret IN (0,1)),
  is_required INTEGER NOT NULL DEFAULT 1 CHECK(is_required IN (0,1)),
  PRIMARY KEY(collection_id, item_id)
);

CREATE TABLE IF NOT EXISTS user_collection_rewards (
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES seasonal_collections(id) ON DELETE CASCADE,
  reward_title TEXT NOT NULL,
  reward_frame_key TEXT NOT NULL DEFAULT 'default',
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id, collection_id)
);

CREATE TABLE IF NOT EXISTS user_showcases (
  telegram_id TEXT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  showcase_title TEXT NOT NULL DEFAULT 'Коллекционер',
  frame_key TEXT NOT NULL DEFAULT 'default',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_showcase_items (
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id, inventory_id)
);
CREATE INDEX IF NOT EXISTS idx_user_showcase_order ON user_showcase_items(telegram_id, sort_order);

-- Starter Halloween collection. The secret item is optional; the four regular items determine completion.
INSERT OR IGNORE INTO seasonal_collections(
  id,title,description,image_url,starts_at,ends_at,reward_title,reward_frame_key,active,created_by
) VALUES(
  'halloween-2026','Halloween: Проклятая коллекция',
  'Собери сезонные предметы, открой секретную находку и получи титул Cursed King.',
  'case-halloween.png','2026-10-23T00:00:00.000Z','2026-11-07T00:00:00.000Z',
  '☠️ Cursed King','halloween-gold',1,'system'
);
INSERT OR IGNORE INTO seasonal_collection_items(collection_id,item_id,is_secret,is_required)
SELECT 'halloween-2026', id, 0, 1 FROM case_items
WHERE id IN ('orange-ring','orange-perfume','orange-swan','legend-perfume');
INSERT OR IGNORE INTO seasonal_collection_items(collection_id,item_id,is_secret,is_required)
SELECT 'halloween-2026', id, 1, 0 FROM case_items WHERE id='legend-rifle';
