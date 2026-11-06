import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

export function RegisterPage() {
  const { setUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFields({});
    setSending(true);
    try {
      setUser((await api.register(name, email, password)).user);
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFields(err.fields); }
      else setError('Erro inesperado.');
      setSending(false);
    }
  }

  return (
    <section className="card">
      <h1>Criar conta</h1>
      <form onSubmit={submit} noValidate>
        {error && <p className="alert" role="alert">{error}</p>}
        <label>Nome
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          {fields.name && <span className="field-error">{fields.name}</span>}
        </label>
        <label>E-mail
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {fields.email && <span className="field-error">{fields.email}</span>}
        </label>
        <label>Senha
          <input type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required />
          <span className={fields.password ? 'field-error' : 'hint'}>
            {fields.password ?? 'Mínimo de 8 caracteres.'}
          </span>
        </label>
        <button type="submit" disabled={sending}>{sending ? 'Criando…' : 'Criar conta'}</button>
      </form>
      <p className="muted">Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </section>
  );
}
