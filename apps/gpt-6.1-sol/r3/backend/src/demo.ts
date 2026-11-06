import { openDatabase } from './db.js';
import { seedDemo } from './seed.js';
const db = openDatabase();
try { seedDemo(db); console.log('Demonstração preparada: dois clientes com dados pessoais e endereços fictícios, um funcionário, dois pedidos e 16 produtos.'); } finally { db.close(); }
