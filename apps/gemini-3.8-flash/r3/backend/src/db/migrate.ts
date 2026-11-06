import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(file);
    if (!existing) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      console.log(`[Migrations] Applied migration: ${file}`);
    }
  }
}

// Allow direct execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('[Migrations] Executing migrations...');
  runMigrations();
  console.log('[Migrations] All migrations completed successfully.');
}
