import React, { useState } from 'react';
import { apiRegister } from './api';
import { User } from './types';

interface RegisterProps {
  onSuccess: (user: User) => void;
  onNavigateToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterProps> = ({ onSuccess, onNavigateToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRegister(name.trim(), email.trim(), password);
      onSuccess(data.user);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro inesperado ao realizar cadastro.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="card-title">Criar Conta</h2>
      <p className="card-subtitle">Cadastre-se para comprar na VesteBem</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">Nome Completo</label>
          <input
            id="register-name"
            className="form-input"
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-email">E-mail</label>
          <input
            id="register-email"
            className="form-input"
            type="email"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-password">Senha</label>
          <input
            id="register-password"
            className="form-input"
            type="password"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      <p className="switch-mode">
        Já possui uma conta?{' '}
        <button type="button" className="link-btn" onClick={onNavigateToLogin}>
          Faça login
        </button>
      </p>
    </div>
  );
};
