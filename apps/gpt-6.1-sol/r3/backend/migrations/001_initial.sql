CREATE TABLE users (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(email) <= 254),
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer' CHECK(role = 'customer'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
