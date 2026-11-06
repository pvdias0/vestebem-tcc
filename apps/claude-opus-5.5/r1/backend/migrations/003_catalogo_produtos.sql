-- Etapa 3: catálogo de produtos e vínculo (opcional) entre itens de pedido e produtos.

CREATE TABLE produtos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT    NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
  descricao       TEXT    NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
  categoria       TEXT    NOT NULL CHECK (length(trim(categoria)) BETWEEN 1 AND 50),
  tamanho         TEXT    NOT NULL CHECK (length(trim(tamanho)) BETWEEN 1 AND 20),
  preco_centavos  INTEGER NOT NULL CHECK (typeof(preco_centavos) = 'integer' AND preco_centavos >= 0),
  estoque         INTEGER NOT NULL CHECK (typeof(estoque) = 'integer' AND estoque >= 0),
  criado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_produtos_categoria ON produtos(categoria);
CREATE INDEX idx_produtos_tamanho ON produtos(tamanho);
CREATE INDEX idx_produtos_preco ON produtos(preco_centavos);

-- Itens existentes ficam com produto_id NULL (pedidos anteriores ao catálogo).
-- Nome (coluna "descricao") e preço unitário continuam gravados no item como cópia do momento da compra.
ALTER TABLE itens_pedido ADD COLUMN produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL;
CREATE INDEX idx_itens_produto ON itens_pedido(produto_id);
