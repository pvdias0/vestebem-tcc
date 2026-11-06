import type { DatabaseSync } from 'node:sqlite';
import express, { type Request, type Response } from 'express';
import type { PublicUser } from './app.ts';
import { hashPassword, verifyPassword } from './security.ts';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Valida CPF pelos dígitos verificadores (11 dígitos, sem sequências repetidas). */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/** Telefone brasileiro com DDD: 10 (fixo) ou 11 dígitos (celular, começando com 9). */
export function isValidPhone(phone: string): boolean {
  return /^[1-9][1-9]\d{8}$/.test(phone) || /^[1-9][1-9]9\d{8}$/.test(phone);
}

export interface AddressInput {
  recipient: string; cep: string; street: string; number: string; complement: string | null;
  district: string; city: string; state: string;
}

export function validateAddress(body: unknown): { address: AddressInput } | { fields: Record<string, string> } {
  const o = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const a: AddressInput = {
    recipient: str(o.recipient), cep: digits(o.cep), street: str(o.street), number: str(o.number),
    complement: str(o.complement) || null, district: str(o.district), city: str(o.city), state: str(o.state).toUpperCase(),
  };
  const f: Record<string, string> = {};
  const req = (k: keyof AddressInput, label: string, max: number) => {
    const v = a[k] ?? '';
    if (v.length < 1 || v.length > max) f[k] = `Informe ${label} (até ${max} caracteres).`;
  };
  req('recipient', 'o destinatário', 100);
  if (a.cep.length !== 8) f.cep = 'O CEP deve ter 8 dígitos.';
  req('street', 'o logradouro', 150);
  req('number', 'o número', 20);
  if (a.complement && a.complement.length > 100) f.complement = 'O complemento pode ter até 100 caracteres.';
  req('district', 'o bairro', 100);
  req('city', 'a cidade', 100);
  if (!(UFS as readonly string[]).includes(a.state)) f.state = 'Selecione um estado válido.';
  return Object.keys(f).length ? { fields: f } : { address: a };
}

export function toAddress(r: Record<string, unknown> | undefined) {
  if (!r) return null;
  return {
    recipient: String(r.recipient), cep: String(r.cep), street: String(r.street), number: String(r.number),
    complement: r.complement === null ? null : String(r.complement), district: String(r.district),
    city: String(r.city), state: String(r.state),
  };
}

export function accountRouter(db: DatabaseSync, currentTokenHash: (req: Request) => string | undefined) {
  const router = express.Router();
  const stmt = {
    profile: db.prepare('SELECT id, name, email, role, cpf, phone FROM users WHERE id = ?'),
    address: db.prepare('SELECT * FROM addresses WHERE user_id = ?'),
    cpfOwner: db.prepare('SELECT id FROM users WHERE cpf = ? AND id <> ?'),
    updateProfile: db.prepare('UPDATE users SET name = ?, cpf = ?, phone = ? WHERE id = ?'),
    upsertAddress: db.prepare(`INSERT INTO addresses (user_id, recipient, cep, street, number, complement, district, city, state, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET recipient = excluded.recipient, cep = excluded.cep, street = excluded.street,
        number = excluded.number, complement = excluded.complement, district = excluded.district, city = excluded.city,
        state = excluded.state, updated_at = excluded.updated_at`),
    passwordHash: db.prepare('SELECT password_hash FROM users WHERE id = ?'),
    setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    dropOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
  };

  const me = (res: Response) => res.locals.user as PublicUser;

  /** Conta completa do próprio usuário (inclui CPF; nunca a senha). */
  function load(id: number) {
    const u = stmt.profile.get(id)!;
    return {
      user: {
        id: Number(u.id), name: String(u.name), email: String(u.email),
        role: u.role === 'funcionario' ? 'funcionario' as const : 'cliente' as const,
        cpf: u.cpf === null ? null : String(u.cpf), phone: u.phone === null ? null : String(u.phone),
      },
      address: toAddress(stmt.address.get(id)),
    };
  }

  router.get('/', (_req, res) => { res.json(load(me(res).id)); });

  router.put('/profile', (req, res) => {
    const u = me(res);
    const name = str(req.body?.name);
    const cpf = digits(req.body?.cpf);
    const phone = digits(req.body?.phone);
    const f: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) f.name = 'Informe um nome entre 2 e 100 caracteres.';
    if (cpf && !isValidCpf(cpf)) f.cpf = 'CPF inválido.';
    else if (cpf && stmt.cpfOwner.get(cpf, u.id)) f.cpf = 'Este CPF já está cadastrado em outra conta.';
    if (phone && !isValidPhone(phone)) f.phone = 'Informe um telefone com DDD (10 ou 11 dígitos).';
    if (Object.keys(f).length) { res.status(400).json({ error: 'Verifique os dados informados.', fields: f }); return; }
    stmt.updateProfile.run(name, cpf || null, phone || null, u.id);
    res.json(load(u.id));
  });

  router.put('/address', (req, res) => {
    const v = validateAddress(req.body);
    if ('fields' in v) { res.status(400).json({ error: 'Verifique o endereço informado.', fields: v.fields }); return; }
    const a = v.address;
    stmt.upsertAddress.run(me(res).id, a.recipient, a.cep, a.street, a.number, a.complement, a.district, a.city, a.state,
      new Date().toISOString());
    res.json(load(me(res).id));
  });

  router.put('/password', async (req, res) => {
    const u = me(res);
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const stored = String(stmt.passwordHash.get(u.id)!.password_hash);
    if (!(await verifyPassword(current, stored))) {
      res.status(400).json({ error: 'A senha atual está incorreta.', fields: { currentPassword: 'Senha atual incorreta.' } });
      return;
    }
    if (next.length < 8 || next.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter entre 8 e 128 caracteres.', fields: { newPassword: 'Entre 8 e 128 caracteres.' } });
      return;
    }
    if (next === current) {
      res.status(400).json({ error: 'A nova senha deve ser diferente da atual.', fields: { newPassword: 'Igual à senha atual.' } });
      return;
    }
    stmt.setPassword.run(await hashPassword(next), u.id);
    // Encerra as outras sessões desta conta; a sessão atual continua ativa.
    stmt.dropOtherSessions.run(u.id, currentTokenHash(req) ?? '');
    res.status(204).end();
  });

  return router;
}
