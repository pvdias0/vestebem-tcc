import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Vale tanto para src/ (tsx) quanto para dist/ (build): ambos ficam ao lado de migrations/.
export const MIGRATIONS_DIR = path.resolve(here, "..", "migrations");
export const DEFAULT_DB_PATH = path.resolve(here, "..", "data", "vestebem.db");

export function openDatabase(file = process.env.DB_PATH ?? DEFAULT_DB_PATH): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  // Função usada na pesquisa: ignora maiúsculas/minúsculas e acentos ("coleção" casa com "COLECAO").
  db.function("normalizar", { deterministic: true }, (v: unknown) => (typeof v === "string" ? normalizar(v) : v) as string | null);
  return db;
}

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Aplica, em ordem, as migrations ainda não aplicadas. Retorna os nomes aplicados. */
export function migrate(db: DatabaseSync): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nome TEXT PRIMARY KEY,
    aplicada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const done = new Set(
    (db.prepare("SELECT nome FROM schema_migrations").all() as { nome: string }[]).map((r) => r.nome),
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    // FKs desligadas durante a migration (necessário para recriar tabelas sem disparar
    // ON DELETE CASCADE); a integridade é conferida antes do COMMIT.
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      const violacoes = db.prepare("PRAGMA foreign_key_check").all();
      if (violacoes.length) throw new Error(`violações de chave estrangeira: ${JSON.stringify(violacoes)}`);
      db.prepare("INSERT INTO schema_migrations (nome) VALUES (?)").run(f);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`Falha na migration ${f}: ${(e as Error).message}`);
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
    }
    applied.push(f);
  }
  return applied;
}
