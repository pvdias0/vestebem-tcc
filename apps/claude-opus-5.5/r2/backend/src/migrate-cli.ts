import { DEFAULT_DB_PATH, migrate, openDatabase } from './db.js';

const db = openDatabase();
const done = migrate(db);
db.close();
console.log(done.length ? `Migrations aplicadas: ${done.join(', ')}` : 'Banco já está atualizado.');
console.log(`Banco: ${DEFAULT_DB_PATH}`);
