import { migrate, openDatabase } from "./db.js";

const db = openDatabase();
const applied = migrate(db);
console.log(applied.length ? `Migrations aplicadas: ${applied.join(", ")}` : "Banco já está atualizado.");
db.close();
