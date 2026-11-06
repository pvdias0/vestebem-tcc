CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100), email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'cliente' CHECK(role = 'cliente'));
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
