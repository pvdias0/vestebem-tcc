-- Etapa 4: dados pessoais (CPF, telefone), endereço de entrega e cópia da entrega nos pedidos.
-- Somente ADD COLUMN / CREATE: nenhum registro existente é apagado ou alterado.

-- CPF e telefone guardados só com dígitos; opcionais (contas antigas não os possuem).
ALTER TABLE usuarios ADD COLUMN cpf TEXT CHECK (cpf IS NULL OR (length(cpf) = 11 AND cpf NOT GLOB '*[^0-9]*'));
ALTER TABLE usuarios ADD COLUMN telefone TEXT CHECK (telefone IS NULL OR (length(telefone) BETWEEN 10 AND 11 AND telefone NOT GLOB '*[^0-9]*'));
CREATE UNIQUE INDEX idx_usuarios_cpf ON usuarios(cpf) WHERE cpf IS NOT NULL;

-- Um endereço de entrega por usuário (chave primária = usuario_id).
CREATE TABLE enderecos (
  usuario_id    INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario  TEXT NOT NULL CHECK (length(trim(destinatario)) BETWEEN 1 AND 100),
  cep           TEXT NOT NULL CHECK (length(cep) = 8 AND cep NOT GLOB '*[^0-9]*'),
  logradouro    TEXT NOT NULL CHECK (length(trim(logradouro)) BETWEEN 1 AND 150),
  numero        TEXT NOT NULL CHECK (length(trim(numero)) BETWEEN 1 AND 20),
  complemento   TEXT CHECK (complemento IS NULL OR length(complemento) <= 100),
  bairro        TEXT NOT NULL CHECK (length(trim(bairro)) BETWEEN 1 AND 100),
  cidade        TEXT NOT NULL CHECK (length(trim(cidade)) BETWEEN 1 AND 100),
  uf            TEXT NOT NULL CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
                                            'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Cópia dos dados de entrega no momento do pedido. NULL = pedido anterior a esta etapa (sem entrega registrada).
ALTER TABLE pedidos ADD COLUMN entrega_destinatario TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_telefone     TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_cep          TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_logradouro   TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_numero       TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_complemento  TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_bairro       TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_cidade       TEXT;
ALTER TABLE pedidos ADD COLUMN entrega_uf           TEXT;
