import { Router, type Response } from 'express';
import {
  registerUser,
  loginUser,
  deleteSessionByToken,
  updatePersonalInfo,
  updateAddress,
  changePassword,
} from '../services/user.service.js';
import { requireAuth, extractSessionToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const authRouter = Router();

function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// POST /api/auth/register
authRouter.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { user, sessionToken, expiresAt } = registerUser(name, email, password);
    setSessionCookie(res, sessionToken, expiresAt);
    res.status(201).json({ user, token: sessionToken });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao realizar cadastro.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, sessionToken, expiresAt } = loginUser(email, password);
    setSessionCookie(res, sessionToken, expiresAt);
    res.status(200).json({ user, token: sessionToken });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao realizar login.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.status(200).json({ user: req.user });
});

// PUT /api/auth/profile - Atualiza nome, CPF e telefone
authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = updatePersonalInfo(req.user!.id, req.body);
    res.status(200).json({ user: updated, message: 'Dados pessoais atualizados com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao atualizar dados pessoais.' });
  }
});

// PUT /api/auth/address - Cadastra/atualiza endereço de entrega
authRouter.put('/address', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = updateAddress(req.user!.id, req.body);
    res.status(200).json({ user: updated, message: 'Endereço atualizado com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao atualizar endereço.' });
  }
});

// POST /api/auth/password - Alterar senha com verificação da senha atual
authRouter.post('/password', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    changePassword(req.user!.id, currentPassword, newPassword);
    res.status(200).json({ message: 'Senha alterada com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao alterar senha.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: AuthenticatedRequest, res) => {
  const token = extractSessionToken(req);
  if (token) {
    deleteSessionByToken(token);
  }
  clearSessionCookie(res);
  res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
});
