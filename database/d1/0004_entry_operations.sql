CREATE TABLE IF NOT EXISTS entry_review_states (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed')),
  note TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entry_id)
);

CREATE TABLE IF NOT EXISTS saved_entry_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'entries',
  query TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'all',
  account_name TEXT NOT NULL DEFAULT '全部账户',
  category_name TEXT NOT NULL DEFAULT '全部分类',
  from_date TEXT NOT NULL DEFAULT '',
  to_date TEXT NOT NULL DEFAULT '',
  min_amount_cents INTEGER NOT NULL DEFAULT 0,
  max_amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_reviews_user ON entry_review_states(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_entry_filters_user ON saved_entry_filters(user_id, scope, updated_at DESC);
