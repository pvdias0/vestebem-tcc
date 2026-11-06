-- 003: catálogo de produtos e vínculo (opcional) dos itens de pedido com produtos.
-- Não remove nem altera dados existentes: itens antigos ficam com product_id NULL e
-- mantêm a descrição e o preço originais.
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category    TEXT    NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 60),
  size        TEXT    NOT NULL CHECK (length(trim(size)) BETWEEN 1 AND 20),
  price_cents INTEGER NOT NULL CHECK (typeof(price_cents) = 'integer' AND price_cents >= 0),
  stock       INTEGER NOT NULL CHECK (typeof(stock) = 'integer' AND stock >= 0),
  -- Colunas derivadas, mantidas pela aplicação: texto normalizado (minúsculas, sem acentos)
  -- para pesquisa e ordenação independentes de acentuação/maiúsculas.
  search_text TEXT    NOT NULL DEFAULT '',
  sort_name   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_size ON products(size);
CREATE INDEX idx_products_price ON products(price_cents);
CREATE INDEX idx_products_sort_name ON products(sort_name);

-- Itens de pedido passam a guardar o produto de origem. "description" continua sendo o
-- nome do produto no momento da compra e "unit_price_cents" o preço praticado (snapshot).
ALTER TABLE order_items ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
