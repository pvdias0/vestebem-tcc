CREATE TABLE customer_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cpf TEXT CHECK(cpf IS NULL OR (length(cpf)=11 AND cpf NOT GLOB '*[^0-9]*')),
  phone TEXT CHECK(phone IS NULL OR (length(phone) BETWEEN 10 AND 11 AND phone NOT GLOB '*[^0-9]*'))
);
CREATE TABLE addresses (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL CHECK(length(trim(recipient)) BETWEEN 2 AND 100),
  postal_code TEXT NOT NULL CHECK(length(postal_code)=8 AND postal_code NOT GLOB '*[^0-9]*'),
  street TEXT NOT NULL CHECK(length(trim(street)) BETWEEN 1 AND 200),
  number TEXT NOT NULL CHECK(length(trim(number)) BETWEEN 1 AND 30),
  complement TEXT NOT NULL DEFAULT '' CHECK(length(complement)<=100),
  district TEXT NOT NULL CHECK(length(trim(district)) BETWEEN 1 AND 100),
  city TEXT NOT NULL CHECK(length(trim(city)) BETWEEN 1 AND 100),
  state TEXT NOT NULL CHECK(state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);
CREATE TABLE order_deliveries (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  phone TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL
);
