CREATE TABLE users_v2 (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(email) <= 254),
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','employee')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users_v2 SELECT * FROM users;
CREATE TABLE sessions_v2 (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users_v2(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
INSERT INTO sessions_v2 SELECT * FROM sessions;
DROP TABLE sessions;
DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;
ALTER TABLE sessions_v2 RENAME TO sessions;
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','preparing','sent','cancelled')),
 total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents BETWEEN 0 AND 100000000000),
 demo_key TEXT UNIQUE
);
CREATE INDEX orders_customer ON orders(customer_id);
CREATE TABLE order_items (
 id INTEGER PRIMARY KEY,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 200),
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity BETWEEN 1 AND 10000),
 unit_price_cents INTEGER NOT NULL CHECK(typeof(unit_price_cents)='integer' AND unit_price_cents BETWEEN 0 AND 100000000)
);
CREATE INDEX order_items_order ON order_items(order_id);
