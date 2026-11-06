import type { DatabaseSync } from "node:sqlite";
import { normalizar } from "./db.js";
import { precoParaCentavos, ValidacaoError } from "./pedidos.js";

export const POR_PAGINA = 12;
const MAX_PRECO_CENTAVOS = 100_000_000; // R$ 1.000.000,00
const MAX_ESTOQUE = 1_000_000;

export interface Produto {
  id: number; nome: string; descricao: string; categoria: string; tamanho: string;
  precoCentavos: number; estoque: number; criadoEm: string; atualizadoEm: string;
}
export interface DadosProduto { nome: string; descricao: string; categoria: string; tamanho: string; precoCentavos: number; estoque: number }

interface ProdutoRow {
  id: number; nome: string; descricao: string; categoria: string; tamanho: string;
  preco_centavos: number; estoque: number; criado_em: string; atualizado_em: string;
}
const COLUNAS = "id, nome, descricao, categoria, tamanho, preco_centavos, estoque, criado_em, atualizado_em";
const mapProduto = (r: ProdutoRow): Produto => ({
  id: r.id, nome: r.nome, descricao: r.descricao, categoria: r.categoria, tamanho: r.tamanho,
  precoCentavos: r.preco_centavos, estoque: r.estoque, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
});

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Valida os dados de cadastro/atualização de produto. */
export function validarProduto(body: unknown): DadosProduto {
  const o = (body ?? {}) as Record<string, unknown>;
  const campos: Record<string, string> = {};
  const nome = texto(o.nome);
  const descricao = typeof o.descricao === "string" ? o.descricao.replace(/\r\n/g, "\n").trim() : "";
  const categoria = texto(o.categoria);
  const tamanho = texto(o.tamanho).toUpperCase();
  if (!nome) campos.nome = "Informe o nome.";
  else if (nome.length > 120) campos.nome = "Máximo de 120 caracteres.";
  if (descricao.length > 2000) campos.descricao = "Máximo de 2000 caracteres.";
  if (!categoria) campos.categoria = "Informe a categoria.";
  else if (categoria.length > 50) campos.categoria = "Máximo de 50 caracteres.";
  if (!tamanho) campos.tamanho = "Informe o tamanho.";
  else if (tamanho.length > 20) campos.tamanho = "Máximo de 20 caracteres.";

  const precoCentavos = precoParaCentavos(o.preco);
  if (precoCentavos === null) campos.preco = "Informe um preço válido, não negativo, com até 2 casas decimais.";
  else if (precoCentavos > MAX_PRECO_CENTAVOS) campos.preco = "Preço acima do limite permitido.";

  const est = typeof o.estoque === "string" && /^\d+$/.test(o.estoque.trim()) ? Number(o.estoque) : o.estoque;
  const estoque = typeof est === "number" && Number.isSafeInteger(est) && est >= 0 ? est : null;
  if (estoque === null) campos.estoque = "O estoque deve ser um número inteiro igual ou maior que zero.";
  else if (estoque > MAX_ESTOQUE) campos.estoque = "Estoque acima do limite permitido.";

  if (Object.keys(campos).length) throw new ValidacaoError("Verifique os dados do produto.", campos);
  return { nome, descricao, categoria, tamanho, precoCentavos: precoCentavos!, estoque: estoque! };
}

export function criarProduto(db: DatabaseSync, d: DadosProduto): number {
  const r = db.prepare(
    "INSERT INTO produtos (nome, descricao, categoria, tamanho, preco_centavos, estoque) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(d.nome, d.descricao, d.categoria, d.tamanho, d.precoCentavos, d.estoque);
  return Number(r.lastInsertRowid);
}

export function atualizarProduto(db: DatabaseSync, id: number, d: DadosProduto): boolean {
  const r = db.prepare(
    `UPDATE produtos SET nome = ?, descricao = ?, categoria = ?, tamanho = ?, preco_centavos = ?, estoque = ?, atualizado_em = ?
     WHERE id = ?`,
  ).run(d.nome, d.descricao, d.categoria, d.tamanho, d.precoCentavos, d.estoque, new Date().toISOString(), id);
  return Number(r.changes) > 0;
}

export function buscarProduto(db: DatabaseSync, id: number): Produto | null {
  const r = db.prepare(`SELECT ${COLUNAS} FROM produtos WHERE id = ?`).get(id) as unknown as ProdutoRow | undefined;
  return r ? mapProduto(r) : null;
}

export interface FiltrosCatalogo {
  q?: string; categoria?: string; tamanho?: string; precoMinCentavos?: number; precoMaxCentavos?: number;
  ordem: "nome" | "preco"; direcao: "asc" | "desc"; pagina: number;
}

/** Converte a query string em filtros validados. Lança ValidacaoError para valores inválidos. */
export function lerFiltros(query: Record<string, unknown>): FiltrosCatalogo {
  const s = (k: string) => (typeof query[k] === "string" ? (query[k] as string).trim() : "");
  const campos: Record<string, string> = {};
  const preco = (k: string) => {
    const v = s(k);
    if (!v) return undefined;
    const c = precoParaCentavos(v);
    if (c === null) { campos[k] = "Preço inválido (use valor não negativo, até 2 casas decimais)."; return undefined; }
    return c;
  };
  const precoMinCentavos = preco("precoMin");
  const precoMaxCentavos = preco("precoMax");
  if (precoMinCentavos !== undefined && precoMaxCentavos !== undefined && precoMinCentavos > precoMaxCentavos) {
    campos.precoMax = "O preço máximo deve ser maior ou igual ao mínimo.";
  }
  const ordem = s("ordem") || "nome";
  if (ordem !== "nome" && ordem !== "preco") campos.ordem = "Ordenação inválida.";
  const direcao = s("direcao") || "asc";
  if (direcao !== "asc" && direcao !== "desc") campos.direcao = "Direção inválida.";
  const pag = s("pagina") || "1";
  const pagina = /^\d+$/.test(pag) && Number(pag) >= 1 && Number(pag) <= 100_000 ? Number(pag) : NaN;
  if (Number.isNaN(pagina)) campos.pagina = "Página inválida.";
  const q = s("q").slice(0, 100);
  if (Object.keys(campos).length) throw new ValidacaoError("Filtros inválidos.", campos);
  return {
    q: q || undefined, categoria: s("categoria") || undefined, tamanho: s("tamanho") || undefined,
    precoMinCentavos, precoMaxCentavos, ordem: ordem as "nome" | "preco", direcao: direcao as "asc" | "desc", pagina,
  };
}

/** Escapa curingas do LIKE; o termo vai como parâmetro (sem concatenação de SQL). */
const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Lista produtos aplicando todos os filtros simultaneamente (AND). Somente leitura. */
export function listarProdutos(db: DatabaseSync, f: FiltrosCatalogo) {
  const cond: string[] = [];
  const params: (string | number)[] = [];
  if (f.q) {
    const termo = `%${escaparLike(normalizar(f.q))}%`;
    cond.push("(normalizar(nome) LIKE ? ESCAPE '\\' OR normalizar(descricao) LIKE ? ESCAPE '\\')");
    params.push(termo, termo);
  }
  if (f.categoria) { cond.push("categoria = ? COLLATE NOCASE"); params.push(f.categoria); }
  if (f.tamanho) { cond.push("tamanho = ? COLLATE NOCASE"); params.push(f.tamanho); }
  if (f.precoMinCentavos !== undefined) { cond.push("preco_centavos >= ?"); params.push(f.precoMinCentavos); }
  if (f.precoMaxCentavos !== undefined) { cond.push("preco_centavos <= ?"); params.push(f.precoMaxCentavos); }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  // Ordenação vem de lista fechada (validada em lerFiltros), nunca de texto livre.
  const dir = f.direcao === "desc" ? "DESC" : "ASC";
  const orderBy = f.ordem === "preco"
    ? `preco_centavos ${dir}, nome COLLATE NOCASE ASC, id ASC`
    : `normalizar(nome) ${dir}, id ASC`;

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM produtos ${where}`).get(...params) as { n: number }).n;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const rows = db.prepare(`SELECT ${COLUNAS} FROM produtos ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, POR_PAGINA, (f.pagina - 1) * POR_PAGINA) as unknown as ProdutoRow[];
  return { produtos: rows.map(mapProduto), total, pagina: f.pagina, totalPaginas, porPagina: POR_PAGINA };
}

/** Valores existentes para popular os filtros. */
export function opcoesFiltro(db: DatabaseSync) {
  const col = (c: "categoria" | "tamanho") =>
    (db.prepare(`SELECT DISTINCT ${c} AS v FROM produtos ORDER BY ${c} COLLATE NOCASE`).all() as { v: string }[]).map((r) => r.v);
  return { categorias: col("categoria"), tamanhos: col("tamanho") };
}
