-- Starry Campus Ledger database schema and seed reference.
-- The Flask app creates and seeds the same structure automatically on startup.

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(80) NOT NULL UNIQUE,
    nickname VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(40) NOT NULL,
    icon VARCHAR(8) NOT NULL,
    color VARCHAR(20) NOT NULL,
    monthly_limit NUMERIC(10, 2) NOT NULL,
    sort_order INTEGER NOT NULL,
    is_public BOOLEAN NOT NULL
);

CREATE TABLE entry_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind VARCHAR(16) NOT NULL,
    name VARCHAR(40) NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    title VARCHAR(120) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    kind VARCHAR(12) NOT NULL,
    scene VARCHAR(40) NOT NULL,
    mood VARCHAR(20) NOT NULL,
    spent_at DATETIME NOT NULL,
    note VARCHAR(240) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE saving_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(10, 2) NOT NULL,
    saved_amount NUMERIC(10, 2) NOT NULL,
    deadline VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE saving_goal_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES saving_goals(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    deposited_at DATETIME NOT NULL,
    note VARCHAR(160) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(120) NOT NULL,
    content VARCHAR(1200) NOT NULL,
    topic VARCHAR(40) NOT NULL,
    likes_count INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES community_posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_entry_options_user_kind ON entry_options(user_id, kind);
CREATE INDEX idx_entries_user_date ON ledger_entries(user_id, spent_at);
CREATE INDEX idx_entries_user_category ON ledger_entries(user_id, category_id);
CREATE INDEX idx_goals_user ON saving_goals(user_id);
CREATE INDEX idx_goal_deposits_user_goal ON saving_goal_deposits(user_id, goal_id);
CREATE INDEX idx_community_posts_created ON community_posts(created_at);
CREATE INDEX idx_community_comments_post ON community_comments(post_id);
