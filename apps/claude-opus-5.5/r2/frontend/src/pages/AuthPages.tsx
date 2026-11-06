import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError } from '../api';
import { useAuth } from '../auth';

function Field(props: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
}) {
  const id = `f-${props.name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        name={props.name}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        maxLength={props.maxLength}
        required
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-err` : undefined}
      />
      {props.error && <span id={`${id}-err`} className="field-error">{props.error}</span>}
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setFields({});
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else setError('Erro inesperado. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  return { error, fields, busy, run };
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, run } = useSubmit();

  if (!loading && user) return <Navigate to="/minha-conta" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const u = await login(email, password);
      navigate(u.role === 'employee' ? '/painel/pedidos' : '/', { replace: true });
    });
  };

  return (
    <section className="card">
      <h1>Entrar</h1>
      <form onSubmit={onSubmit} noValidate={false}>
        {error && <div className="alert" role="alert">{error}</div>}
        <Field label="E-mail" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Senha" name="password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="muted">Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </section>
  );
}

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, fields, busy, run } = useSubmit();

  if (!loading && user) return <Navigate to="/minha-conta" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await register(name, email, password);
      navigate('/minha-conta', { replace: true });
    });
  };

  return (
    <section className="card">
      <h1>Criar conta</h1>
      <form onSubmit={onSubmit}>
        {error && <div className="alert" role="alert">{error}</div>}
        <Field label="Nome" name="name" type="text" value={name} onChange={setName} autoComplete="name" minLength={2} maxLength={100} error={fields.name} />
        <Field label="E-mail" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" maxLength={254} error={fields.email} />
        <Field label="Senha (mínimo 8 caracteres)" name="password" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} maxLength={128} error={fields.password} />
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
      </form>
      <p className="muted">Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </section>
  );
}
