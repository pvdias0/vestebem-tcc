import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

interface LoginPageProps {
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const { loginUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setError('Por favor, digite sua senha.');
      return;
    }

    try {
      setSubmitting(true);
      await loginUser(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao entrar. Verifique seus dados de acesso.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h1 className="card-title">Acesse sua conta</h1>
      <p className="card-subtitle">Entre com seus dados cadastrados na VesteBem</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="Ex.: seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Ainda não tem conta? </span>
        <button type="button" className="btn-link" onClick={onNavigateToRegister}>
          Cadastre-se
        </button>
      </div>
    </div>
  );
};
