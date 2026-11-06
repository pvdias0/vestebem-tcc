-- 004: dados pessoais (CPF, telefone), endereço de entrega e cópia da entrega nos pedidos.
-- Só acrescenta colunas/tabelas: registros existentes são preservados. Pedidos antigos
-- ficam com as colunas shipping_* nulas ("sem informações de entrega registradas").

-- CPF e telefone guardados apenas com dígitos; ambos opcionais na conta.
ALTER TABLE users ADD COLUMN cpf TEXT CHECK (cpf IS NULL OR (length(cpf) = 11 AND cpf NOT GLOB '*[^0-9]*'));
ALTER TABLE users ADD COLUMN phone TEXT CHECK (phone IS NULL OR (length(phone) BETWEEN 10 AND 11 AND phone NOT GLOB '*[^0-9]*'));
CREATE UNIQUE INDEX idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;

-- Um endereço de entrega por usuário.
CREATE TABLE addresses (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recipient   TEXT NOT NULL CHECK (length(trim(recipient)) BETWEEN 1 AND 100),
  cep         TEXT NOT NULL CHECK (length(cep) = 8 AND cep NOT GLOB '*[^0-9]*'),
  street      TEXT NOT NULL CHECK (length(trim(street)) BETWEEN 1 AND 150),
  number      TEXT NOT NULL CHECK (length(trim(number)) BETWEEN 1 AND 20),
  complement  TEXT NOT NULL DEFAULT '' CHECK (length(complement) <= 100),
  district    TEXT NOT NULL CHECK (length(trim(district)) BETWEEN 1 AND 100),
  city        TEXT NOT NULL CHECK (length(trim(city)) BETWEEN 1 AND 100),
  state       TEXT NOT NULL CHECK (state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Cópia (snapshot) dos dados de entrega usados no pedido.
ALTER TABLE orders ADD COLUMN shipping_recipient  TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone      TEXT;
ALTER TABLE orders ADD COLUMN shipping_cep        TEXT;
ALTER TABLE orders ADD COLUMN shipping_street     TEXT;
ALTER TABLE orders ADD COLUMN shipping_number     TEXT;
ALTER TABLE orders ADD COLUMN shipping_complement TEXT;
ALTER TABLE orders ADD COLUMN shipping_district   TEXT;
ALTER TABLE orders ADD COLUMN shipping_city       TEXT;
ALTER TABLE orders ADD COLUMN shipping_state      TEXT;
