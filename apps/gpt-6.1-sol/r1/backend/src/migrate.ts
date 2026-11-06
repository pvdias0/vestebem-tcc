import { openDatabase } from './database.js';
openDatabase().close();
console.log('Banco inicializado e migrations aplicadas.');
