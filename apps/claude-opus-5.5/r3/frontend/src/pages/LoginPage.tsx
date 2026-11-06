import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

export function LoginPage() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      setUser((await api.login(email, password)).user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado.');
      setSending(false);
    }
  }

  return (
    <section className="card">
      <h1>Entrar</h1>
      <form onSubmit={submit} noValidate>
        {error && <p className="alert" role="alert">{error}</p>}
        <label>E-mail
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Senha
          <input type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={sending}>{sending ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="muted">Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </section>
  );
}
