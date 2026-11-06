import { Request, Response, NextFunction } from 'express';

export function requireRole(allowedRoles: ('customer' | 'employee')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Você não tem permissão para realizar esta ação.' });
      return;
    }

    next();
  };
}
