import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../db/index';
import { AuthTokenPayload, SafeUser } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'vestebem_secure_jwt_secret_token_12345';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Ler token do cookie httpOnly ou do header Authorization (Bearer <token>)
  let token: string | undefined = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const db = getDatabase();
    const statement = db.prepare(`
      SELECT id, name, email, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state, created_at
      FROM users
      WHERE id = ?
    `);
    const user = statement.get(decoded.userId) as unknown as SafeUser | undefined;

    if (!user) {
      res.status(401).json({ error: 'Sessão inválida. Usuário não encontrado.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
  }
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
