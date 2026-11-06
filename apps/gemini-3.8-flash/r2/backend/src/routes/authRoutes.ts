import { Router, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { config } from '../config.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres.'),
  email: z.string().email('Forneça um endereço de e-mail válido.'),
  password: z.string().min(6, 'A senha deve conter pelo menos 6 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().email('Forneça um endereço de e-mail válido.'),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres.'),
  cpf: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

const updateAddressSchema = z.object({
  recipient: z.string().min(1, 'O destinatário é obrigatório.'),
  zip_code: z.string().min(1, 'O CEP é obrigatório.'),
  street: z.string().min(1, 'O logradouro é obrigatório.'),
  number: z.string().min(1, 'O número é obrigatório.'),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().min(1, 'O bairro é obrigatório.'),
  city: z.string().min(1, 'A cidade é obrigatória.'),
  state: z.string().min(2, 'O estado é obrigatório.'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'A senha atual é obrigatória.'),
  newPassword: z.string().min(6, 'A nova senha deve conter pelo menos 6 caracteres.'),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

// POST /api/auth/register
authRouter.post('/register', async (req, res, next) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const { name, email, password } = parseResult.data;
    const user = await UserService.createUser(name, email, password);
    const token = UserService.generateToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Cadastro realizado com sucesso.',
      user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const { email, password } = parseResult.data;
    const user = await UserService.authenticate(email, password);
    const token = UserService.generateToken(user);
    setAuthCookie(res, token);

    res.status(200).json({
      message: 'Login realizado com sucesso.',
      user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
});

// GET /api/auth/me - Dados do próprio usuário autenticado (incluindo CPF e endereço)
authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    user: req.user,
  });
});

// PUT /api/auth/profile - Atualizar nome, CPF e telefone do próprio usuário
authRouter.put('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const updatedUser = UserService.updateProfile(req.user!.id, parseResult.data);
    res.json({
      message: 'Dados pessoais atualizados com sucesso.',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/address - Cadastrar ou atualizar endereço de entrega
authRouter.put('/address', authMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parseResult = updateAddressSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Endereço inválido.',
      });
      return;
    }

    const address = UserService.saveAddress(req.user!.id, parseResult.data);
    res.json({
      message: 'Endereço de entrega salvo com sucesso.',
      address,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/change-password - Alterar senha com senha atual e nova senha
authRouter.put('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados de senha inválidos.',
      });
      return;
    }

    await UserService.changePassword(req.user!.id, parseResult.data);
    res.json({
      message: 'Senha alterada com sucesso.',
    });
  } catch (error) {
    next(error);
  }
});
