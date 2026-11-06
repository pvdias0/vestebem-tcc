-- 002: perfil "funcionario" e pedidos com itens.
-- O SQLite não altera CHECK existente: a tabela users é recriada preservando os dados
-- (o executor de migrations desliga foreign_keys durante a migration e valida ao final).

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email         TEXT    NOT NULL COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'funcionario')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT users_email_unique UNIQUE (email)
);
INSERT INTO users_new (id, name, email, password_hash, role, created_at)
  SELECT id, name, email, password_hash, role, created_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status       TEXT    NOT NULL DEFAULT 'recebido'
               CHECK (status IN ('recebido', 'em_preparacao', 'enviado', 'cancelado')),
  total_cents  INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX orders_customer_id_idx ON orders(customer_id);

CREATE TABLE order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL CHECK (position >= 1),
  description      TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 200),
  quantity         INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (typeof(unit_price_cents) = 'integer' AND unit_price_cents >= 0),
  UNIQUE (order_id, position)
);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
