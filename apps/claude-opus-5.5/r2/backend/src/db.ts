import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, '..', 'migrations');
export const DEFAULT_DB_PATH = process.env.DATABASE_PATH ?? resolve(here, '..', 'data', 'vestebem.db');

export function openDatabase(path: string = DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}

/** Aplica, em ordem, as migrations versionadas ainda não aplicadas. Retorna as aplicadas agora. */
export function migrate(db: DatabaseSync): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as unknown as { version: string }[];
  const applied = new Set(rows.map((r) => r.version));
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // foreign_keys precisa ficar desligado para recriar tabelas sem disparar CASCADE
    // (o PRAGMA não tem efeito dentro de transação, por isso é feito antes do BEGIN).
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      const violations = db.prepare('PRAGMA foreign_key_check').all();
      if (violations.length) throw new Error(`Migration ${file} violou chaves estrangeiras`);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      db.exec('COMMIT');
      done.push(file);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return done;
}
