PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL DEFAULT 'Player',
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
  free_spins INTEGER NOT NULL DEFAULT 0 CHECK(free_spins >= 0),
  premium_pass INTEGER NOT NULL DEFAULT 0,
  referrer_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  price_xtr INTEGER NOT NULL DEFAULT 0 CHECK(price_xtr >= 0),
  is_free INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  max_opens INTEGER,
  opened_count INTEGER NOT NULL DEFAULT 0,
  reserved_opens INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_items (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gift',
  value_stars INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 1 CHECK(weight > 0),
  stock_limit INTEGER,
  awarded_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_case_items_case ON case_items(case_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  order_type TEXT NOT NULL,
  item_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_xtr INTEGER NOT NULL CHECK(amount_xtr > 0),
  payload TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(status, expires_at);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  telegram_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  telegram_payment_charge_id TEXT NOT NULL UNIQUE,
  provider_payment_charge_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  item_id TEXT NOT NULL REFERENCES case_items(id),
  source TEXT NOT NULL DEFAULT 'case',
  status TEXT NOT NULL DEFAULT 'owned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_owner ON inventory(telegram_id, status);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  inventory_id TEXT NOT NULL REFERENCES inventory(id),
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('balance','spins')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL REFERENCES promo_codes(code),
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, telegram_id)
);

CREATE TABLE IF NOT EXISTS event_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL DEFAULT 'battle_pass' CHECK(event_type IN ('battle_pass','advent')),
  title TEXT NOT NULL DEFAULT 'Halloween Pass',
  ends_at TEXT,
  premium_price_xtr INTEGER NOT NULL DEFAULT 666,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO event_settings(id, enabled, event_type, title, ends_at, premium_price_xtr)
VALUES(1, 0, 'battle_pass', 'Halloween Pass', '2026-11-01T00:00:00Z', 666);

CREATE TABLE IF NOT EXISTS event_progress (
  telegram_id TEXT PRIMARY KEY REFERENCES users(telegram_id),
  xp INTEGER NOT NULL DEFAULT 0,
  premium_unlocked INTEGER NOT NULL DEFAULT 0,
  claimed_free_levels TEXT NOT NULL DEFAULT '[]',
  claimed_premium_levels TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS user_quests (
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  quest_id TEXT NOT NULL REFERENCES quests(id),
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id, quest_id)
);
INSERT OR IGNORE INTO quests(id,title,description,target,reward_xp) VALUES
 ('open_1','Первый кейс','Откройте любой кейс',1,25),
 ('open_5','Коллекционер','Откройте 5 кейсов',5,75),
 ('daily_1','Ежедневный подарок','Заберите подарок дня',1,40),
 ('refer_1','Пригласите друга','Пригласите 1 друга',1,100);

CREATE TABLE IF NOT EXISTS live_wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT,
  username TEXT NOT NULL DEFAULT 'Player',
  item_title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  value_stars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id TEXT NOT NULL REFERENCES users(telegram_id),
  referred_id TEXT NOT NULL UNIQUE REFERENCES users(telegram_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_charge_id TEXT NOT NULL UNIQUE,
  referrer_id TEXT NOT NULL REFERENCES users(telegram_id),
  referred_id TEXT NOT NULL REFERENCES users(telegram_id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(telegram_id),
  case_id TEXT NOT NULL REFERENCES cases(id),
  entry_cost INTEGER NOT NULL CHECK(entry_cost >= 0),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','running','finished','cancelled')),
  winner_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS battle_players (
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  score INTEGER NOT NULL DEFAULT 0,
  drop_inventory_id TEXT,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(battle_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings(key,value) VALUES('referral_percent','5');

INSERT OR IGNORE INTO cases(id,title,description,image_url,price_xtr,is_free,active,max_opens,sort_order) VALUES
 ('daily','Подарок дня','Ежедневный подарок после проверки подписки','gift-box.png',0,1,1,NULL,1),
 ('nft-mini','NFT-кейс','Коллекция цифровых подарков','nft-swan.png',39,0,1,NULL,2),
 ('crate-blue','Сапфировый кейс','Сбалансированная подборка предметов','case-blue.png',79,0,1,NULL,3),
 ('crate-orange','Огненный кейс','Редкие предметы из расширенной коллекции','case-orange.png',149,0,1,NULL,4),
 ('legend','Легендарный кейс','Коллекционные предметы высокого уровня','case-orange.png',299,0,1,500,5);

INSERT OR IGNORE INTO case_items(id,case_id,title,image_url,kind,value_stars,weight,stock_limit) VALUES
 ('daily-teddy','daily','Плюшевый мишка','teddy.png','gift',5,52,NULL),
 ('daily-rocket','daily','Rocket','rocket.png','gift',8,30,NULL),
 ('daily-perfume','daily','Perfume Bottle','perfume.png','gift',15,14,NULL),
 ('daily-ring','daily','Blue Ring','ring.png','nft',30,4,NULL),
 ('nft-swan-item','nft-mini','Pink Swan','nft-swan.png','nft',60,52,NULL),
 ('nft-perfume-item','nft-mini','Perfume Bottle','perfume.png','gift',85,28,NULL),
 ('nft-ring-item','nft-mini','Blue Ring','ring.png','nft',140,16,NULL),
 ('nft-rocket-item','nft-mini','Rocket','rocket.png','gift',390,4,NULL),
 ('blue-rocket','crate-blue','Rocket','rocket.png','gift',25,48,NULL),
 ('blue-rifle','crate-blue','Carbon Rifle','rifle.png','skin',90,30,NULL),
 ('blue-ring','crate-blue','Blue Ring','ring.png','nft',190,17,NULL),
 ('blue-perfume','crate-blue','Perfume Bottle','perfume.png','gift',430,5,NULL),
 ('orange-rifle','crate-orange','Carbon Rifle','rifle.png','skin',160,45,NULL),
 ('orange-ring','crate-orange','Blue Ring','ring.png','nft',430,30,NULL),
 ('orange-perfume','crate-orange','Perfume Bottle','perfume.png','gift',850,20,NULL),
 ('orange-swan','crate-orange','Pink Swan','nft-swan.png','nft',1800,5,NULL),
 ('legend-ring','legend','Blue Ring','ring.png','nft',600,55,400),
 ('legend-swan','legend','Pink Swan','nft-swan.png','nft',1800,35,90),
 ('legend-perfume','legend','Perfume Bottle','perfume.png','gift',4200,9,10),
 ('legend-rifle','legend','Carbon Rifle','rifle.png','skin',9500,1,2);

CREATE TABLE IF NOT EXISTS free_daily_claims (
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  claim_date TEXT NOT NULL,
  reward_key TEXT NOT NULL DEFAULT 'daily',
  inventory_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id, claim_date, reward_key)
);

CREATE TABLE IF NOT EXISTS advent_claims (
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 24),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id, day)
);
