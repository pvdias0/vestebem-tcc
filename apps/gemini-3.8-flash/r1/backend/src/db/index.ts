import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database.sqlite');

let databaseInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!databaseInstance) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    databaseInstance = new DatabaseSync(DB_PATH);
    databaseInstance.exec('PRAGMA foreign_keys = ON;');
  }
  return databaseInstance;
}

export function runMigrations(): void {
  const db = getDatabase();

  // Tabela para controle de versionamento das migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration 001: Criação da tabela de usuários inicial
  const checkMigration001 = db.prepare('SELECT id FROM schema_migrations WHERE version = ?');
  const migration001Applied = checkMigration001.get('001_initial_users_table');

  if (!migration001Applied) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (role = 'customer')
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run('001_initial_users_table');
    console.log('[Migration] 001_initial_users_table aplicada com sucesso.');
  }

  // Migration 002: Suporte a perfil 'employee' e criação de pedidos e itens
  const checkMigration002 = db.prepare('SELECT id FROM schema_migrations WHERE version = ?');
  const migration002Applied = checkMigration002.get('002_orders_and_roles');

  if (!migration002Applied) {
    db.exec('PRAGMA foreign_keys = OFF;');

    // Atualiza tabela users para permitir roles 'customer' e 'employee'
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (role IN ('customer', 'employee'))
      );

      INSERT INTO users_new (id, name, email, password_hash, role, created_at, updated_at)
        SELECT id, name, email, password_hash, role, created_at, updated_at FROM users;

      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Criação da tabela de pedidos (orders)
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'recebido',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (status IN ('recebido', 'em preparação', 'enviado', 'cancelado')),
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    `);

    // Criação da tabela de itens do pedido (order_items)
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        CHECK (quantity > 0),
        CHECK (unit_price >= 0),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);

    db.exec('PRAGMA foreign_keys = ON;');

    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run('002_orders_and_roles');
    console.log('[Migration] 002_orders_and_roles aplicada com sucesso.');
  }

  // Migration 003: Catálogo de produtos e vínculo opcional em order_items
  const checkMigration003 = db.prepare('SELECT id FROM schema_migrations WHERE version = ?');
  const migration003Applied = checkMigration003.get('003_products_catalog');

  if (!migration003Applied) {
    db.exec('PRAGMA foreign_keys = OFF;');

    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        size TEXT NOT NULL,
        price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (price >= 0),
        CHECK (stock_quantity >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
      CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
    `);

    const tableInfo = db.prepare(`PRAGMA table_info(order_items);`).all() as unknown as { name: string }[];
    const hasProductId = tableInfo.some(col => col.name === 'product_id');

    if (!hasProductId) {
      db.exec(`
        ALTER TABLE order_items ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
      `);
    }

    db.exec('PRAGMA foreign_keys = ON;');

    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run('003_products_catalog');
    console.log('[Migration] 003_products_catalog aplicada com sucesso.');
  }

  // Migration 004: Dados pessoais e endereço do usuário + snapshot de entrega em pedidos
  const checkMigration004 = db.prepare('SELECT id FROM schema_migrations WHERE version = ?');
  const migration004Applied = checkMigration004.get('004_user_profile_and_order_delivery');

  if (!migration004Applied) {
    db.exec('PRAGMA foreign_keys = OFF;');

    // Adiciona colunas de perfil e endereço à tabela users se não existirem
    const userColumns = (db.prepare(`PRAGMA table_info(users);`).all() as unknown as { name: string }[]).map(c => c.name);

    if (!userColumns.includes('cpf')) {
      db.exec(`ALTER TABLE users ADD COLUMN cpf TEXT;`);
    }
    if (!userColumns.includes('phone')) {
      db.exec(`ALTER TABLE users ADD COLUMN phone TEXT;`);
    }
    if (!userColumns.includes('recipient_name')) {
      db.exec(`ALTER TABLE users ADD COLUMN recipient_name TEXT;`);
    }
    if (!userColumns.includes('cep')) {
      db.exec(`ALTER TABLE users ADD COLUMN cep TEXT;`);
    }
    if (!userColumns.includes('street')) {
      db.exec(`ALTER TABLE users ADD COLUMN street TEXT;`);
    }
    if (!userColumns.includes('number')) {
      db.exec(`ALTER TABLE users ADD COLUMN number TEXT;`);
    }
    if (!userColumns.includes('complement')) {
      db.exec(`ALTER TABLE users ADD COLUMN complement TEXT;`);
    }
    if (!userColumns.includes('neighborhood')) {
      db.exec(`ALTER TABLE users ADD COLUMN neighborhood TEXT;`);
    }
    if (!userColumns.includes('city')) {
      db.exec(`ALTER TABLE users ADD COLUMN city TEXT;`);
    }
    if (!userColumns.includes('state')) {
      db.exec(`ALTER TABLE users ADD COLUMN state TEXT;`);
    }

    // Adiciona colunas de snapshot de entrega à tabela orders se não existirem
    const orderColumns = (db.prepare(`PRAGMA table_info(orders);`).all() as unknown as { name: string }[]).map(c => c.name);

    if (!orderColumns.includes('delivery_recipient_name')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_recipient_name TEXT;`);
    }
    if (!orderColumns.includes('delivery_phone')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_phone TEXT;`);
    }
    if (!orderColumns.includes('delivery_cep')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_cep TEXT;`);
    }
    if (!orderColumns.includes('delivery_street')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_street TEXT;`);
    }
    if (!orderColumns.includes('delivery_number')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_number TEXT;`);
    }
    if (!orderColumns.includes('delivery_complement')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_complement TEXT;`);
    }
    if (!orderColumns.includes('delivery_neighborhood')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_neighborhood TEXT;`);
    }
    if (!orderColumns.includes('delivery_city')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_city TEXT;`);
    }
    if (!orderColumns.includes('delivery_state')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_state TEXT;`);
    }

    db.exec('PRAGMA foreign_keys = ON;');

    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run('004_user_profile_and_order_delivery');
    console.log('[Migration] 004_user_profile_and_order_delivery aplicada com sucesso.');
  }
}
