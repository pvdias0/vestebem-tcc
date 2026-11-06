import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { config } from '../config.js';
import {
  User,
  SafeUser,
  Address,
  UpdateProfileInput,
  UpdateAddressInput,
  ChangePasswordInput,
  AuthTokenPayload,
} from '../types/user.js';

const SALT_ROUNDS = 12;

export class UserService {
  static getUserAddress(userId: number): Address | null {
    const stmt = db.prepare(`
      SELECT recipient, zip_code, street, number, complement, neighborhood, city, state
      FROM user_addresses
      WHERE user_id = ?
    `);
    const row = stmt.get(userId) as Address | undefined;
    return row || null;
  }

  static findByEmail(email: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
    const user = stmt.get(email.trim()) as User | undefined;
    if (user) {
      user.address = this.getUserAddress(user.id);
    }
    return user;
  }

  static findById(id: number): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id) as User | undefined;
    if (user) {
      user.address = this.getUserAddress(user.id);
    }
    return user;
  }

  static async createUser(name: string, email: string, passwordPlain: string): Promise<SafeUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    const existing = this.findByEmail(normalizedEmail);
    if (existing) {
      const error = new Error('Já existe uma conta cadastrada com este e-mail.');
      (error as any).statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(passwordPlain, SALT_ROUNDS);

    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'customer')
    `);

    const result = stmt.run(normalizedName, normalizedEmail, passwordHash);
    const userId = Number(result.lastInsertRowid);

    return {
      id: userId,
      name: normalizedName,
      email: normalizedEmail,
      role: 'customer',
      cpf: null,
      phone: null,
      address: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  static async authenticate(email: string, passwordPlain: string): Promise<SafeUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.findByEmail(normalizedEmail);

    if (!user) {
      const error = new Error('E-mail ou senha incorretos.');
      (error as any).statusCode = 401;
      throw error;
    }

    const match = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!match) {
      const error = new Error('E-mail ou senha incorretos.');
      (error as any).statusCode = 401;
      throw error;
    }

    const { password_hash: _, ...safeUser } = user;
    return safeUser;
  }

  static updateProfile(userId: number, input: UpdateProfileInput): SafeUser {
    const name = input.name.trim();
    if (!name) {
      const error = new Error('O nome não pode ficar vazio.');
      (error as any).statusCode = 400;
      throw error;
    }

    const cpf = input.cpf?.trim() || null;
    const phone = input.phone?.trim() || null;

    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, cpf = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name, cpf, phone, userId);
    const updated = this.findById(userId);
    const { password_hash: _, ...safeUser } = updated!;
    return safeUser;
  }

  static saveAddress(userId: number, input: UpdateAddressInput): Address {
    const recipient = input.recipient.trim();
    const zip_code = input.zip_code.trim();
    const street = input.street.trim();
    const number = input.number.trim();
    const complement = input.complement?.trim() || null;
    const neighborhood = input.neighborhood.trim();
    const city = input.city.trim();
    const state = input.state.trim().toUpperCase();

    if (!recipient) throw Object.assign(new Error('O destinatário é obrigatório.'), { statusCode: 400 });
    if (!zip_code) throw Object.assign(new Error('O CEP é obrigatório.'), { statusCode: 400 });
    if (!street) throw Object.assign(new Error('O logradouro é obrigatório.'), { statusCode: 400 });
    if (!number) throw Object.assign(new Error('O número é obrigatório.'), { statusCode: 400 });
    if (!neighborhood) throw Object.assign(new Error('O bairro é obrigatório.'), { statusCode: 400 });
    if (!city) throw Object.assign(new Error('A cidade é obrigatória.'), { statusCode: 400 });
    if (!state) throw Object.assign(new Error('O estado é obrigatório.'), { statusCode: 400 });

    const existing = db.prepare('SELECT id FROM user_addresses WHERE user_id = ?').get(userId);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE user_addresses
        SET recipient = ?, zip_code = ?, street = ?, number = ?, complement = ?,
            neighborhood = ?, city = ?, state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `);
      stmt.run(recipient, zip_code, street, number, complement, neighborhood, city, state, userId);
    } else {
      const stmt = db.prepare(`
        INSERT INTO user_addresses (user_id, recipient, zip_code, street, number, complement, neighborhood, city, state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(userId, recipient, zip_code, street, number, complement, neighborhood, city, state);
    }

    return this.getUserAddress(userId)!;
  }

  static async changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
    if (!user) {
      const error = new Error('Usuário não encontrado.');
      (error as any).statusCode = 404;
      throw error;
    }

    const currentMatches = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!currentMatches) {
      const error = new Error('A senha atual informada está incorreta.');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!input.newPassword || input.newPassword.length < 6) {
      const error = new Error('A nova senha deve ter pelo menos 6 caracteres.');
      (error as any).statusCode = 400;
      throw error;
    }

    const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, userId);
  }

  static generateToken(user: SafeUser): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: '1d',
    });
  }

  static verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  }
}
