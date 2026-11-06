import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
export function openDatabase(path = process.env.DATABASE_PATH || resolve(backendRoot, 'data/vestebem.sqlite')) {
 if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
 const db = new DatabaseSync(path);
 db.function('search_fold', { deterministic: true }, value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
 db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
 db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 const dir = resolve(backendRoot, 'migrations');
 for (const name of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
  if (db.prepare('SELECT name FROM migrations WHERE name = ?').get(name)) continue;
  db.exec('BEGIN IMMEDIATE');
  try { db.exec(readFileSync(resolve(dir, name), 'utf8')); db.prepare('INSERT INTO migrations(name) VALUES (?)').run(name); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
 }
 return db;
}
