import { openDatabase } from './db.js';
openDatabase().close();
console.log('Banco inicializado e migrations aplicadas.');
