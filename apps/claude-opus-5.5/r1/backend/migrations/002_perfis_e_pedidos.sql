-- Etapa 2: perfil "funcionario" e pedidos.
-- O runner desativa foreign_keys durante as migrations e roda foreign_key_check no fim,
-- seguindo o procedimento oficial do SQLite para recriar tabelas sem perder registros.

-- 1) Recria "usuarios" para ampliar o CHECK de perfil, preservando todos os dados.
CREATE TABLE usuarios_novo (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 100),
  email         TEXT    NOT NULL COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  senha_hash    TEXT    NOT NULL,
  perfil        TEXT    NOT NULL DEFAULT 'cliente' CHECK (perfil IN ('cliente', 'funcionario')),
  criado_em     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT usuarios_email_unico UNIQUE (email)
);
INSERT INTO usuarios_novo (id, nome, email, senha_hash, perfil, criado_em)
  SELECT id, nome, email, senha_hash, perfil, criado_em FROM usuarios;
DROP TABLE usuarios;
ALTER TABLE usuarios_novo RENAME TO usuarios;

-- 2) Pedidos. Valores monetários em centavos (inteiros) para evitar erros de arredondamento.
CREATE TABLE pedidos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  status          TEXT    NOT NULL DEFAULT 'recebido'
                  CHECK (status IN ('recebido', 'em_preparacao', 'enviado', 'cancelado')),
  total_centavos  INTEGER NOT NULL CHECK (total_centavos >= 0),
  criado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);

CREATE TABLE itens_pedido (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id                INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  descricao                TEXT    NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 200),
  quantidade               INTEGER NOT NULL CHECK (typeof(quantidade) = 'integer' AND quantidade > 0),
  preco_unitario_centavos  INTEGER NOT NULL CHECK (typeof(preco_unitario_centavos) = 'integer' AND preco_unitario_centavos >= 0)
);
CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);
