import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { DEFAULT_DB_PATH, migrate, openDatabase } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);

const db = openDatabase();
const applied = migrate(db);
if (applied.length) console.log(`Migrations aplicadas: ${applied.join(', ')}`);
console.log(`Banco: ${DEFAULT_DB_PATH}`);

const app = createApp(db, {
  staticDir: process.env.STATIC_DIR ?? resolve(here, '..', '..', 'frontend', 'dist'),
  secureCookies: process.env.COOKIE_SECURE === 'true',
});
app.listen(port, () => console.log(`VesteBem rodando em http://localhost:${port}`));
