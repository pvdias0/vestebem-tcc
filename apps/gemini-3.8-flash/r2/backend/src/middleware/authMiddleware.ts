import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService.js';
import { SafeUser, UserRole } from '../types/user.js';
import { config } from '../config.js';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.cookieName] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ message: 'Acesso não autorizado. Faça login para continuar.' });
    return;
  }

  try {
    const payload = UserService.verifyToken(token);
    const user = UserService.findById(payload.userId);

    if (!user) {
      res.status(401).json({ message: 'Sessão inválida. Usuário não encontrado.' });
      return;
    }

    const { password_hash: _, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Sessão expirada ou inválida. Por favor, entre novamente.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Acesso não autorizado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Acesso negado. Perfil não autorizado para esta operação.' });
      return;
    }

    next();
  };
}
