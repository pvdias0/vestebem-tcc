import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const folder = fileURLToPath(new URL('../data/', import.meta.url));
mkdirSync(folder, { recursive: true });
export const db = new DatabaseSync(process.env.DB_PATH ?? `${folder}/vestebem.sqlite`);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)');
for (const [version, file] of [[1,'001_initial.sql'],[2,'002_orders.sql'],[3,'003_products.sql'],[4,'004_delivery.sql']] as const) {
if (!db.prepare('SELECT version FROM migrations WHERE version=?').get(version)) {
 db.exec('BEGIN');
 try { db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8')); db.prepare('INSERT INTO migrations VALUES(?)').run(version); db.exec('COMMIT'); } catch(e) { db.exec('ROLLBACK'); throw e; }
}
}
