import { db } from './connection.js';

export function runMigrations(): void {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row: any) => row.name)
  );

  const migrations: Array<{ name: string; up: () => void }> = [
    {
      name: '001_create_users_table',
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
      },
    },
    {
      name: '002_add_employee_role_and_orders',
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'employee')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          INSERT INTO users_new (id, name, email, password_hash, role, created_at, updated_at)
          SELECT id, name, email, password_hash, role, created_at, updated_at FROM users;

          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

          CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL CHECK (total >= 0),
            status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'em preparação', 'enviado', 'cancelado')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

          CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_price REAL NOT NULL CHECK (unit_price >= 0),
            subtotal REAL NOT NULL CHECK (subtotal >= 0),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        `);
      },
    },
    {
      name: '003_create_products_and_update_order_items',
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            size TEXT NOT NULL,
            price REAL NOT NULL CHECK (price >= 0),
            stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
          CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
          CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

          CREATE TABLE IF NOT EXISTS order_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT,
            description TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_price REAL NOT NULL CHECK (unit_price >= 0),
            subtotal REAL NOT NULL CHECK (subtotal >= 0),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
          );

          INSERT INTO order_items_new (id, order_id, product_id, product_name, description, quantity, unit_price, subtotal)
          SELECT id, order_id, NULL, description, description, quantity, unit_price, subtotal FROM order_items;

          DROP TABLE order_items;
          ALTER TABLE order_items_new RENAME TO order_items;
          CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
          CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
        `);
      },
    },
    {
      name: '004_add_profile_address_and_order_delivery',
      up: () => {
        db.exec(`
          -- 1. Adicionar colunas de CPF e telefone na tabela users
          ALTER TABLE users ADD COLUMN cpf TEXT;
          ALTER TABLE users ADD COLUMN phone TEXT;

          -- 2. Tabela de endereço de entrega do usuário
          CREATE TABLE IF NOT EXISTS user_addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            recipient TEXT NOT NULL,
            zip_code TEXT NOT NULL,
            street TEXT NOT NULL,
            number TEXT NOT NULL,
            complement TEXT,
            neighborhood TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

          -- 3. Adicionar campos de entrega preservados no pedido
          ALTER TABLE orders ADD COLUMN has_delivery_info INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE orders ADD COLUMN delivery_recipient TEXT;
          ALTER TABLE orders ADD COLUMN delivery_phone TEXT;
          ALTER TABLE orders ADD COLUMN delivery_zip_code TEXT;
          ALTER TABLE orders ADD COLUMN delivery_street TEXT;
          ALTER TABLE orders ADD COLUMN delivery_number TEXT;
          ALTER TABLE orders ADD COLUMN delivery_complement TEXT;
          ALTER TABLE orders ADD COLUMN delivery_neighborhood TEXT;
          ALTER TABLE orders ADD COLUMN delivery_city TEXT;
          ALTER TABLE orders ADD COLUMN delivery_state TEXT;
        `);
      },
    },
  ];

  for (const migration of migrations) {
    if (!appliedMigrations.has(migration.name)) {
      console.log(`Aplicando migration: ${migration.name}...`);
      const runTransaction = db.transaction(() => {
        migration.up();
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migration.name);
      });
      runTransaction();
      console.log(`Migration ${migration.name} aplicada com sucesso.`);
    }
  }
}
