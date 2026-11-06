import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { registerSqlFunctions } from './products.ts';

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  registerSqlFunctions(db);
  return db;
}

/** Aplica, em ordem, os arquivos NNN_*.sql ainda não registrados em schema_migrations. */
export function migrate(db: DatabaseSync, migrationsDir: string): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => String(r.version)),
  );
  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const done: string[] = [];
  // Procedimento recomendado pelo SQLite para recriar tabelas: chaves estrangeiras desligadas
  // durante a migration (evita CASCADE ao fazer DROP TABLE) e verificadas antes do COMMIT.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec('BEGIN');
      try {
        db.exec(sql);
        const violations = db.prepare('PRAGMA foreign_key_check').all();
        if (violations.length) throw new Error(`violação de chave estrangeira: ${JSON.stringify(violations[0])}`);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
        db.exec('COMMIT');
        done.push(file);
      } catch (err) {
        db.exec('ROLLBACK');
        throw new Error(`Falha na migration ${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  return done;
}
