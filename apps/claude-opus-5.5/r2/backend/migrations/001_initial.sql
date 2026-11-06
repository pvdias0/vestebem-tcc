-- 001: estrutura inicial — usuários (clientes) e sessões de login
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email         TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT    NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT    NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
