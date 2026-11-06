import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword, hashToken, newSessionToken, verifyPassword } from './auth.js';
import { registerOrderRoutes, type SessionUser } from './orders.js';
import { registerProductRoutes } from './products.js';
import { registerAccountRoutes } from './account.js';

export const SESSION_COOKIE = 'vb_session';
const SESSION_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash fixo usado quando o e-mail não existe, para igualar o tempo de resposta.
const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

type PublicUser = SessionUser;
interface UserRow extends PublicUser {
  password_hash: string;
}
interface AuthLocals {
  user?: PublicUser;
  sessionTokenHash?: string;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const auth = (res: Response): AuthLocals => res.locals as AuthLocals;

export interface AppOptions {
  staticDir?: string;
  secureCookies?: boolean;
}

export function createApp(db: DatabaseSync, opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: opts.secureCookies ?? false,
    path: '/',
  };

  // Identifica o usuário pelo cookie de sessão (token aleatório; no banco só fica o hash).
  app.use((req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      const tokenHash = hashToken(token);
      const row = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?`,
        )
        .get(tokenHash, new Date().toISOString()) as unknown as PublicUser | undefined;
      if (row) {
        auth(res).user = { id: row.id, name: row.name, email: row.email, role: row.role };
        auth(res).sessionTokenHash = tokenHash;
      }
    }
    next();
  });

  function requireAuth(_req: Request, res: Response, next: NextFunction) {
    if (!auth(res).user) {
      res.status(401).json({ error: 'Você precisa entrar para acessar esta página.' });
      return;
    }
    next();
  }

  function startSession(res: Response, userId: number) {
    const token = newSessionToken();
    const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      hashToken(token),
      userId,
      expires.toISOString(),
    );
    res.cookie(SESSION_COOKIE, token, { ...cookieOpts, expires });
  }

  function endCurrentSession(res: Response) {
    const h = auth(res).sessionTokenHash;
    if (h) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
  }

  app.post('/api/auth/register', async (req, res) => {
    const name = str(req.body?.name).trim();
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    const fields: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) fields.name = 'Informe um nome entre 2 e 100 caracteres.';
    if (!EMAIL_RE.test(email) || email.length > 254) fields.email = 'Informe um e-mail válido.';
    if (password.length < 8 || password.length > 128) fields.password = 'A senha deve ter entre 8 e 128 caracteres.';
    if (Object.keys(fields).length) {
      res.status(400).json({ error: 'Verifique os campos informados.', fields });
      return;
    }
    const passwordHash = await hashPassword(password);
    try {
      // O papel nunca vem do cliente: o cadastro público sempre cria 'customer'.
      const result = db
        .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')")
        .run(name, email, passwordHash);
      const id = Number(result.lastInsertRowid);
      endCurrentSession(res);
      startSession(res, id);
      res.status(201).json({ user: { id, name, email, role: 'customer' } });
    } catch (err) {
      if (err instanceof Error && /UNIQUE/i.test(err.message)) {
        res.status(409).json({ error: 'Já existe uma conta com este e-mail.', fields: { email: 'E-mail já cadastrado.' } });
        return;
      }
      throw err;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    const row = db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?').get(email) as unknown as
      | UserRow
      | undefined;
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }
    endCurrentSession(res);
    startSession(res, row.id);
    res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  });

  app.post('/api/auth/logout', (_req, res) => {
    endCurrentSession(res);
    res.clearCookie(SESSION_COOKIE, cookieOpts);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ user: auth(res).user });
  });

  registerOrderRoutes(app, db);
  registerProductRoutes(app, db);
  registerAccountRoutes(app, db);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(express.static(dir));
    app.get('/{*path}', (_req, res) => res.sendFile(join(dir, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Requisição inválida.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}
