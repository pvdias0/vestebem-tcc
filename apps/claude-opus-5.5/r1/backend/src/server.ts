import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { migrate, openDatabase } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const db = openDatabase();
const applied = migrate(db);
if (applied.length) console.log(`Migrations aplicadas: ${applied.join(", ")}`);

const app = createApp(db, {
  staticDir: path.resolve(here, "..", "..", "frontend", "dist"),
  secureCookies: process.env.COOKIE_SECURE === "true",
});
app.listen(port, () => console.log(`VesteBem rodando em http://localhost:${port}`));
