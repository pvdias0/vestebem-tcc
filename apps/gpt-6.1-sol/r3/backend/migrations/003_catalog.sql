CREATE TABLE products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 5000),
 category TEXT NOT NULL CHECK(length(category) BETWEEN 1 AND 80),
 size TEXT NOT NULL CHECK(length(size) BETWEEN 1 AND 30),
 price_cents INTEGER NOT NULL CHECK(typeof(price_cents)='integer' AND price_cents BETWEEN 0 AND 100000000),
 stock INTEGER NOT NULL CHECK(typeof(stock)='integer' AND stock BETWEEN 0 AND 1000000000),
 demo_key TEXT UNIQUE
);
CREATE INDEX products_category_size ON products(category,size);
CREATE INDEX products_price ON products(price_cents);
ALTER TABLE order_items ADD COLUMN product_id INTEGER REFERENCES products(id);
