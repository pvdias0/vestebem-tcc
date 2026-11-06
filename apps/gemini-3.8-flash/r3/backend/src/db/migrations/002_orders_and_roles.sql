-- Migration 002: Add employee role to users, create orders and order_items tables

PRAGMA foreign_keys = OFF;

-- Recreate users table to allow 'employee' role in CHECK constraint
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'employee')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, name, email, password_hash, role, created_at, updated_at)
SELECT id, name, email, password_hash, role, created_at, updated_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

PRAGMA foreign_keys = ON;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'em preparação', 'enviado', 'cancelado')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
