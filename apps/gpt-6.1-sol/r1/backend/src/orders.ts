import { Router, type Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { deliveryFor, deliveryVersion, storeDelivery, orderDelivery } from './profile.js';

type Account = { id: number; role: 'customer' | 'employee' };
type Item = { description: string; quantity: number; unitPriceCents: number; productId?: number };
export const statuses = ['received', 'preparing', 'shipped', 'cancelled'] as const;

export function validateItems(value: unknown): Item[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const items: Item[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.description !== 'string' || !item.description.trim() || item.description.trim().length > 200 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 || !Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0 || item.unitPriceCents > 100000000) return null;
    items.push({ description: item.description.trim(), quantity: item.quantity, unitPriceCents: item.unitPriceCents });
  }
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  return total <= 100000000000 ? items : null;
}

// All writes of an order and its items are atomic; totals never come from the caller.
export function insertOrder(db: DatabaseSync, customerId: number, items: Item[], demoKey: string | null = null) {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const result = db.prepare('INSERT INTO orders(customer_id, total_cents, demo_key) VALUES (?, ?, ?)').run(customerId, total, demoKey);
  const id = Number(result.lastInsertRowid);
  const insert = db.prepare('INSERT INTO order_items(order_id, description, quantity, unit_price_cents, product_id) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) insert.run(id, item.description, item.quantity, item.unitPriceCents, item.productId ?? null);
  return id;
}

export function ordersRouter(db: DatabaseSync, account: (req: Request) => Account | undefined) {
  const router = Router();
  router.use((req, res, next) => {
    const user = account(req);
    if (!user) { res.status(401).json({ message: 'Entre na sua conta para consultar pedidos.' }); return; }
    res.locals.user = user;
    next();
  });
  const select = `SELECT o.id, o.customer_id AS customerId, u.name AS customerName,
    o.created_at AS createdAt, o.status, o.total_cents AS totalCents
    FROM orders o JOIN users u ON u.id = o.customer_id`;
  router.get('/', (_req, res) => {
    const user: Account = res.locals.user;
    const orders = user.role === 'employee'
      ? db.prepare(`${select} ORDER BY o.id DESC`).all()
      : db.prepare(`${select} WHERE o.customer_id = ? ORDER BY o.id DESC`).all(user.id);
    res.json({ orders });
  });
  router.post('/', (req, res) => {
    const user: Account = res.locals.user;
    if (user.role !== 'customer') { res.status(403).json({ message: 'Somente clientes podem criar pedidos.' }); return; }
    db.exec('BEGIN IMMEDIATE');
    let id: number;
    try {
      const delivery = deliveryFor(db, user.id);
      if (!delivery) { db.exec('ROLLBACK'); res.status(400).json({ message: 'Cadastre um endereço e um telefone com DDD em Minha conta antes de finalizar.' }); return; }
      if (req.body?.confirmDelivery !== true || req.body?.deliveryVersion !== deliveryVersion(delivery)) { db.exec('ROLLBACK'); res.status(409).json({ message: 'Confira e confirme o endereço e telefone atuais antes de finalizar. Recarregue a entrega se houve alteração.' }); return; }
      const input: unknown = req.body?.items;
      const items: Item[] = [];
      let valid = Array.isArray(input) && input.length >= 1 && input.length <= 50;
      const seen = new Set<number>();
      if (valid && Array.isArray(input)) for (const item of input) {
        if (!item || !Number.isSafeInteger(item.productId) || item.productId < 1 || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) { valid = false; break; }
        const product = db.prepare('SELECT name, price_cents FROM products WHERE id = ?').get(item.productId);
        if (!product) { valid = false; break; }
        seen.add(item.productId);
        items.push({ productId: item.productId, description: String(product.name), quantity: item.quantity, unitPriceCents: Number(product.price_cents) });
      }
      if (!valid || !validateItems(items)) {
        db.exec('ROLLBACK'); res.status(400).json({ message: 'Selecione de 1 a 50 produtos distintos existentes e quantidades inteiras de 1 a 10.000. Total máximo: R$ 1.000.000.000,00.' }); return;
      }
      id = insertOrder(db, user.id, items); storeDelivery(db, id, delivery); db.exec('COMMIT');
    }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    res.status(201).json({ order: db.prepare(`${select} WHERE o.id = ?`).get(id) });
  });
  router.get('/:id', (req, res) => {
    const user: Account = res.locals.user;
    const id = Number(req.params.id);
    const order = Number.isSafeInteger(id) && id > 0 ? db.prepare(`${select} WHERE o.id = ? ${user.role === 'customer' ? 'AND o.customer_id = ?' : ''}`).get(...(user.role === 'customer' ? [id, user.id] : [id])) : undefined;
    if (!order) { res.status(404).json({ message: 'Pedido não encontrado.' }); return; }
    const items = db.prepare('SELECT id, product_id AS productId, description, quantity, unit_price_cents AS unitPriceCents FROM order_items WHERE order_id = ? ORDER BY id').all(id);
    res.json({ order: { ...order, items, delivery: orderDelivery(db, id) } });
  });
  router.patch('/:id/status', (req, res) => {
    const user: Account = res.locals.user;
    if (user.role !== 'employee') { res.status(403).json({ message: 'Somente funcionários podem alterar status.' }); return; }
    if (!statuses.includes(req.body?.status)) { res.status(400).json({ message: 'Status inválido.' }); return; }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, id).changes) { res.status(404).json({ message: 'Pedido não encontrado.' }); return; }
    res.json({ order: db.prepare(`${select} WHERE o.id = ?`).get(id), message: 'Status atualizado com sucesso.' });
  });
  return router;
}
