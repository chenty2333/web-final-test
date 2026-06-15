PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  monthly_limit_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  account_name TEXT NOT NULL DEFAULT '星芒钱包',
  scene TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saving_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL DEFAULT 0,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  cadence TEXT NOT NULL,
  next_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON ledger_entries(user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_entries_user_category ON ledger_entries(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON saving_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, monthly_limit_cents, sort_order, created_at) VALUES
  ('cat_food', NULL, '餐饮', 'utensils', '#10a99a', 140000, 10, datetime('now')),
  ('cat_commute', NULL, '交通', 'train-front', '#25a4e0', 65000, 20, datetime('now')),
  ('cat_learning', NULL, '学习资料', 'book-open', '#f6b73c', 80000, 30, datetime('now')),
  ('cat_shopping', NULL, '购物', 'shopping-bag', '#ee4056', 120000, 40, datetime('now')),
  ('cat_living', NULL, '生活日用', 'home', '#6f7ddf', 90000, 50, datetime('now')),
  ('cat_income', NULL, '收入', 'wallet-cards', '#1cbe70', 0, 60, datetime('now'));
