-- Migration 004: Add personal info and address to users, and shipping info to orders

-- Add personal info and address fields to users
ALTER TABLE users ADD COLUMN cpf TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN recipient_name TEXT;
ALTER TABLE users ADD COLUMN cep TEXT;
ALTER TABLE users ADD COLUMN street TEXT;
ALTER TABLE users ADD COLUMN number TEXT;
ALTER TABLE users ADD COLUMN complement TEXT;
ALTER TABLE users ADD COLUMN neighborhood TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN state TEXT;

-- Add shipping snapshot fields to orders
ALTER TABLE orders ADD COLUMN shipping_recipient TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_cep TEXT;
ALTER TABLE orders ADD COLUMN shipping_street TEXT;
ALTER TABLE orders ADD COLUMN shipping_number TEXT;
ALTER TABLE orders ADD COLUMN shipping_complement TEXT;
ALTER TABLE orders ADD COLUMN shipping_neighborhood TEXT;
ALTER TABLE orders ADD COLUMN shipping_city TEXT;
ALTER TABLE orders ADD COLUMN shipping_state TEXT;
