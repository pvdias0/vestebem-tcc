import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, UFS, type Account, type Address } from '../api';
import { useAuth } from '../auth';
import { formatCep, formatCpf, formatPhone } from '../format';

const EMPTY_ADDRESS: Address = { recipient: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' };

interface Status { ok?: string; error?: string; fields?: Record<string, string> }

function useFormStatus() {
  const [status, setStatus] = useState<Status>({});
  const [sending, setSending] = useState(false);
  async function run(fn: () => Promise<string>) {
    setStatus({}); setSending(true);
    try { setStatus({ ok: await fn() }); }
    catch (e) { setStatus(e instanceof ApiError ? { error: e.message, fields: e.fields } : { error: 'Erro inesperado.' }); }
    finally { setSending(false); }
  }
  return { status, sending, run };
}

function Messages({ status }: { status: Status }) {
  return <>
    {status.ok && <p className="success" role="status">{status.ok}</p>}
    {status.error && <p className="alert" role="alert">{status.error}</p>}
  </>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label>{label}{children}{error && <span className="field-error">{error}</span>}</label>;
}

export function AccountPage() {
  const { setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState('');

  const [profile, setProfile] = useState({ name: '', cpf: '', phone: '' });
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const profileForm = useFormStatus();
  const addressForm = useFormStatus();
  const pwForm = useFormStatus();

  function applyAccount(a: Account) {
    setAccount(a);
    setUser({ id: a.user.id, name: a.user.name, email: a.user.email, role: a.user.role });
    setProfile({ name: a.user.name, cpf: a.user.cpf ? formatCpf(a.user.cpf) : '', phone: a.user.phone ? formatPhone(a.user.phone) : '' });
    setAddress(a.address ? { ...a.address, cep: formatCep(a.address.cep), complement: a.address.complement ?? '' } : EMPTY_ADDRESS);
  }

  // Sempre busca os dados atuais no servidor (valida a sessão).
  useEffect(() => {
    api.account().then(applyAccount).catch((e) => {
      if (e instanceof ApiError && e.status === 401) setUser(null);
      else setLoadError(e instanceof ApiError ? e.message : 'Erro inesperado.');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = (e: FormEvent) => { e.preventDefault(); void profileForm.run(async () => {
    applyAccount(await api.updateProfile(profile)); return 'Dados pessoais atualizados.';
  }); };
  const saveAddress = (e: FormEvent) => { e.preventDefault(); void addressForm.run(async () => {
    const had = account?.address;
    applyAccount(await api.updateAddress(address)); return had ? 'Endereço atualizado.' : 'Endereço cadastrado.';
  }); };
  const savePassword = (e: FormEvent) => { e.preventDefault(); void pwForm.run(async () => {
    if (pw.next !== pw.confirm) throw new ApiError(400, 'A confirmação não confere com a nova senha.', { confirm: 'Não confere.' });
    await api.changePassword(pw.current, pw.next);
    setPw({ current: '', next: '', confirm: '' });
    return 'Senha alterada. Use a nova senha nos próximos logins; outras sessões desta conta foram encerradas.';
  }); };

  const addr = (k: keyof Address) => ({
    value: address[k] ?? '', onChange: (e: { target: { value: string } }) => setAddress((a) => ({ ...a, [k]: e.target.value })),
  });

  if (loadError) return <section className="card"><h1>Minha conta</h1><p className="alert" role="alert">{loadError}</p></section>;
  if (!account) return <section className="card"><h1>Minha conta</h1><p>Carregando…</p></section>;
  const pf = profileForm.status.fields ?? {};
  const af = addressForm.status.fields ?? {};
  const wf = pwForm.status.fields ?? {};

  return (
    <div className="account">
      <section className="card wide">
        <h1>Minha conta</h1>
        <h2>Dados pessoais</h2>
        <form onSubmit={saveProfile} noValidate>
          <Messages status={profileForm.status} />
          <Field label="Nome" error={pf.name}>
            <input autoComplete="name" maxLength={100} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <label>E-mail<input value={account.user.email} disabled /></label>
          <div className="form-row">
            <Field label="CPF" error={pf.cpf}>
              <input inputMode="numeric" placeholder="000.000.000-00" maxLength={14} value={profile.cpf}
                onChange={(e) => setProfile({ ...profile, cpf: e.target.value })} />
            </Field>
            <Field label="Telefone" error={pf.phone}>
              <input type="tel" autoComplete="tel" placeholder="(00) 00000-0000" maxLength={16} value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
          </div>
          <span className="hint">O CPF é visível apenas para você.</span>
          <button type="submit" disabled={profileForm.sending}>{profileForm.sending ? 'Salvando…' : 'Salvar dados pessoais'}</button>
        </form>
      </section>

      <section className="card wide">
        <h2>Endereço de entrega</h2>
        {!account.address && <p className="hint">Você ainda não cadastrou um endereço. Ele é necessário para finalizar pedidos.</p>}
        <form onSubmit={saveAddress} noValidate>
          <Messages status={addressForm.status} />
          <Field label="Destinatário" error={af.recipient}><input maxLength={100} {...addr('recipient')} /></Field>
          <div className="form-row">
            <Field label="CEP" error={af.cep}><input inputMode="numeric" placeholder="00000-000" maxLength={9} autoComplete="postal-code" {...addr('cep')} /></Field>
            <Field label="Estado" error={af.state}>
              <select {...addr('state')}>
                <option value="">Selecione</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Logradouro" error={af.street}><input maxLength={150} autoComplete="address-line1" {...addr('street')} /></Field>
          <div className="form-row">
            <Field label="Número" error={af.number}><input maxLength={20} {...addr('number')} /></Field>
            <Field label="Complemento (opcional)" error={af.complement}><input maxLength={100} {...addr('complement')} /></Field>
          </div>
          <div className="form-row">
            <Field label="Bairro" error={af.district}><input maxLength={100} {...addr('district')} /></Field>
            <Field label="Cidade" error={af.city}><input maxLength={100} autoComplete="address-level2" {...addr('city')} /></Field>
          </div>
          <button type="submit" disabled={addressForm.sending}>
            {addressForm.sending ? 'Salvando…' : account.address ? 'Atualizar endereço' : 'Cadastrar endereço'}
          </button>
        </form>
      </section>

      <section className="card wide">
        <h2>Alterar senha</h2>
        <form onSubmit={savePassword} noValidate>
          <Messages status={pwForm.status} />
          <Field label="Senha atual" error={wf.currentPassword}>
            <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Nova senha" error={wf.newPassword}>
              <input type="password" autoComplete="new-password" maxLength={128} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="Confirmar nova senha" error={wf.confirm}>
              <input type="password" autoComplete="new-password" maxLength={128} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
          </div>
          <span className="hint">Mínimo de 8 caracteres.</span>
          <button type="submit" disabled={pwForm.sending}>{pwForm.sending ? 'Alterando…' : 'Alterar senha'}</button>
        </form>
        <button className="secondary" onClick={async () => { await logout(); navigate('/entrar'); }}>Sair da conta</button>
      </section>
    </div>
  );
}
