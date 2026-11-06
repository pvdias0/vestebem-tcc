import type { DatabaseSync } from 'node:sqlite';
import express, { type Response } from 'express';
import type { PublicUser } from './app.ts';

export const ORDER_STATUSES = ['recebido', 'em_preparacao', 'enviado', 'cancelado'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LIMITS = { maxItems: 50, maxQuantity: 9999 } as const;

/** Item "congelado" como gravado no pedido (nome e preço do momento da compra). */
export interface ItemSnapshot { productId: number | null; description: string; quantity: number; unitPriceCents: number }

/**
 * Valida itens {productId, quantity} e monta o retrato com nome e preço cadastrados.
 * Produtos repetidos são somados numa única linha. Preços enviados pelo cliente são ignorados.
 */
export function buildItemsFromProducts(db: DatabaseSync, raw: unknown): { items: ItemSnapshot[] } | { errors: string[] } {
  if (!Array.isArray(raw) || raw.length === 0) return { errors: ['O pedido deve conter pelo menos um item.'] };
  if (raw.length > LIMITS.maxItems) return { errors: [`O pedido pode ter no máximo ${LIMITS.maxItems} itens.`] };
  const errors: string[] = [];
  const merged = new Map<number, number>();
  raw.forEach((it: unknown, i) => {
    const n = i + 1;
    const o = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>;
    const { productId, quantity } = o;
    if (typeof productId !== 'number' || !Number.isSafeInteger(productId) || productId < 1) {
      errors.push(`Item ${n}: selecione um produto do catálogo.`);
      return;
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.maxQuantity) {
      errors.push(`Item ${n}: a quantidade deve ser um número inteiro entre 1 e ${LIMITS.maxQuantity}.`);
      return;
    }
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  });
  if (errors.length) return { errors };
  const get = db.prepare('SELECT id, name, price_cents, stock FROM products WHERE id = ?');
  const items: ItemSnapshot[] = [];
  for (const [productId, quantity] of merged) {
    const p = get.get(productId);
    if (!p) { errors.push(`Produto nº ${productId} não encontrado.`); continue; }
    if (quantity > LIMITS.maxQuantity) { errors.push(`"${p.name}": quantidade máxima é ${LIMITS.maxQuantity}.`); continue; }
    if (quantity > Number(p.stock)) {
      errors.push(Number(p.stock) === 0 ? `"${p.name}" está sem estoque.`
        : `"${p.name}": apenas ${p.stock} unidade(s) em estoque.`);
      continue;
    }
    items.push({ productId, description: String(p.name), quantity, unitPriceCents: Number(p.price_cents) });
  }
  return errors.length ? { errors } : { items };
}

export function computeTotalCents(items: ItemSnapshot[]): number {
  return items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
}

/** Insere um pedido com seus itens numa transação. O total é sempre calculado aqui. */
/** Cópia dos dados de entrega gravada no pedido. */
export interface ShippingSnapshot {
  recipient: string; phone: string; cep: string; street: string; number: string; complement: string | null;
  district: string; city: string; state: string;
}

/** Monta a cópia da entrega a partir do endereço e do telefone atuais da conta. */
export function shippingFromAccount(db: DatabaseSync, userId: number): ShippingSnapshot | { error: string } {
  const a = db.prepare("SELECT * FROM addresses WHERE user_id = ?").get(userId);
  const phone = db.prepare("SELECT phone FROM users WHERE id = ?").get(userId)?.phone;
  if (!a) return { error: "Cadastre um endereço de entrega em Minha conta antes de finalizar o pedido." };
  if (typeof phone !== "string" || !phone) return { error: "Cadastre um telefone em Minha conta antes de finalizar o pedido." };
  return {
    recipient: String(a.recipient), phone, cep: String(a.cep), street: String(a.street), number: String(a.number),
    complement: a.complement === null ? null : String(a.complement), district: String(a.district),
    city: String(a.city), state: String(a.state),
  };
}

export function insertOrder(db: DatabaseSync, customerId: number, items: ItemSnapshot[], shipping: ShippingSnapshot | null,
  createdAt?: string): number {
  const total = computeTotalCents(items);
  db.exec('BEGIN');
  try {
    const now = createdAt ?? new Date().toISOString();
    const id = Number(db.prepare(
      `INSERT INTO orders (customer_id, status, total_cents, created_at, updated_at, ship_recipient, ship_phone, ship_cep,
        ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state)
       VALUES (?, 'recebido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(customerId, total, now, now, shipping?.recipient ?? null, shipping?.phone ?? null, shipping?.cep ?? null,
      shipping?.street ?? null, shipping?.number ?? null, shipping?.complement ?? null, shipping?.district ?? null,
      shipping?.city ?? null, shipping?.state ?? null).lastInsertRowid);
    const ins = db.prepare(`INSERT INTO order_items (order_id, position, product_id, description, quantity, unit_price_cents)
      VALUES (?, ?, ?, ?, ?, ?)`);
    items.forEach((it, i) => ins.run(id, i + 1, it.productId, it.description, it.quantity, it.unitPriceCents));
    db.exec('COMMIT');
    return id;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const SUMMARY_SQL = `SELECT o.id, o.status, o.total_cents, o.created_at, o.updated_at,
    u.id AS customer_id, u.name AS customer_name, u.email AS customer_email,
    (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
  FROM orders o JOIN users u ON u.id = o.customer_id`;

function toSummary(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    status: String(r.status) as OrderStatus,
    totalCents: Number(r.total_cents),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    itemCount: Number(r.item_count),
    customer: { id: Number(r.customer_id), name: String(r.customer_name), email: String(r.customer_email) },
  };
}

export function ordersRouter(db: DatabaseSync) {
  const router = express.Router();
  const stmt = {
    listAll: db.prepare(`${SUMMARY_SQL} ORDER BY o.created_at DESC, o.id DESC`),
    listByCustomer: db.prepare(`${SUMMARY_SQL} WHERE o.customer_id = ? ORDER BY o.created_at DESC, o.id DESC`),
    getOne: db.prepare(`${SUMMARY_SQL} WHERE o.id = ?`),
    shipping: db.prepare(`SELECT ship_recipient, ship_phone, ship_cep, ship_street, ship_number, ship_complement,
      ship_district, ship_city, ship_state FROM orders WHERE id = ?`),
    items: db.prepare(`SELECT product_id, description, quantity, unit_price_cents FROM order_items
      WHERE order_id = ? ORDER BY position`),
    setStatus: db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?'),
  };

  const user = (res: Response) => res.locals.user as PublicUser;
  const notFound = (res: Response) => res.status(404).json({ error: 'Pedido não encontrado.' });

  /** Carrega o pedido respeitando a permissão: cliente só enxerga os próprios (404 para os demais). */
  function loadVisible(idParam: string, u: PublicUser) {
    if (!/^\d{1,15}$/.test(idParam)) return undefined;
    const row = stmt.getOne.get(Number(idParam));
    if (!row) return undefined;
    const order = toSummary(row);
    if (u.role !== 'funcionario' && order.customer.id !== u.id) return undefined;
    const items = stmt.items.all(order.id).map((i) => ({
      productId: i.product_id === null ? null : Number(i.product_id),
      description: String(i.description),
      quantity: Number(i.quantity),
      unitPriceCents: Number(i.unit_price_cents),
      subtotalCents: Number(i.quantity) * Number(i.unit_price_cents),
    }));
    // Nunca inclui CPF: o pedido só expõe destinatário, telefone e endereço copiados.
    const sh = stmt.shipping.get(order.id);
    const shipping = sh && sh.ship_recipient !== null ? {
      recipient: String(sh.ship_recipient), phone: String(sh.ship_phone), cep: String(sh.ship_cep),
      street: String(sh.ship_street), number: String(sh.ship_number),
      complement: sh.ship_complement === null ? null : String(sh.ship_complement),
      district: String(sh.ship_district), city: String(sh.ship_city), state: String(sh.ship_state),
    } : null;
    return { ...order, items, shipping };
  }

  router.get('/', (_req, res) => {
    const u = user(res);
    const rows = u.role === 'funcionario' ? stmt.listAll.all() : stmt.listByCustomer.all(u.id);
    res.json({ orders: rows.map(toSummary) });
  });

  router.post('/', (req, res) => {
    const u = user(res);
    if (u.role !== 'cliente') {
      res.status(403).json({ error: 'Somente clientes podem criar pedidos.' });
      return;
    }
    const result = buildItemsFromProducts(db, req.body?.items);
    if ('errors' in result) {
      res.status(400).json({ error: result.errors[0], errors: result.errors });
      return;
    }
    const shipping = shippingFromAccount(db, u.id);
    if ("error" in shipping) { res.status(400).json({ error: shipping.error, errors: [shipping.error] }); return; }
    if (req.body?.confirmShipping !== true) {
      const msg = "Confirme o endereço de entrega para finalizar o pedido.";
      res.status(400).json({ error: msg, errors: [msg] });
      return;
    }
    const id = insertOrder(db, u.id, result.items, shipping);
    res.status(201).json({ order: loadVisible(String(id), u) });
  });

  router.get('/:id', (req, res) => {
    const order = loadVisible(req.params.id, user(res));
    if (!order) { notFound(res); return; }
    res.json({ order });
  });

  router.patch('/:id/status', (req, res) => {
    const u = user(res);
    if (u.role !== 'funcionario') {
      res.status(403).json({ error: 'Somente funcionários podem alterar o status de pedidos.' });
      return;
    }
    const status = req.body?.status;
    if (!ORDER_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Status inválido.' });
      return;
    }
    if (!loadVisible(req.params.id, u)) { notFound(res); return; }
    stmt.setStatus.run(status, new Date().toISOString(), Number(req.params.id));
    res.json({ order: loadVisible(req.params.id, u) });
  });

  return router;
}
