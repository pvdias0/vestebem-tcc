import { Router, type Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { hashPassword, verifyPassword } from './password.js';

export type Address = { recipient: string; postalCode: string; street: string; number: string; complement: string; district: string; city: string; state: string };
export type Delivery = Address & { phone: string };
const addressSelect = 'recipient, postal_code AS postalCode, street, number, complement, district, city, state';
export function addressFor(db: DatabaseSync, id: number) { return db.prepare(`SELECT ${addressSelect} FROM addresses WHERE user_id=?`).get(id) as Address | undefined; }
export function deliveryFor(db: DatabaseSync, id: number): Delivery | null {
  const address = addressFor(db, id);
  const phone = db.prepare('SELECT phone FROM customer_profiles WHERE user_id=?').get(id)?.phone;
  return address && typeof phone === 'string' && phone ? { ...address, phone } : null;
}
export const deliveryVersion = (delivery: Delivery | null) => delivery ? createHash('sha256').update(JSON.stringify(delivery)).digest('hex') : null;
export function storeDelivery(db: DatabaseSync, orderId: number, delivery: Delivery) {
  db.prepare('INSERT INTO order_deliveries(order_id,recipient,phone,postal_code,street,number,complement,district,city,state) VALUES (?,?,?,?,?,?,?,?,?,?)').run(orderId, delivery.recipient, delivery.phone, delivery.postalCode, delivery.street, delivery.number, delivery.complement, delivery.district, delivery.city, delivery.state);
}
export function orderDelivery(db: DatabaseSync, orderId: number) { return db.prepare(`SELECT ${addressSelect}, phone FROM order_deliveries WHERE order_id=?`).get(orderId) ?? null; }
function digits(value: unknown, lengths: number[]) {
  if (typeof value !== 'string' || value.length > 30 || !/^[\d\s().+\-]*$/.test(value)) return undefined;
  const normalized = value.replace(/\D/g, '');
  return normalized === '' ? null : lengths.includes(normalized.length) ? normalized : undefined;
}
export function validateAddress(body: unknown): Address | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const limits = { recipient: 100, street: 200, number: 30, district: 100, city: 100 };
  for (const [field, limit] of Object.entries(limits)) if (typeof row[field] !== 'string' || !(row[field] as string).trim() || (row[field] as string).trim().length > limit) return null;
  if ((row.recipient as string).trim().length < 2 || (row.complement !== undefined && (typeof row.complement !== 'string' || row.complement.trim().length > 100))) return null;
  const postalCode = digits(row.postalCode, [8]);
  if (!postalCode || typeof row.state !== 'string' || !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(row.state.trim().toUpperCase())) return null;
  return { recipient: (row.recipient as string).trim(), postalCode, street: (row.street as string).trim(), number: (row.number as string).trim(), complement: typeof row.complement === 'string' ? row.complement.trim() : '', district: (row.district as string).trim(), city: (row.city as string).trim(), state: row.state.trim().toUpperCase() };
}
export function profileRouter(db: DatabaseSync, account: (req: Request) => { id: number; role: string } | undefined) {
  const router = Router();
  router.use((req, res, next) => {
    const user = account(req);
    if (!user) { res.status(401).json({ message: 'Entre na sua conta para continuar.' }); return; }
    res.locals.user = user; next();
  });
  router.post('/password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, message: { message: 'Muitas tentativas. Aguarde 15 minutos.' } }), async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || currentPassword.length > 128 || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) { res.status(400).json({ message: 'Informe a senha atual e uma nova senha de 8 a 128 caracteres.' }); return; }
    const userId = res.locals.user.id as number;
    const stored = db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId)!.password_hash as string;
    if (!await verifyPassword(currentPassword, stored)) { res.status(400).json({ message: 'Senha atual incorreta.' }); return; }
    if (currentPassword === newPassword) { res.status(400).json({ message: 'A nova senha deve ser diferente da senha atual.' }); return; }
    const hash = await hashPassword(newPassword);
    // Compare-and-swap prevents two concurrent password changes using stale credentials.
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').run(hash, userId, stored).changes) { db.exec('ROLLBACK'); res.status(409).json({ message: 'A senha foi alterada em outra solicitação. Entre novamente.' }); return; }
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
    res.clearCookie('vestebem_session', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' });
    res.json({ message: 'Senha alterada. Entre novamente com a nova senha.' });
  });
  router.use((req, res, next) => { if (res.locals.user.role !== 'customer') { res.status(403).json({ message: 'Dados pessoais e endereço são exclusivos da própria conta de cliente.' }); return; } next(); });
  function profile(id: number) {
    const user = db.prepare('SELECT u.name,u.email,p.cpf,p.phone FROM users u LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE u.id=?').get(id)!;
    return { ...user, address: addressFor(db, id) ?? null, deliveryVersion: deliveryVersion(deliveryFor(db, id)) };
  }
  router.get('/profile', (_req, res) => { res.json({ profile: profile(res.locals.user.id) }); });
  router.patch('/profile', (req, res) => {
    const { name, cpf, phone } = req.body ?? {};
    const normalizedCpf = digits(cpf, [11]); const normalizedPhone = digits(phone, [10, 11]);
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || normalizedCpf === undefined || normalizedPhone === undefined) { res.status(400).json({ message: 'Informe nome de 2 a 100 caracteres, CPF com 11 dígitos e telefone com DDD de 10 ou 11 dígitos. CPF e telefone podem ficar em branco.' }); return; }
    const id = res.locals.user.id as number;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET name=? WHERE id=?').run(name.trim(), id);
      db.prepare('INSERT INTO customer_profiles(user_id,cpf,phone) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET cpf=excluded.cpf,phone=excluded.phone').run(id, normalizedCpf, normalizedPhone);
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
    res.json({ profile: profile(id), message: 'Dados pessoais atualizados.' });
  });
  router.put('/address', (req, res) => {
    const address = validateAddress(req.body);
    if (!address) { res.status(400).json({ message: 'Preencha todos os campos do endereço, CEP com 8 dígitos e uma UF válida. Complemento é opcional.' }); return; }
    db.prepare('INSERT INTO addresses(user_id,recipient,postal_code,street,number,complement,district,city,state) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET recipient=excluded.recipient,postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,complement=excluded.complement,district=excluded.district,city=excluded.city,state=excluded.state').run(res.locals.user.id, address.recipient, address.postalCode, address.street, address.number, address.complement, address.district, address.city, address.state);
    res.json({ profile: profile(res.locals.user.id), message: 'Endereço salvo com sucesso.' });
  });
  return router;
}
