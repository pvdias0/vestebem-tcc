import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/index';
import { generateToken } from '../middleware/auth';
import { SafeUser, UserRecord } from '../types';

export function register(req: Request, res: Response): void {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'O nome é obrigatório.' });
      return;
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      res.status(400).json({ error: 'O e-mail é obrigatório.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      res.status(400).json({ error: 'Formato de e-mail inválido.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      return;
    }

    const db = getDatabase();

    // Verificar unicidade de email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado em outra conta.' });
      return;
    }

    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'customer')
    `);

    const result = insertStmt.run(name.trim(), trimmedEmail, passwordHash);
    const userId = Number(result.lastInsertRowid);

    const selectStmt = db.prepare(`
      SELECT id, name, email, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state, created_at
      FROM users WHERE id = ?
    `);
    const newUser = selectStmt.get(userId) as unknown as SafeUser;

    const token = generateToken({ userId: newUser.id, email: newUser.email });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      user: newUser,
      token
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno ao processar cadastro.' });
  }
}

export function login(req: Request, res: Response): void {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const db = getDatabase();

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(trimmedEmail) as UserRecord | undefined;

    if (!user) {
      res.status(401).json({ error: 'Credenciais incorretas.' });
      return;
    }

    const isMatch = bcrypt.compareSync(String(password), user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Credenciais incorretas.' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cpf: user.cpf,
        phone: user.phone,
        recipient_name: user.recipient_name,
        cep: user.cep,
        street: user.street,
        number: user.number,
        complement: user.complement,
        neighborhood: user.neighborhood,
        city: user.city,
        state: user.state,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    sameSite: 'lax'
  });
  res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
}

export function getProfile(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  res.status(200).json({
    user: req.user
  });
}

export function updatePersonalInfo(req: Request, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const { name, cpf, phone } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'O nome é obrigatório.' });
      return;
    }

    const trimmedName = name.trim();
    const cleanCpf = cpf ? String(cpf).trim() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    const db = getDatabase();
    db.prepare(`
      UPDATE users
      SET name = ?, cpf = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(trimmedName, cleanCpf, cleanPhone, req.user.id);

    const updated = db.prepare(`
      SELECT id, name, email, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state, created_at
      FROM users WHERE id = ?
    `).get(req.user.id) as unknown as SafeUser;

    res.status(200).json({
      message: 'Dados pessoais atualizados com sucesso!',
      user: updated
    });
  } catch (error) {
    console.error('Erro ao atualizar dados pessoais:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar dados pessoais.' });
  }
}

export function updateAddress(req: Request, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const { recipient_name, cep, street, number, complement, neighborhood, city, state } = req.body;

    if (!recipient_name || !String(recipient_name).trim()) {
      res.status(400).json({ error: 'O nome do destinatário é obrigatório.' });
      return;
    }
    if (!cep || !String(cep).trim()) {
      res.status(400).json({ error: 'O CEP é obrigatório.' });
      return;
    }
    if (!street || !String(street).trim()) {
      res.status(400).json({ error: 'O logradouro é obrigatório.' });
      return;
    }
    if (!number || !String(number).trim()) {
      res.status(400).json({ error: 'O número é obrigatório.' });
      return;
    }
    if (!neighborhood || !String(neighborhood).trim()) {
      res.status(400).json({ error: 'O bairro é obrigatório.' });
      return;
    }
    if (!city || !String(city).trim()) {
      res.status(400).json({ error: 'A cidade é obrigatória.' });
      return;
    }
    if (!state || !String(state).trim()) {
      res.status(400).json({ error: 'O estado é obrigatório.' });
      return;
    }

    const db = getDatabase();
    db.prepare(`
      UPDATE users
      SET recipient_name = ?,
          cep = ?,
          street = ?,
          number = ?,
          complement = ?,
          neighborhood = ?,
          city = ?,
          state = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      String(recipient_name).trim(),
      String(cep).trim(),
      String(street).trim(),
      String(number).trim(),
      complement ? String(complement).trim() : null,
      String(neighborhood).trim(),
      String(city).trim(),
      String(state).trim().toUpperCase(),
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, name, email, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state, created_at
      FROM users WHERE id = ?
    `).get(req.user.id) as unknown as SafeUser;

    res.status(200).json({
      message: 'Endereço de entrega atualizado com sucesso!',
      user: updated
    });
  } catch (error) {
    console.error('Erro ao atualizar endereço:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar endereço.' });
  }
}

export function changePassword(req: Request, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'A nova senha deve conter no mínimo 6 caracteres.' });
      return;
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id) as { id: number; password_hash: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const isMatch = bcrypt.compareSync(String(currentPassword), user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'A senha atual informada está incorreta.' });
      return;
    }

    const saltRounds = 10;
    const newHash = bcrypt.hashSync(String(newPassword), saltRounds);

    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, req.user.id);

    res.status(200).json({
      message: 'Senha alterada com sucesso! Utilize a nova senha em seus próximos acessos.'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno ao alterar senha.' });
  }
}
