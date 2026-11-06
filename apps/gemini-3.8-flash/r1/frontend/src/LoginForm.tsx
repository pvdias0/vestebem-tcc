import React, { useState } from 'react';
import { apiLogin } from './api';
import { User } from './types';

interface LoginProps {
  onSuccess: (user: User) => void;
  onNavigateToRegister: () => void;
}

export const LoginForm: React.FC<LoginProps> = ({ onSuccess, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    try {
      setLoading(true);
      const data = await apiLogin(email.trim(), password);
      onSuccess(data.user);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao tentar entrar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="card-title">Entrar</h2>
      <p className="card-subtitle">Acesse sua conta para continuar</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
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
          <label className="form-label" htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="switch-mode">
        Não tem uma conta?{' '}
        <button type="button" className="link-btn" onClick={onNavigateToRegister}>
          Cadastre-se
        </button>
      </p>
    </div>
  );
};
