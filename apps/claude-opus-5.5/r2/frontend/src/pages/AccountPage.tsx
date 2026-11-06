import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { api, ApiError, type Account, type AddressInput } from '../api';
import { useAuth } from '../auth';
import { formatCep, formatCpf, formatPhone, UFS } from '../format';

type Fields = Record<string, string>;

/** Estado comum de cada formulário: mensagem de sucesso/erro e erros por campo. */
function useFormStatus() {
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setOk('');
    setError('');
    setFields({});
    try {
      setOk(await fn());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else setError('Erro inesperado. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  return { ok, error, fields, busy, run };
}

function Messages({ ok, error }: { ok: string; error: string }) {
  return (
    <>
      {ok && <div className="success" role="status">{ok}</div>}
      {error && <div className="alert" role="alert">{error}</div>}
    </>
  );
}

function Input(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  maxLength?: number;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        aria-invalid={props.error ? true : undefined}
      />
      {props.error && <span className="field-error">{props.error}</span>}
    </div>
  );
}

function ProfileForm({ account, onSaved }: { account: Account; onSaved: (a: Account) => void }) {
  const [name, setName] = useState(account.profile.name);
  const [cpf, setCpf] = useState(formatCpf(account.profile.cpf));
  const [phone, setPhone] = useState(formatPhone(account.profile.phone));
  const st = useFormStatus();
  const { refresh } = useAuth();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void st.run(async () => {
      const a = await api.updateProfile({ name, cpf, phone });
      setCpf(formatCpf(a.profile.cpf));
      setPhone(formatPhone(a.profile.phone));
      onSaved(a);
      await refresh();
      return 'Dados pessoais atualizados com sucesso.';
    });
  };

  return (
    <form onSubmit={submit} className="account-section" noValidate>
      <h2>Dados pessoais</h2>
      <Messages ok={st.ok} error={st.error} />
      <p className="muted small-text">E-mail: {account.user.email}</p>
      <Input id="pf-name" label="Nome" value={name} onChange={setName} autoComplete="name" maxLength={100} error={st.fields.name} />
      <div className="form-grid">
        <Input id="pf-cpf" label="CPF" value={cpf} onChange={setCpf} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" error={st.fields.cpf} />
        <Input id="pf-phone" label="Telefone (com DDD)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" maxLength={16} placeholder="(00) 00000-0000" error={st.fields.phone} />
      </div>
      <button type="submit" className="btn btn-inline" disabled={st.busy}>{st.busy ? 'Salvando…' : 'Salvar dados pessoais'}</button>
    </form>
  );
}

const emptyAddress: AddressInput = { recipient: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' };

function AddressForm({ account, onSaved }: { account: Account; onSaved: (a: Account) => void }) {
  const initial = account.address ? { ...account.address, cep: formatCep(account.address.cep) } : { ...emptyAddress, recipient: account.profile.name };
  const [form, setForm] = useState<AddressInput>({
    recipient: initial.recipient, cep: initial.cep, street: initial.street, number: initial.number,
    complement: initial.complement, district: initial.district, city: initial.city, state: initial.state,
  });
  const st = useFormStatus();
  const set = (k: keyof AddressInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void st.run(async () => {
      const a = await api.updateAddress(form);
      setForm((f) => ({ ...f, cep: formatCep(a.address?.cep ?? f.cep), state: a.address?.state ?? f.state }));
      onSaved(a);
      return account.address ? 'Endereço atualizado com sucesso.' : 'Endereço cadastrado com sucesso.';
    });
  };

  return (
    <form onSubmit={submit} className="account-section" noValidate>
      <h2>Endereço de entrega</h2>
      <Messages ok={st.ok} error={st.error} />
      {!account.address && <p className="notice">Você ainda não cadastrou um endereço. Ele é necessário para finalizar pedidos.</p>}
      <Input id="ad-rec" label="Destinatário" value={form.recipient} onChange={set('recipient')} autoComplete="name" maxLength={100} error={st.fields.recipient} />
      <div className="form-grid">
        <Input id="ad-cep" label="CEP" value={form.cep} onChange={set('cep')} inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" error={st.fields.cep} />
        <div className="field">
          <label htmlFor="ad-uf">Estado</label>
          <select id="ad-uf" value={form.state} onChange={(e) => set('state')(e.target.value)} aria-invalid={st.fields.state ? true : undefined}>
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {st.fields.state && <span className="field-error">{st.fields.state}</span>}
        </div>
      </div>
      <Input id="ad-street" label="Logradouro" value={form.street} onChange={set('street')} autoComplete="address-line1" maxLength={150} error={st.fields.street} />
      <div className="form-grid">
        <Input id="ad-num" label="Número" value={form.number} onChange={set('number')} maxLength={20} placeholder="ex.: 123 ou S/N" error={st.fields.number} />
        <Input id="ad-comp" label="Complemento (opcional)" value={form.complement} onChange={set('complement')} autoComplete="address-line2" maxLength={100} error={st.fields.complement} />
      </div>
      <div className="form-grid">
        <Input id="ad-dist" label="Bairro" value={form.district} onChange={set('district')} maxLength={100} error={st.fields.district} />
        <Input id="ad-city" label="Cidade" value={form.city} onChange={set('city')} autoComplete="address-level2" maxLength={100} error={st.fields.city} />
      </div>
      <button type="submit" className="btn btn-inline" disabled={st.busy}>
        {st.busy ? 'Salvando…' : account.address ? 'Atualizar endereço' : 'Cadastrar endereço'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const st = useFormStatus();
  const [localError, setLocalError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (next !== confirm) return setLocalError('A confirmação não corresponde à nova senha.');
    void st.run(async () => {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      return 'Senha alterada com sucesso. Use a nova senha nos próximos logins.';
    });
  };

  return (
    <form onSubmit={submit} className="account-section" noValidate>
      <h2>Alterar senha</h2>
      <Messages ok={st.ok} error={st.error || localError} />
      <Input id="pw-cur" type="password" label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" error={st.fields.currentPassword} />
      <div className="form-grid">
        <Input id="pw-new" type="password" label="Nova senha (mínimo 8 caracteres)" value={next} onChange={setNext} autoComplete="new-password" maxLength={128} error={st.fields.newPassword} />
        <Input id="pw-conf" type="password" label="Confirme a nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" maxLength={128} />
      </div>
      <button type="submit" className="btn btn-inline" disabled={st.busy || !current || !next}>{st.busy ? 'Alterando…' : 'Alterar senha'}</button>
    </form>
  );
}

export function AccountPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const uid = user?.id;
  // Sempre busca no servidor os dados da conta da sessão atual.
  useEffect(() => {
    if (uid === undefined) return;
    api.getAccount().then(setAccount, (e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar seus dados.'));
  }, [uid]);

  if (loading) return <p className="center muted">Carregando…</p>;
  if (!user) return <Navigate to="/entrar" replace />;

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate('/entrar', { replace: true });
    } catch {
      setError('Não foi possível sair. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <section className="card card-wide">
      <div className="title-row">
        <h1>Minha conta</h1>
        <span className="muted">{user.role === 'employee' ? 'Funcionário' : 'Cliente'}</span>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      {!account && !error && <p className="muted">Carregando…</p>}
      {account && (
        <>
          <ProfileForm account={account} onSaved={setAccount} />
          {user.role === 'customer' && <AddressForm account={account} onSaved={setAccount} />}
          <PasswordForm />
        </>
      )}
      <div className="account-section">
        <button type="button" className="btn btn-secondary btn-inline" onClick={onLogout} disabled={busy}>
          {busy ? 'Saindo…' : 'Sair da conta'}
        </button>
      </div>
    </section>
  );
}
