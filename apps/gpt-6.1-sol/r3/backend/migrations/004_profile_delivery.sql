ALTER TABLE users ADD COLUMN cpf TEXT CHECK(cpf IS NULL OR (length(cpf)=11 AND cpf NOT GLOB '*[^0-9]*'));
ALTER TABLE users ADD COLUMN phone TEXT CHECK(phone IS NULL OR (length(phone) BETWEEN 10 AND 11 AND phone NOT GLOB '*[^0-9]*'));
ALTER TABLE users ADD COLUMN delivery_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE addresses (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL CHECK(length(recipient) BETWEEN 2 AND 100),
 postal_code TEXT NOT NULL CHECK(length(postal_code)=8 AND postal_code NOT GLOB '*[^0-9]*'),
 street TEXT NOT NULL CHECK(length(street) BETWEEN 1 AND 200),
 number TEXT NOT NULL CHECK(length(number) BETWEEN 1 AND 30),
 complement TEXT NOT NULL DEFAULT '' CHECK(length(complement)<=100),
 neighborhood TEXT NOT NULL CHECK(length(neighborhood) BETWEEN 1 AND 100),
 city TEXT NOT NULL CHECK(length(city) BETWEEN 1 AND 100),
 state TEXT NOT NULL CHECK(state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);
CREATE TABLE order_delivery (
 order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL,
 phone TEXT NOT NULL,
 postal_code TEXT NOT NULL,
 street TEXT NOT NULL,
 number TEXT NOT NULL,
 complement TEXT NOT NULL,
 neighborhood TEXT NOT NULL,
 city TEXT NOT NULL,
 state TEXT NOT NULL
);
CREATE TABLE demo_profile_seeds (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);
