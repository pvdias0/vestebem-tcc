import type { Request, Response, NextFunction } from 'express';
import { findUserBySessionToken, type UserProfileResponse } from '../services/user.service.js';

export interface AuthenticatedRequest extends Request {
  user?: UserProfileResponse;
  sessionToken?: string;
}

export function extractSessionToken(req: Request): string | null {
  // Check cookie first
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }
  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
    return;
  }

  const user = findUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permissão negada. Perfil sem autorização para esta operação.' });
      return;
    }

    next();
  };
}
