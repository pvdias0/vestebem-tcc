import { config } from './config.ts';
import { migrate, openDatabase } from './db.ts';

const db = openDatabase(config.dbPath);
const applied = migrate(db, config.migrationsDir);
console.log(applied.length ? `Migrations aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
console.log(`Banco: ${config.dbPath}`);
db.close();
