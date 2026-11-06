import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';

interface RegisterPageProps {
  onSuccess: () => void;
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess, onGoToLogin }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Por favor, informe seu nome.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      await register(name, email, password);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h2>Criar conta</h2>
        <p>Preencha os dados abaixo para se cadastrar na VesteBem.</p>
      </div>

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="form-group">
          <label htmlFor="reg-name">Nome completo</label>
          <input
            id="reg-name"
            type="text"
            className="form-control"
            placeholder="Ex.: Maria Souza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-email">E-mail</label>
          <input
            id="reg-email"
            type="email"
            className="form-control"
            placeholder="Ex.: maria@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-password">Senha</label>
          <input
            id="reg-password"
            type="password"
            className="form-control"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      <div className="auth-footer">
        <span>Já possui uma conta?</span>{' '}
        <button type="button" className="btn-inline" onClick={onGoToLogin}>
          Entrar
        </button>
      </div>
    </div>
  );
};
