import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { readDelivery, copyDelivery } from './profile.js';
export const statuses = ['received', 'preparing', 'sent', 'cancelled'] as const;
export type Item = { description: string; quantity: number; unitPriceCents: number; productId?: number };
export function insertOrder(db: DatabaseSync, customerId: number, items: Item[], demoKey: string | null = null) {
 const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
 const result = db.prepare('INSERT INTO orders(customer_id,total_cents,demo_key) VALUES (?,?,?)').run(customerId, total, demoKey);
 const id = Number(result.lastInsertRowid);
 for (const item of items) db.prepare('INSERT INTO order_items(order_id,description,quantity,unit_price_cents,product_id) VALUES (?,?,?,?,?)').run(id, item.description, item.quantity, item.unitPriceCents, item.productId ?? null);
 return id;
}
export function ordersRouter(db: DatabaseSync, authenticate: RequestHandler) {
 const router = Router();
 router.use(authenticate);
 const select = `SELECT o.id,o.customer_id AS customerId,u.name AS customerName,u.email AS customerEmail,o.created_at AS createdAt,o.status,o.total_cents AS totalCents FROM orders o JOIN users u ON u.id=o.customer_id`;
 router.get('/', (_req, res) => {
  const user = res.locals.user as { id: number; role: string };
  res.json(user.role === 'employee' ? db.prepare(select + ' ORDER BY o.id DESC').all() : db.prepare(select + ' WHERE o.customer_id=? ORDER BY o.id DESC').all(user.id));
 });
 router.post('/', (req, res) => {
  const user = res.locals.user as { id: number; role: string };
  if (user.role !== 'customer') { res.status(403).json({ message: 'Somente clientes podem criar pedidos.' }); return; }
  const raw: unknown = req.body?.items;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50 || raw.some(item => !item || !Number.isSafeInteger(item.productId) || item.productId < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) || new Set(raw.map(item => item.productId)).size !== raw.length) { res.status(400).json({ message: 'Selecione de 1 a 50 produtos distintos e quantidades inteiras de 1 a 10.000.' }); return; }
  db.exec('BEGIN IMMEDIATE');
  try {
   const delivery=readDelivery(db,user.id);
   if(!delivery || !delivery.phone){db.exec('ROLLBACK');res.status(400).json({message:'Cadastre um endereço e telefone em Minha conta antes de finalizar o pedido.'});return;}
   if(req.body.confirmDelivery!==true || !Number.isSafeInteger(req.body.deliveryVersion) || req.body.deliveryVersion!==delivery.deliveryVersion){db.exec('ROLLBACK');res.status(409).json({message:'Confirme os dados de entrega atuais. Se foram alterados, recarregue esta página.'});return;}
   const items: Item[] = [];
   for (const item of raw) {
    const product = db.prepare('SELECT id,name,price_cents FROM products WHERE id=?').get(item.productId);
    if (!product) { db.exec('ROLLBACK'); res.status(400).json({ message: 'Um dos produtos não existe. Confira o catálogo.' }); return; }
    items.push({ productId: Number(product.id), description: String(product.name), quantity: item.quantity, unitPriceCents: Number(product.price_cents) });
   }
   if (items.reduce((sum,item) => sum+item.quantity*item.unitPriceCents,0) > 100000000000) { db.exec('ROLLBACK'); res.status(400).json({ message: 'O total máximo do pedido é R$ 1 bilhão.' }); return; }
   const id = insertOrder(db, user.id, items); copyDelivery(db,id,delivery); db.exec('COMMIT'); res.status(201).json({ id, message: 'Pedido criado com sucesso.' });
  }
  catch (error) { db.exec('ROLLBACK'); throw error; }
 });
 router.use('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const user = res.locals.user as { id: number; role: string };
  const order = Number.isSafeInteger(id) && id > 0 ? db.prepare(select + ' WHERE o.id=?' + (user.role === 'employee' ? '' : ' AND o.customer_id=?')).get(...(user.role === 'employee' ? [id] : [id, user.id])) : undefined;
  if (!order) { res.status(404).json({ message: 'Pedido não encontrado.' }); return; }
  res.locals.order = order; next();
 });
 router.get('/:id', (_req, res) => {
  const order = res.locals.order;
  const items = db.prepare('SELECT id,product_id AS productId,description,description AS name,quantity,unit_price_cents AS unitPriceCents FROM order_items WHERE order_id=? ORDER BY id').all(order.id);
  const delivery=db.prepare('SELECT recipient,phone,postal_code AS postalCode,street,number,complement,neighborhood,city,state FROM order_delivery WHERE order_id=?').get(order.id) ?? null;
  res.json({ ...order, items, delivery });
 });
 router.patch('/:id/status', (req, res) => {
  if (res.locals.user.role !== 'employee') { res.status(403).json({ message: 'Somente funcionários podem alterar status.' }); return; }
  if (!statuses.includes(req.body?.status)) { res.status(400).json({ message: 'Status inválido.' }); return; }
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status, res.locals.order.id);
  res.json({ message: 'Status atualizado com sucesso.' });
 });
 return router;
}
