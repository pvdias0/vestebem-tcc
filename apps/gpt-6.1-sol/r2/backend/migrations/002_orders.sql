CREATE TABLE roles (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('cliente','funcionario')));
INSERT INTO roles SELECT id, role FROM users;
CREATE TRIGGER new_user_role AFTER INSERT ON users BEGIN INSERT INTO roles VALUES(NEW.id,'cliente'); END;
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), status TEXT NOT NULL DEFAULT 'recebido' CHECK(status IN ('recebido','em preparação','enviado','cancelado')), total_cents INTEGER NOT NULL CHECK(total_cents>=0), demo_key TEXT UNIQUE);
CREATE INDEX orders_customer ON orders(customer_id);
CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 200), quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity>0), unit_price_cents INTEGER NOT NULL CHECK(typeof(unit_price_cents)='integer' AND unit_price_cents>=0));
