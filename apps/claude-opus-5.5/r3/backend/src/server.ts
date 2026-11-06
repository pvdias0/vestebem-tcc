import { createApp } from './app.ts';
import { config } from './config.ts';
import { migrate, openDatabase } from './db.ts';

const db = openDatabase(config.dbPath);
const applied = migrate(db, config.migrationsDir);
if (applied.length) console.log(`Migrations aplicadas: ${applied.join(', ')}`);

const app = createApp({
  db,
  sessionDays: config.sessionDays,
  cookieSecure: config.cookieSecure,
  frontendDist: config.frontendDist,
});

app.listen(config.port, () => {
  console.log(`VesteBem rodando em http://localhost:${config.port}`);
});
