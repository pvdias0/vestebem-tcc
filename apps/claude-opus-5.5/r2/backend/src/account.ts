import type { Express, NextFunction, Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { hashPassword, verifyPassword } from './auth.js';
import type { SessionUser } from './orders.js';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
const text = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/** Valida CPF (11 dígitos + dígitos verificadores; rejeita sequências repetidas). */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Completa 9 dígitos-base com os dígitos verificadores (usado no seed). */
export function cpfWithCheckDigits(base9: string): string {
  let cpf = base9;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    cpf += String(r === 10 ? 0 : r);
  }
  return cpf;
}

export interface AddressInput {
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export function validateAddress(raw: unknown): { data: AddressInput } | { fields: Record<string, string> } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const data: AddressInput = {
    recipient: text(r.recipient),
    cep: digits(r.cep),
    street: text(r.street),
    number: text(r.number),
    complement: text(r.complement),
    district: text(r.district),
    city: text(r.city),
    state: text(r.state).toUpperCase(),
  };
  const f: Record<string, string> = {};
  if (data.recipient.length < 2 || data.recipient.length > 100) f.recipient = 'Informe o destinatário (2 a 100 caracteres).';
  if (data.cep.length !== 8) f.cep = 'Informe um CEP com 8 dígitos.';
  if (!data.street || data.street.length > 150) f.street = 'Informe o logradouro (até 150 caracteres).';
  if (!data.number || data.number.length > 20) f.number = 'Informe o número (use "S/N" se não houver).';
  if (data.complement.length > 100) f.complement = 'O complemento pode ter até 100 caracteres.';
  if (!data.district || data.district.length > 100) f.district = 'Informe o bairro.';
  if (!data.city || data.city.length > 100) f.city = 'Informe a cidade.';
  if (!UFS.includes(data.state)) f.state = 'Selecione o estado (UF).';
  return Object.keys(f).length ? { fields: f } : { data };
}

export function upsertAddress(db: DatabaseSync, userId: number, a: AddressInput) {
  db.prepare(
    `INSERT INTO addresses (user_id, recipient, cep, street, number, complement, district, city, state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET recipient = excluded.recipient, cep = excluded.cep, street = excluded.street,
       number = excluded.number, complement = excluded.complement, district = excluded.district,
       city = excluded.city, state = excluded.state, updated_at = excluded.updated_at`,
  ).run(userId, a.recipient, a.cep, a.street, a.number, a.complement, a.district, a.city, a.state, new Date().toISOString());
}

export interface AddressRow extends AddressInput {
  updated_at: string;
}

export function getAddress(db: DatabaseSync, userId: number) {
  const r = db
    .prepare('SELECT recipient, cep, street, number, complement, district, city, state, updated_at FROM addresses WHERE user_id = ?')
    .get(userId) as unknown as AddressRow | undefined;
  if (!r) return null;
  const { updated_at, ...rest } = r;
  return { ...rest, updatedAt: updated_at };
}

const sessionUser = (res: Response) => (res.locals as { user?: SessionUser; sessionTokenHash?: string });

export function registerAccountRoutes(app: Express, db: DatabaseSync) {
  const requireUser = (_req: Request, res: Response, next: NextFunction) => {
    if (!sessionUser(res).user) {
      res.status(401).json({ error: 'Você precisa entrar para acessar esta página.' });
      return;
    }
    next();
  };

  // Sempre opera sobre o usuário da sessão: não há id na rota, então ninguém acessa dados de outra conta.
  const accountPayload = (userId: number) => {
    const u = db.prepare('SELECT id, name, email, role, cpf, phone FROM users WHERE id = ?').get(userId) as {
      id: number; name: string; email: string; role: string; cpf: string | null; phone: string | null;
    };
    return {
      user: { id: u.id, name: u.name, email: u.email, role: u.role },
      profile: { name: u.name, cpf: u.cpf ?? '', phone: u.phone ?? '' },
      address: getAddress(db, userId),
    };
  };

  app.get('/api/account', requireUser, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(accountPayload(sessionUser(res).user!.id));
  });

  app.put('/api/account/profile', requireUser, (req, res) => {
    const userId = sessionUser(res).user!.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = text(body.name);
    const cpf = digits(body.cpf);
    const phone = digits(body.phone);
    const f: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) f.name = 'Informe um nome entre 2 e 100 caracteres.';
    if (cpf && !isValidCpf(cpf)) f.cpf = 'CPF inválido.';
    if (phone && (phone.length < 10 || phone.length > 11)) f.phone = 'Informe o telefone com DDD (10 ou 11 dígitos).';
    if (Object.keys(f).length) {
      res.status(400).json({ error: 'Verifique os campos informados.', fields: f });
      return;
    }
    try {
      db.prepare('UPDATE users SET name = ?, cpf = ?, phone = ? WHERE id = ?').run(name, cpf || null, phone || null, userId);
    } catch (err) {
      if (err instanceof Error && /UNIQUE/i.test(err.message)) {
        res.status(409).json({ error: 'Este CPF já está cadastrado em outra conta.', fields: { cpf: 'CPF já cadastrado.' } });
        return;
      }
      throw err;
    }
    res.json(accountPayload(userId));
  });

  app.put('/api/account/address', requireUser, (req, res) => {
    const userId = sessionUser(res).user!.id;
    const v = validateAddress(req.body);
    if ('fields' in v) {
      res.status(400).json({ error: 'Verifique os campos do endereço.', fields: v.fields });
      return;
    }
    upsertAddress(db, userId, v.data);
    res.json(accountPayload(userId));
  });

  app.put('/api/account/password', requireUser, async (req, res) => {
    const { user, sessionTokenHash } = sessionUser(res);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const next = typeof body.newPassword === 'string' ? body.newPassword : '';
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user!.id) as { password_hash: string };
    if (!current || !(await verifyPassword(current, row.password_hash))) {
      res.status(400).json({ error: 'A senha atual está incorreta.', fields: { currentPassword: 'Senha atual incorreta.' } });
      return;
    }
    if (next.length < 8 || next.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter entre 8 e 128 caracteres.', fields: { newPassword: 'Entre 8 e 128 caracteres.' } });
      return;
    }
    if (next === current) {
      res.status(400).json({ error: 'A nova senha deve ser diferente da atual.', fields: { newPassword: 'Use uma senha diferente da atual.' } });
      return;
    }
    const hash = await hashPassword(next);
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user!.id);
      // Encerra as demais sessões da conta; a sessão atual continua ativa.
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user!.id, sessionTokenHash ?? '');
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json({ ok: true });
  });
}
