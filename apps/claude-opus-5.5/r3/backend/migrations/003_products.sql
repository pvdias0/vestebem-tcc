-- 003: catálogo de produtos e vínculo opcional dos itens de pedido com produtos.
-- Itens existentes continuam com descrição e preço próprios (product_id fica NULL).

CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category    TEXT    NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 60),
  size        TEXT    NOT NULL CHECK (length(trim(size)) BETWEEN 1 AND 20),
  price_cents INTEGER NOT NULL CHECK (typeof(price_cents) = 'integer' AND price_cents >= 0),
  stock       INTEGER NOT NULL CHECK (typeof(stock) = 'integer' AND stock >= 0),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX products_category_idx ON products(category);
CREATE INDEX products_size_idx ON products(size);
CREATE INDEX products_price_idx ON products(price_cents);

-- description/unit_price_cents dos itens já são o "retrato" no momento da compra.
ALTER TABLE order_items ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX order_items_product_id_idx ON order_items(product_id);
