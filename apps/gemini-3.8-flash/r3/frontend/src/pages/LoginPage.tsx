import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';

interface LoginPageProps {
  onSuccess: () => void;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onGoToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor, informe sua senha.');
      return;
    }

    try {
      setSubmitting(true);
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h2>Entrar na conta</h2>
        <p>Acesse seu perfil na VesteBem com suas credenciais.</p>
      </div>

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="form-group">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            className="form-control"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            className="form-control"
            placeholder="Sua senha de acesso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="auth-footer">
        <span>Não tem uma conta?</span>{' '}
        <button type="button" className="btn-inline" onClick={onGoToRegister}>
          Cadastre-se
        </button>
      </div>
    </div>
  );
};
