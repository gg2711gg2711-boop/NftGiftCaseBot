-- Admin withdrawals, global rewards and subscription verification cache.
-- Idempotent: safe to apply even if the previous global-display migration was missed.
CREATE TABLE IF NOT EXISTS global_display_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message_enabled INTEGER NOT NULL DEFAULT 0,
  message_title TEXT NOT NULL DEFAULT 'Новости NftGiftCase',
  message_body TEXT NOT NULL DEFAULT '',
  timer_enabled INTEGER NOT NULL DEFAULT 0,
  timer_title TEXT NOT NULL DEFAULT 'До завершения события',
  timer_ends_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO global_display_settings(id, message_enabled, message_title, message_body, timer_enabled, timer_title, timer_ends_at)
VALUES (1, 0, 'Новости NftGiftCase', '', 0, 'До завершения события', NULL);

CREATE TABLE IF NOT EXISTS event_rewards (
  event_type TEXT NOT NULL CHECK (event_type IN ('battle_pass','advent')),
  branch TEXT NOT NULL CHECK (branch IN ('free','premium','advent')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  item_id TEXT NOT NULL REFERENCES case_items(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_type, branch, level),
  CHECK ((event_type = 'advent' AND branch = 'advent' AND level <= 24) OR
         (event_type = 'battle_pass' AND branch IN ('free','premium')))
);

-- These are internal NftGiftCase credits displayed with a star symbol, not actual Telegram Stars transfers.
CREATE TABLE IF NOT EXISTS event_star_rewards (
  event_type TEXT NOT NULL CHECK (event_type IN ('battle_pass','advent')),
  branch TEXT NOT NULL CHECK (branch IN ('free','premium','advent')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 1000000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_type, branch, level),
  CHECK ((event_type = 'advent' AND branch = 'advent' AND level <= 24) OR
         (event_type = 'battle_pass' AND branch IN ('free','premium')))
);

CREATE TABLE IF NOT EXISTS subscription_status_cache (
  telegram_id TEXT PRIMARY KEY,
  is_subscribed INTEGER NOT NULL CHECK (is_subscribed IN (0,1)),
  checked_at TEXT NOT NULL
);


-- Define what advances each editable quest; newly created quests can choose their trigger.
CREATE TABLE IF NOT EXISTS quest_trigger_rules (
  quest_id TEXT PRIMARY KEY REFERENCES quests(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('case_open','daily_claim','referral','manual'))
);
INSERT OR IGNORE INTO quest_trigger_rules(quest_id,trigger_event) VALUES
 ('open_1','case_open'),('open_5','case_open'),('daily_1','daily_claim'),('refer_1','referral');
