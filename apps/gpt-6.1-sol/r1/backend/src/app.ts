import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { backendRoot } from './database.js';
import { hashPassword } from './password.js';
import { ordersRouter } from './orders.js';
import { productsRouter } from './products.js';
import { profileRouter } from './profile.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieName = 'vestebem_session';
const lifetime = 7 * 24 * 60 * 60 * 1000;
function tokenFrom(req: Request) {
  return req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
}
export function createApp(db: DatabaseSync) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const allowed = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : ['http://localhost:5173', `http://localhost:${process.env.PORT ?? 3001}`];
      if (origin && !allowed.includes(origin)) { res.status(403).json({ message: 'Origem não permitida.' }); return; }
      if (!req.is('application/json')) { res.status(415).json({ message: 'Envie os dados em JSON.' }); return; }
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' } });
  app.use(['/api/register', '/api/login'], limiter);
  function account(req: Request) {
    return db.prepare('SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(digest(tokenFrom(req)), Date.now()) as { id: number; name: string; email: string; role: 'customer' | 'employee' } | undefined;
  }
  function startSession(res: Response, id: number) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(digest(token), id, Date.now() + lifetime);
    res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: lifetime, path: '/' });
  }
  app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ message: 'Informe nome de 2 a 100 caracteres, e-mail válido e senha de 8 a 128 caracteres.' }); return;
    }
    const normalized = email.trim().toLowerCase();
    const hash = await hashPassword(password);
    try {
      db.prepare('INSERT INTO users(name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), normalized, hash);
    } catch (error) {
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) { res.status(409).json({ message: 'Este e-mail já está cadastrado.' }); return; }
      throw error;
    }
    res.status(201).json({ message: 'Conta criada. Entre para continuar.' });
  });
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) { res.status(401).json({ message: 'E-mail ou senha incorretos.' }); return; }
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email.trim().toLowerCase()) as { id: number; password_hash: string } | undefined;
    const stored = user?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const [salt, expected] = stored.split(':');
    const actual = (await hashPassword(password, salt)).split(':')[1];
    if (!user || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex')) || db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !== stored) { res.status(401).json({ message: 'E-mail ou senha incorretos.' }); return; }
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(tokenFrom(req)));
    startSession(res, user.id);
    res.json({ user: db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(user.id) });
  });
  app.get('/api/me', (req, res) => {
    const user = account(req);
    if (!user) { res.status(401).json({ message: 'Entre na sua conta para continuar.' }); return; }
    res.json({ user });
  });
  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(tokenFrom(req)));
    res.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' });
    res.status(204).end();
  });
  app.use('/api/orders', ordersRouter(db, account));
  app.use('/api/me', profileRouter(db, account));
  app.use('/api/products', productsRouter(db, account));
  app.use('/api', (_req, res) => { res.status(404).json({ message: 'Recurso não encontrado.' }); });
  const frontend = resolve(backendRoot, '../frontend/dist');
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
    app.get('/{*path}', (_req, res) => { res.sendFile(resolve(frontend, 'index.html')); });
  }
  app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const status = error instanceof SyntaxError ? 400 : (error && typeof error === 'object' && 'status' in error && error.status === 413) ? 413 : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ message: status === 400 ? 'JSON inválido.' : status === 413 ? 'Os dados enviados excedem o limite de 64 KB.' : 'Não foi possível concluir. Tente novamente.' });
  });
  return app;
}
