import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import express, { type NextFunction, type Request, type Response } from 'express';
import { accountRouter } from './account.ts';
import { ordersRouter } from './orders.ts';
import { productsRouter } from './products.ts';
import { hashPassword, hashToken, newSessionToken, verifyPassword } from './security.ts';

export interface AppOptions {
  db: DatabaseSync;
  sessionDays: number;
  cookieSecure: boolean;
  frontendDist?: string;
}

export type Role = 'cliente' | 'funcionario';
export interface PublicUser { id: number; name: string; email: string; role: Role }

const COOKIE = 'vb_session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash fictício: o login com e-mail inexistente leva o mesmo tempo que um com senha errada.
const DUMMY_HASH = await hashPassword('senha-ficticia-para-tempo-constante');

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(v.join('=')); } catch { return undefined; }
    }
  }
  return undefined;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toPublicUser(row: Record<string, unknown>): PublicUser {
  return {
    id: Number(row.id), name: String(row.name), email: String(row.email),
    role: row.role === 'funcionario' ? 'funcionario' : 'cliente',
  };
}

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const stmt = {
    findUserByEmail: db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?'),
    insertUser: db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'cliente')"),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    findSession: db.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s
      JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  };

  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: opts.cookieSecure, path: '/' };

  function startSession(res: Response, userId: number) {
    stmt.purgeExpired.run(new Date().toISOString());
    const token = newSessionToken();
    const maxAgeMs = opts.sessionDays * 24 * 60 * 60 * 1000;
    stmt.insertSession.run(hashToken(token), userId, new Date(Date.now() + maxAgeMs).toISOString());
    res.cookie(COOKIE, token, { ...cookieOpts, maxAge: maxAgeMs });
  }

  function currentUser(req: Request): PublicUser | undefined {
    const token = readCookie(req, COOKIE);
    if (!token) return undefined;
    const row = stmt.findSession.get(hashToken(token), new Date().toISOString());
    return row ? toPublicUser(row) : undefined;
  }

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const user = currentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Você precisa entrar para acessar esta página.' });
      return;
    }
    res.locals.user = user;
    next();
  }

  const duplicate = { error: 'Já existe uma conta com este e-mail.', fields: { email: 'E-mail já cadastrado.' } };

  const api = express.Router();
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.post('/auth/register', async (req, res) => {
    const name = asString(req.body?.name).trim();
    const email = asString(req.body?.email).trim().toLowerCase();
    const password = asString(req.body?.password);
    const fields: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) fields.name = 'Informe um nome entre 2 e 100 caracteres.';
    if (!EMAIL_RE.test(email) || email.length > 254) fields.email = 'Informe um e-mail válido.';
    if (password.length < 8 || password.length > 128) fields.password = 'A senha deve ter entre 8 e 128 caracteres.';
    if (Object.keys(fields).length) {
      res.status(400).json({ error: 'Verifique os dados informados.', fields });
      return;
    }
    if (stmt.findUserByEmail.get(email)) {
      res.status(409).json(duplicate);
      return;
    }
    const hash = await hashPassword(password);
    let id: number;
    try {
      id = Number(stmt.insertUser.run(name, email, hash).lastInsertRowid);
    } catch (err) {
      // Corrida entre dois cadastros simultâneos: a restrição UNIQUE do banco decide.
      if (String((err as Error).message).includes('UNIQUE')) {
        res.status(409).json(duplicate);
        return;
      }
      throw err;
    }
    startSession(res, id);
    res.status(201).json({ user: { id, name, email, role: 'cliente' } satisfies PublicUser });
  });

  api.post('/auth/login', async (req, res) => {
    const email = asString(req.body?.email).trim().toLowerCase();
    const password = asString(req.body?.password);
    const row = email ? stmt.findUserByEmail.get(email) : undefined;
    const ok = await verifyPassword(password, row ? String(row.password_hash) : DUMMY_HASH);
    if (!row || !ok) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }
    // Encerra a sessão anterior deste navegador, se houver.
    const old = readCookie(req, COOKIE);
    if (old) stmt.deleteSession.run(hashToken(old));
    const user = toPublicUser(row);
    startSession(res, user.id);
    res.json({ user });
  });

  api.post('/auth/logout', (req, res) => {
    const token = readCookie(req, COOKIE);
    if (token) stmt.deleteSession.run(hashToken(token));
    res.clearCookie(COOKIE, cookieOpts);
    res.status(204).end();
  });

  api.use('/account', requireAuth, accountRouter(db, (req) => {
    const token = readCookie(req, COOKIE);
    return token ? hashToken(token) : undefined;
  }));

  api.use('/orders', requireAuth, ordersRouter(db));
  api.use('/products', productsRouter(db, requireAuth));

  api.use((_req, res) => { res.status(404).json({ error: 'Recurso não encontrado.' }); });

  app.use('/api', api);

  if (opts.frontendDist && fs.existsSync(path.join(opts.frontendDist, 'index.html'))) {
    const dist = opts.frontendDist;
    app.use(express.static(dist, { index: false }));
    app.get('/{*splat}', (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: 'Requisição inválida.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  });

  return app;
}
