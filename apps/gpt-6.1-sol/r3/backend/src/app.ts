import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { backendRoot } from './db.js';
import { ordersRouter } from './orders.js';
import { productsRouter } from './products.js';
import { profileRouter } from './profile.js';
const scrypt = promisify(scryptCallback);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'vestebem_session';
function token(req: Request) { return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || ''; }
export function createApp(db: DatabaseSync) {
 const app = express();
 app.disable('x-powered-by');
 app.use(helmet());
 app.use(express.json({ limit: '32kb' }));
 app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
 app.use('/api', (req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== (process.env.APP_ORIGIN || 'http://localhost:5173') && req.headers.origin !== `http://localhost:${process.env.PORT || 3000}`) { res.status(403).json({ message: 'Origem não permitida.' }); return; }
  next();
 });
 const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' } });
 const clearCookie = (res: Response) => res.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true' });
 app.post('/api/register', limiter, async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 128) { res.status(400).json({ message: 'Informe nome (2 a 100 caracteres), e-mail válido e senha de 8 a 128 caracteres.' }); return; }
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  try { db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(name.trim(), email.trim().toLowerCase(), salt + ':' + hash.toString('hex')); }
  catch (error) { if (String(error).includes('UNIQUE constraint failed: users.email')) { res.status(409).json({ message: 'Este e-mail já está cadastrado.' }); return; } throw error; }
  res.status(201).json({ message: 'Conta criada. Entre com seu e-mail e senha.' });
 });
 app.post('/api/login', limiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) { res.status(400).json({ message: 'Informe e-mail e senha válidos.' }); return; }
  const user = db.prepare('SELECT id,password_hash FROM users WHERE email = ?').get(email.trim().toLowerCase());
  const [salt, stored] = String(user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64)).split(':');
  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  if (!timingSafeEqual(candidate, Buffer.from(stored, 'hex')) || !user) { res.status(401).json({ message: 'E-mail ou senha incorretos.' }); return; }
  db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR token_hash = ?').run(Date.now(), digest(token(req)));
  const session = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(digest(session), user.id, Date.now() + 86400000);
  res.cookie(cookieName, session, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 86400000, path: '/' });
  res.json({ message: 'Login realizado.' });
 });
 app.get('/api/me', (req, res) => {
  const user = db.prepare('SELECT u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at > ?').get(digest(token(req)), Date.now());
  if (!user) { clearCookie(res); res.status(401).json({ message: 'Entre para acessar sua conta.' }); return; }
  res.json(user);
 });
 app.post('/api/logout', (req, res) => { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token(req))); clearCookie(res); res.status(204).end(); });
 const authenticate: import('express').RequestHandler = (req, res, next) => {
  const user = db.prepare('SELECT u.id,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token(req)), Date.now());
  if (!user) { res.status(401).json({ message: 'Entre para acessar sua conta.' }); return; }
  res.locals.user = user; next();
 };
 app.use('/api/orders', ordersRouter(db, authenticate));
 app.use('/api/products', productsRouter(db, authenticate));
 app.use('/api/me', profileRouter(db, authenticate, limiter, clearCookie));
 app.use('/api', (_req, res) => { res.status(404).json({ message: 'Rota não encontrada.' }); });
 app.use(express.static(resolve(backendRoot, '../frontend/dist')));
 app.get('/{*path}', (_req, res) => res.sendFile(resolve(backendRoot, '../frontend/dist/index.html')));
 app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { console.error(error); res.status(error instanceof SyntaxError ? 400 : 500).json({ message: error instanceof SyntaxError ? 'JSON inválido.' : 'Não foi possível concluir a solicitação.' }); });
 return app;
}
