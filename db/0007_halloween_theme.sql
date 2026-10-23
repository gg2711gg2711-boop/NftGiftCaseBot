-- Persist the app-wide theme selected by the administrator.
-- Supported values are 'normal' and 'halloween'.
CREATE TABLE IF NOT EXISTS app_theme_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL DEFAULT 'normal' CHECK (theme IN ('normal', 'halloween')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

INSERT OR IGNORE INTO app_theme_settings (id, theme, updated_at)
VALUES (1, 'normal', CURRENT_TIMESTAMP);
