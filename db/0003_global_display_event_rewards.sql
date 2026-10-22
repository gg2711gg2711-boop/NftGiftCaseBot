-- Global announcement/countdown and per-level event reward configuration.
-- Safe to run more than once.
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
