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
    name VARCHAR(40) NOT NULL UNIQUE,
    icon VARCHAR(8) NOT NULL,
    color VARCHAR(20) NOT NULL,
    monthly_limit NUMERIC(10, 2) NOT NULL,
    sort_order INTEGER NOT NULL,
    is_public BOOLEAN NOT NULL
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

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_entries_user_date ON ledger_entries(user_id, spent_at);
CREATE INDEX idx_entries_user_category ON ledger_entries(user_id, category_id);
CREATE INDEX idx_goals_user ON saving_goals(user_id);
