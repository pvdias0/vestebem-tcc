import type { Express, NextFunction, Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';

export const ORDER_STATUSES = ['recebido', 'em_preparacao', 'enviado', 'cancelado'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Role = 'customer' | 'employee';
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

/** Item já resolvido, pronto para gravar (snapshot de nome e preço do produto). */
export interface NewItem {
  productId: number | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

const MAX_ITEMS = 50;
const MAX_QTY = 10_000;

/**
 * Valida os itens enviados pelo cliente ({productId, quantity}) e resolve nome e preço
 * a partir do catálogo. Itens repetidos do mesmo produto são somados.
 */
export function resolveItems(db: DatabaseSync, raw: unknown): { items: NewItem[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'O pedido deve conter pelo menos um item.' };
  if (raw.length > MAX_ITEMS) return { error: `O pedido pode ter no máximo ${MAX_ITEMS} itens.` };
  const qty = new Map<number, number>();
  for (const [i, it] of raw.entries()) {
    const n = i + 1;
    const r = (it ?? {}) as Record<string, unknown>;
    const productId = r.productId;
    if (typeof productId !== 'number' || !Number.isSafeInteger(productId) || productId <= 0)
      return { error: `Item ${n}: selecione um produto do catálogo.` };
    const quantity = r.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QTY)
      return { error: `Item ${n}: a quantidade deve ser um número inteiro positivo.` };
    qty.set(productId, (qty.get(productId) ?? 0) + quantity);
  }
  const stmt = db.prepare('SELECT id, name, price_cents, stock FROM products WHERE id = ?');
  const items: NewItem[] = [];
  for (const [productId, quantity] of qty) {
    const p = stmt.get(productId) as { id: number; name: string; price_cents: number; stock: number } | undefined;
    if (!p) return { error: `Produto nº ${productId} não encontrado no catálogo.` };
    if (quantity > MAX_QTY) return { error: `"${p.name}": quantidade acima do permitido.` };
    if (quantity > p.stock)
      return { error: p.stock === 0 ? `"${p.name}" está esgotado.` : `"${p.name}": apenas ${p.stock} unidade(s) em estoque.` };
    items.push({ productId: p.id, description: p.name, quantity, unitPriceCents: p.price_cents });
  }
  return { items };
}

export function computeTotal(items: NewItem[]): number {
  return items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
}

/** Cria o pedido e seus itens numa transação. O total é sempre calculado aqui. */
/** Cópia dos dados de entrega gravada no pedido. */
export interface Shipping {
  recipient: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export function insertOrder(
  db: DatabaseSync,
  customerId: number,
  items: NewItem[],
  shipping: Shipping | null,
  createdAt?: string,
): number {
  db.exec('BEGIN');
  try {
    const now = createdAt ?? new Date().toISOString();
    const s = shipping;
    const res = db
      .prepare(
        `INSERT INTO orders (customer_id, status, total_cents, created_at, updated_at,
           shipping_recipient, shipping_phone, shipping_cep, shipping_street, shipping_number,
           shipping_complement, shipping_district, shipping_city, shipping_state)
         VALUES (?, 'recebido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        customerId, computeTotal(items), now, now,
        s?.recipient ?? null, s?.phone ?? null, s?.cep ?? null, s?.street ?? null, s?.number ?? null,
        s?.complement ?? null, s?.district ?? null, s?.city ?? null, s?.state ?? null,
      );
    const orderId = Number(res.lastInsertRowid);
    const stmt = db.prepare(
      'INSERT INTO order_items (order_id, product_id, description, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)',
    );
    for (const it of items) stmt.run(orderId, it.productId, it.description, it.quantity, it.unitPriceCents);
    db.exec('COMMIT');
    return orderId;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

interface OrderRow {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  updated_at: string;
  item_count: number;
  shipping_recipient: string | null;
  shipping_phone: string | null;
  shipping_cep: string | null;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_district: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
}
interface ItemRow {
  id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
}

const ORDER_SELECT = `
  SELECT o.id, o.customer_id, u.name AS customer_name, u.email AS customer_email, o.status,
         o.total_cents, o.created_at, o.updated_at,
         o.shipping_recipient, o.shipping_phone, o.shipping_cep, o.shipping_street, o.shipping_number,
         o.shipping_complement, o.shipping_district, o.shipping_city, o.shipping_state,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
  FROM orders o JOIN users u ON u.id = o.customer_id`;

function toOrder(r: OrderRow) {
  return {
    id: r.id,
    customer: { id: r.customer_id, name: r.customer_name, email: r.customer_email },
    status: r.status,
    totalCents: r.total_cents,
    itemCount: r.item_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // null = pedido anterior à etapa 4, sem informações de entrega registradas.
    shipping:
      r.shipping_recipient === null
        ? null
        : {
            recipient: r.shipping_recipient,
            phone: r.shipping_phone ?? '',
            cep: r.shipping_cep ?? '',
            street: r.shipping_street ?? '',
            number: r.shipping_number ?? '',
            complement: r.shipping_complement ?? '',
            district: r.shipping_district ?? '',
            city: r.shipping_city ?? '',
            state: r.shipping_state ?? '',
          },
  };
}

const user = (res: Response) => (res.locals as { user?: SessionUser }).user;

export function registerOrderRoutes(app: Express, db: DatabaseSync) {
  const requireUser = (_req: Request, res: Response, next: NextFunction) => {
    if (!user(res)) {
      res.status(401).json({ error: 'Você precisa entrar para acessar esta página.' });
      return;
    }
    next();
  };
  const requireRole = (role: Role, message: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (user(res)?.role !== role) {
      res.status(403).json({ error: message });
      return;
    }
    next();
  };

  const getOrder = (id: number) => db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) as unknown as OrderRow | undefined;
  const getItems = (id: number) =>
    (db.prepare('SELECT id, product_id, description, quantity, unit_price_cents FROM order_items WHERE order_id = ? ORDER BY id').all(id) as unknown as ItemRow[]).map(
      (i) => ({
        id: i.id,
        productId: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unitPriceCents: i.unit_price_cents,
        subtotalCents: i.quantity * i.unit_price_cents,
      }),
    );
  const parseId = (v: unknown) => {
    const n = typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };

  app.post('/api/orders', requireUser, requireRole('customer', 'Somente clientes podem criar pedidos.'), (req, res) => {
    const result = resolveItems(db, (req.body as { items?: unknown } | undefined)?.items);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    const body = (req.body ?? {}) as { confirmShipping?: unknown; addressUpdatedAt?: unknown };
    const u = user(res)!;
    const addr = db
      .prepare('SELECT recipient, cep, street, number, complement, district, city, state, updated_at FROM addresses WHERE user_id = ?')
      .get(u.id) as unknown as (Omit<Shipping, 'phone'> & { updated_at: string }) | undefined;
    const phone = (db.prepare('SELECT phone FROM users WHERE id = ?').get(u.id) as { phone: string | null }).phone;
    if (!addr) {
      res.status(400).json({ error: 'Cadastre um endereço de entrega em "Minha conta" antes de finalizar o pedido.' });
      return;
    }
    if (!phone) {
      res.status(400).json({ error: 'Cadastre um telefone em "Minha conta" antes de finalizar o pedido.' });
      return;
    }
    if (body.confirmShipping !== true) {
      res.status(400).json({ error: 'Confirme o endereço de entrega para finalizar o pedido.' });
      return;
    }
    // Garante que o endereço confirmado na tela é o mesmo cadastrado agora.
    if (body.addressUpdatedAt !== undefined && body.addressUpdatedAt !== addr.updated_at) {
      res.status(409).json({ error: 'Seu endereço foi alterado. Revise e confirme novamente os dados de entrega.' });
      return;
    }
    const { updated_at: _ignored, ...address } = addr;
    const id = insertOrder(db, u.id, result.items, { ...address, phone });
    res.status(201).json({ order: { ...toOrder(getOrder(id)!), items: getItems(id) } });
  });

  // Cliente: apenas os próprios pedidos. Funcionário: todos (filtro opcional por status).
  app.get('/api/orders', requireUser, (req, res) => {
    const u = user(res)!;
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: 'Status inválido.' });
      return;
    }
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (u.role !== 'employee') {
      where.push('o.customer_id = ?');
      params.push(u.id);
    }
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    const sql = `${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC, o.id DESC`;
    const rows = db.prepare(sql).all(...params) as unknown as OrderRow[];
    res.set('Cache-Control', 'no-store');
    res.json({ orders: rows.map(toOrder) });
  });

  app.get('/api/orders/:id', requireUser, (req, res) => {
    const u = user(res)!;
    const id = parseId(req.params.id);
    const row = id ? getOrder(id) : undefined;
    // Pedido de outro cliente responde 404, sem revelar que existe.
    if (!row || (u.role !== 'employee' && row.customer_id !== u.id)) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ order: { ...toOrder(row), items: getItems(row.id) } });
  });

  app.patch(
    '/api/orders/:id/status',
    requireUser,
    requireRole('employee', 'Somente funcionários podem alterar o status de pedidos.'),
    (req, res) => {
      const id = parseId(req.params.id);
      const status = (req.body as { status?: unknown } | undefined)?.status;
      if (typeof status !== 'string' || !(ORDER_STATUSES as readonly string[]).includes(status)) {
        res.status(400).json({ error: 'Status inválido.' });
        return;
      }
      const result = id
        ? db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id)
        : { changes: 0 };
      if (!id || Number(result.changes) === 0) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
      }
      res.json({ order: { ...toOrder(getOrder(id)!), items: getItems(id) } });
    },
  );
}
