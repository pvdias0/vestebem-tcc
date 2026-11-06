import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const { registerUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      await registerUser(name, email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao realizar cadastro. Verifique os dados e tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h1 className="card-title">Criar conta</h1>
      <p className="card-subtitle">Cadastre-se para aproveitar as vantagens da VesteBem</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">
            Nome completo
          </label>
          <input
            id="register-name"
            type="text"
            className="form-input"
            placeholder="Ex.: Maria Souza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-email">
            E-mail
          </label>
          <input
            id="register-email"
            type="email"
            className="form-input"
            placeholder="Ex.: maria@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-password">
            Senha (mínimo de 6 caracteres)
          </label>
          <input
            id="register-password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Já tem uma conta? </span>
        <button type="button" className="btn-link" onClick={onNavigateToLogin}>
          Entrar
        </button>
      </div>
    </div>
  );
};
