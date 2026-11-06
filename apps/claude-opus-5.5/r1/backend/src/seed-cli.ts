import { openDatabase } from "./db.js";
import { SENHA_DEMO, seedDemo } from "./seed-demo.js";

const db = openDatabase();
const log = await seedDemo(db);
db.close();
for (const linha of log) console.log(linha);
console.log(`Senha de todas as contas de demonstração: ${SENHA_DEMO}`);
