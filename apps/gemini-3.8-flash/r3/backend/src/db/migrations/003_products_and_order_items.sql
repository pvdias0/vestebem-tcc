-- Migration 003: Create products table and add product_id, product_name to order_items

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    size TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Evolve order_items table to store product_id and product_name
-- In SQLite, we can add nullable columns without rewriting the table
ALTER TABLE order_items ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN product_name TEXT;
