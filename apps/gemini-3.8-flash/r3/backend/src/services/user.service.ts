import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from './auth.service.js';

export interface UserAddress {
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  cpf: string | null;
  phone: string | null;
  address: UserAddress | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  cpf?: string;
  phone?: string;
}

export interface UpdateAddressInput {
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  cpf?: string | null;
  phone?: string | null;
  recipient_name?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function rowToUserProfile(row: UserRow): UserProfileResponse {
  let address: UserAddress | null = null;
  if (row.recipient_name && row.cep && row.street && row.number && row.neighborhood && row.city && row.state) {
    address = {
      recipientName: row.recipient_name,
      cep: row.cep,
      street: row.street,
      number: row.number,
      complement: row.complement || '',
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    };
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    cpf: row.cpf || null,
    phone: row.phone || null,
    address,
    createdAt: row.created_at,
  };
}

export function registerUser(name: string, email: string, password: string): { user: UserProfileResponse; sessionToken: string; expiresAt: Date } {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    throw new Error('O nome é obrigatório.');
  }
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('E-mail inválido.');
  }
  if (!password || password.length < 6) {
    throw new Error('A senha deve conter no mínimo 6 caracteres.');
  }

  // Check unique email
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existingUser) {
    const error: any = new Error('Este e-mail já está cadastrado.');
    error.status = 409;
    throw error;
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  // Always creates 'customer' role
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'customer', ?, ?)
  `).run(userId, trimmedName, normalizedEmail, passwordHash, now, now);

  const session = createSession(userId);

  return {
    user: {
      id: userId,
      name: trimmedName,
      email: normalizedEmail,
      role: 'customer',
      cpf: null,
      phone: null,
      address: null,
      createdAt: now,
    },
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export function loginUser(email: string, password: string): { user: UserProfileResponse; sessionToken: string; expiresAt: Date } {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const error: any = new Error('E-mail e senha são obrigatórios.');
    error.status = 400;
    throw error;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as UserRow | undefined;
  if (!userRow) {
    const error: any = new Error('E-mail ou senha incorretos.');
    error.status = 401;
    throw error;
  }

  const passwordValid = verifyPassword(password, userRow.password_hash);
  if (!passwordValid) {
    const error: any = new Error('E-mail ou senha incorretos.');
    error.status = 401;
    throw error;
  }

  const session = createSession(userRow.id);

  return {
    user: rowToUserProfile(userRow),
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export function createSession(userId: string): { sessionId: string; token: string; expiresAt: Date } {
  const sessionId = crypto.randomUUID();
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, tokenHash, expiresAt.toISOString());

  return {
    sessionId,
    token: rawToken,
    expiresAt,
  };
}

export function findUserBySessionToken(rawToken: string): UserProfileResponse | null {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const nowIso = new Date().toISOString();

  const session = db.prepare(`
    SELECT * FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).get(tokenHash, nowIso) as SessionRow | undefined;

  if (!session) {
    return null;
  }

  const userRow = db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(session.user_id) as UserRow | undefined;

  if (!userRow) {
    return null;
  }

  return rowToUserProfile(userRow);
}

export function deleteSessionByToken(rawToken: string): void {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function updatePersonalInfo(userId: string, input: UpdateProfileInput): UserProfileResponse {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!userRow) {
    const error: any = new Error('Usuário não encontrado.');
    error.status = 404;
    throw error;
  }

  const newName = input.name !== undefined ? input.name.trim() : userRow.name;
  if (!newName) {
    const error: any = new Error('O nome não pode ser vazio.');
    error.status = 400;
    throw error;
  }

  const newCpf = input.cpf !== undefined ? input.cpf.trim() : (userRow.cpf || null);
  const newPhone = input.phone !== undefined ? input.phone.trim() : (userRow.phone || null);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET name = ?, cpf = ?, phone = ?, updated_at = ?
    WHERE id = ?
  `).run(newName, newCpf || null, newPhone || null, now, userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
  return rowToUserProfile(updated);
}

export function updateAddress(userId: string, input: UpdateAddressInput): UserProfileResponse {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!userRow) {
    const error: any = new Error('Usuário não encontrado.');
    error.status = 404;
    throw error;
  }

  const recipientName = (input.recipientName || '').trim();
  const cep = (input.cep || '').trim();
  const street = (input.street || '').trim();
  const number = (input.number || '').trim();
  const complement = (input.complement || '').trim();
  const neighborhood = (input.neighborhood || '').trim();
  const city = (input.city || '').trim();
  const state = (input.state || '').trim();

  if (!recipientName) {
    const error: any = new Error('O nome do destinatário é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!cep) {
    const error: any = new Error('O CEP é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!street) {
    const error: any = new Error('O logradouro é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!number) {
    const error: any = new Error('O número é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!neighborhood) {
    const error: any = new Error('O bairro é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!city) {
    const error: any = new Error('A cidade é obrigatória.');
    error.status = 400;
    throw error;
  }
  if (!state) {
    const error: any = new Error('O estado é obrigatório.');
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET recipient_name = ?, cep = ?, street = ?, number = ?, complement = ?,
        neighborhood = ?, city = ?, state = ?, updated_at = ?
    WHERE id = ?
  `).run(recipientName, cep, street, number, complement, neighborhood, city, state, now, userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
  return rowToUserProfile(updated);
}

export function changePassword(userId: string, currentPassword: string, newPassword: string): void {
  if (!currentPassword || !newPassword) {
    const error: any = new Error('Informe a senha atual e a nova senha.');
    error.status = 400;
    throw error;
  }

  if (newPassword.length < 6) {
    const error: any = new Error('A nova senha deve conter no mínimo 6 caracteres.');
    error.status = 400;
    throw error;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!userRow) {
    const error: any = new Error('Usuário não encontrado.');
    error.status = 404;
    throw error;
  }

  const valid = verifyPassword(currentPassword, userRow.password_hash);
  if (!valid) {
    const error: any = new Error('A senha atual informada está incorreta.');
    error.status = 401;
    throw error;
  }

  const newHash = hashPassword(newPassword);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = ?
    WHERE id = ?
  `).run(newHash, now, userId);
}
