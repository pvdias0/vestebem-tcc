import type { DatabaseSync } from "node:sqlite";
import type { Entrega } from "./conta.js";

export const STATUS = ["recebido", "em_preparacao", "enviado", "cancelado"] as const;
export type StatusPedido = (typeof STATUS)[number];

export const MAX_ITENS = 100;
const MAX_QUANTIDADE = 10_000;

/** Item já resolvido: nome e preço copiados do produto no momento da compra. */
export interface ItemEntrada { produtoId: number | null; descricao: string; quantidade: number; precoUnitarioCentavos: number }

export interface ItemPedido extends ItemEntrada { id: number; subtotalCentavos: number }
export interface ResumoPedido {
  id: number;
  cliente: { id: number; nome: string; email: string };
  status: StatusPedido;
  totalCentavos: number;
  criadoEm: string;
  atualizadoEm: string;
  quantidadeItens: number;
}
/** entrega = null: pedido criado antes do registro de entrega (etapa 4). */
export interface Pedido extends ResumoPedido { itens: ItemPedido[]; entrega: Entrega | null }

export class ValidacaoError extends Error {
  constructor(message: string, public campos: Record<string, string> = {}) { super(message); }
}

/** Converte "12,50", "12.5", 12.5 etc. em centavos, sem perda de precisão. */
export function precoParaCentavos(v: unknown): number | null {
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : typeof v === "string" ? v.trim().replace(",", ".") : "";
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function inteiroPositivo(v: unknown): number | null {
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Valida os itens recebidos ({ produtoId, quantidade }) e resolve nome e preço a partir do catálogo.
 * Qualquer nome/preço enviado pelo navegador é ignorado. Itens repetidos do mesmo produto são somados.
 * Lança ValidacaoError com mensagens por campo (itens.N.campo).
 */
export function resolverItens(db: DatabaseSync, raw: unknown): ItemEntrada[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ValidacaoError("O pedido deve conter pelo menos um item.");
  if (raw.length > MAX_ITENS) throw new ValidacaoError(`O pedido pode ter no máximo ${MAX_ITENS} itens.`);
  const campos: Record<string, string> = {};
  const porProduto = new Map<number, ItemEntrada>();
  const buscar = db.prepare("SELECT id, nome, preco_centavos, estoque FROM produtos WHERE id = ?");
  raw.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const produtoId = inteiroPositivo(o.produtoId);
    const quantidade = inteiroPositivo(o.quantidade);
    if (quantidade === null) campos[`itens.${i}.quantidade`] = "A quantidade deve ser um número inteiro positivo.";
    else if (quantidade > MAX_QUANTIDADE) campos[`itens.${i}.quantidade`] = `Máximo de ${MAX_QUANTIDADE} unidades.`;
    const prod = produtoId === null ? undefined
      : buscar.get(produtoId) as { id: number; nome: string; preco_centavos: number; estoque: number } | undefined;
    if (!prod) { campos[`itens.${i}.produtoId`] = "Produto não encontrado no catálogo."; return; }
    if (quantidade === null) return;
    const atual = porProduto.get(prod.id);
    const total = (atual?.quantidade ?? 0) + quantidade;
    if (total > prod.estoque) {
      campos[`itens.${i}.quantidade`] = prod.estoque === 0
        ? `"${prod.nome}" está sem estoque.` : `Há apenas ${prod.estoque} unidade(s) de "${prod.nome}" em estoque.`;
      return;
    }
    porProduto.set(prod.id, { produtoId: prod.id, descricao: prod.nome, quantidade: total, precoUnitarioCentavos: prod.preco_centavos });
  });
  if (Object.keys(campos).length) throw new ValidacaoError("Verifique os itens do pedido.", campos);
  return [...porProduto.values()];
}

export function calcularTotal(itens: ItemEntrada[]): number {
  return itens.reduce((t, i) => t + i.quantidade * i.precoUnitarioCentavos, 0);
}

/** Cria o pedido (com status "recebido") e seus itens numa transação. Retorna o id. */
export function criarPedido(db: DatabaseSync, clienteId: number, itens: ItemEntrada[], entrega: Entrega, criadoEm?: string): number {
  const total = calcularTotal(itens);
  db.exec("BEGIN");
  try {
    const agora = criadoEm ?? new Date().toISOString();
    const r = db.prepare(
      `INSERT INTO pedidos (cliente_id, status, total_centavos, criado_em, atualizado_em,
         entrega_destinatario, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero,
         entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf)
       VALUES (?, 'recebido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(clienteId, total, agora, agora, entrega.destinatario, entrega.telefone, entrega.cep, entrega.logradouro,
      entrega.numero, entrega.complemento, entrega.bairro, entrega.cidade, entrega.uf);
    const id = Number(r.lastInsertRowid);
    const ins = db.prepare(
      "INSERT INTO itens_pedido (pedido_id, produto_id, descricao, quantidade, preco_unitario_centavos) VALUES (?, ?, ?, ?, ?)",
    );
    for (const it of itens) ins.run(id, it.produtoId, it.descricao, it.quantidade, it.precoUnitarioCentavos);
    db.exec("COMMIT");
    return id;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

interface ResumoRow {
  id: number; cliente_id: number; cliente_nome: string; cliente_email: string; status: StatusPedido;
  total_centavos: number; criado_em: string; atualizado_em: string; quantidade_itens: number;
}

const SELECT_RESUMO = `
  SELECT p.id, p.cliente_id, u.nome AS cliente_nome, u.email AS cliente_email, p.status,
         p.total_centavos, p.criado_em, p.atualizado_em,
         (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido i WHERE i.pedido_id = p.id) AS quantidade_itens
  FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id`;

function mapResumo(r: ResumoRow): ResumoPedido {
  return {
    id: r.id,
    cliente: { id: r.cliente_id, nome: r.cliente_nome, email: r.cliente_email },
    status: r.status,
    totalCentavos: r.total_centavos,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    quantidadeItens: r.quantidade_itens,
  };
}

/** Lista pedidos. Com clienteId, restringe aos pedidos daquele cliente. */
export function listarPedidos(db: DatabaseSync, filtro: { clienteId?: number; status?: StatusPedido } = {}): ResumoPedido[] {
  const cond: string[] = [];
  const params: (number | string)[] = [];
  if (filtro.clienteId !== undefined) { cond.push("p.cliente_id = ?"); params.push(filtro.clienteId); }
  if (filtro.status) { cond.push("p.status = ?"); params.push(filtro.status); }
  const where = cond.length ? ` WHERE ${cond.join(" AND ")}` : "";
  const rows = db.prepare(`${SELECT_RESUMO}${where} ORDER BY p.criado_em DESC, p.id DESC`).all(...params) as unknown as ResumoRow[];
  return rows.map(mapResumo);
}

/** Busca um pedido. Com clienteId, só retorna se pertencer àquele cliente. */
export function buscarPedido(db: DatabaseSync, id: number, clienteId?: number): Pedido | null {
  const params: number[] = [id];
  let sql = `${SELECT_RESUMO} WHERE p.id = ?`;
  if (clienteId !== undefined) { sql += " AND p.cliente_id = ?"; params.push(clienteId); }
  const row = db.prepare(sql).get(...params) as unknown as ResumoRow | undefined;
  if (!row) return null;
  const itens = (db.prepare(
    "SELECT id, produto_id, descricao, quantidade, preco_unitario_centavos FROM itens_pedido WHERE pedido_id = ? ORDER BY id",
  ).all(id) as unknown as { id: number; produto_id: number | null; descricao: string; quantidade: number; preco_unitario_centavos: number }[])
    .map((i) => ({
      id: i.id, produtoId: i.produto_id, descricao: i.descricao, quantidade: i.quantidade,
      precoUnitarioCentavos: i.preco_unitario_centavos, subtotalCentavos: i.quantidade * i.preco_unitario_centavos,
    }));
  const e = db.prepare(
    `SELECT entrega_destinatario AS destinatario, entrega_telefone AS telefone, entrega_cep AS cep,
            entrega_logradouro AS logradouro, entrega_numero AS numero, entrega_complemento AS complemento,
            entrega_bairro AS bairro, entrega_cidade AS cidade, entrega_uf AS uf
     FROM pedidos WHERE id = ?`,
  ).get(id) as unknown as Entrega;
  // Somente dados de entrega (sem CPF), visíveis ao cliente dono e a funcionários.
  return { ...mapResumo(row), itens, entrega: e.destinatario === null ? null : { ...e } };
}

export function alterarStatus(db: DatabaseSync, id: number, status: StatusPedido): boolean {
  const r = db.prepare("UPDATE pedidos SET status = ?, atualizado_em = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
  return Number(r.changes) > 0;
}

export const isStatus = (v: unknown): v is StatusPedido => typeof v === "string" && (STATUS as readonly string[]).includes(v);
