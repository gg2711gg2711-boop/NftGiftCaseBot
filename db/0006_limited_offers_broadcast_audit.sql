-- Limited-time offer shop, resumable Telegram broadcasts, and admin audit history.
-- Offer prices use the app's internal credits, not a transfer of Telegram Stars.

CREATE TABLE IF NOT EXISTS limited_offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT 'gift-box.png',
  price_credits INTEGER NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  max_purchases INTEGER CHECK (max_purchases IS NULL OR max_purchases >= 1),
  per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit >= 1),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  reward_item_id TEXT REFERENCES case_items(id),
  reward_credits INTEGER NOT NULL DEFAULT 0 CHECK (reward_credits >= 0),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (reward_item_id IS NOT NULL OR reward_credits > 0)
);
CREATE INDEX IF NOT EXISTS idx_limited_offers_active_dates ON limited_offers(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_limited_offers_created ON limited_offers(created_at);

CREATE TABLE IF NOT EXISTS limited_offer_user_counts (
  offer_id TEXT NOT NULL REFERENCES limited_offers(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  purchase_count INTEGER NOT NULL DEFAULT 0 CHECK (purchase_count >= 0),
  PRIMARY KEY (offer_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS limited_offer_purchases (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES limited_offers(id),
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  price_credits INTEGER NOT NULL CHECK (price_credits >= 0),
  reward_item_id TEXT REFERENCES case_items(id),
  reward_credits INTEGER NOT NULL DEFAULT 0 CHECK (reward_credits >= 0),
  inventory_id TEXT REFERENCES inventory(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_player ON limited_offer_purchases(offer_id, telegram_id, created_at);

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id TEXT PRIMARY KEY,
  message_text TEXT NOT NULL,
  with_app_button INTEGER NOT NULL DEFAULT 1 CHECK (with_app_button IN (0,1)),
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','completed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_broadcast_recipients (
  broadcast_id TEXT NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_text TEXT,
  sent_at TEXT,
  PRIMARY KEY (broadcast_id, telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_pending ON admin_broadcast_recipients(broadcast_id, status, telegram_id);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_telegram_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
