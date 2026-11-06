import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type User } from './api';
import './account.css';

export type Address = { recipient: string; postalCode: string; street: string; number: string; complement: string; district: string; city: string; state: string };
export type Delivery = Address & { phone: string };
export type Profile = { name: string; email: string; cpf: string | null; phone: string | null; address: Address | null; deliveryVersion: string | null };
const emptyAddress: Address = { recipient: '', postalCode: '', street: '', number: '', complement: '', district: '', city: '', state: '' };
export function DeliveryView({ delivery }: { delivery: Delivery }) {
  return <div className="delivery-summary"><p><strong>{delivery.recipient}</strong></p><p>Telefone: {delivery.phone}</p><p>{delivery.street}, {delivery.number}{delivery.complement && ` · ${delivery.complement}`}</p><p>{delivery.district} · {delivery.city} / {delivery.state}</p><p>CEP: {delivery.postalCode}</p></div>;
}
export function Account({ user, onName, passwordChanged, expired }: { user: User; onName: (name: string) => void; passwordChanged: () => void; expired: () => void }) {
  const [loading, setLoading] = useState(user.role === 'customer');
  const [profile, setProfile] = useState({ name: user.name, cpf: '', phone: '' });
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [password, setPassword] = useState({ current: '', next: '', confirmation: '' });
  function report(err: unknown) { if (err instanceof ApiError && err.status === 401) { expired(); return; } setError(err instanceof Error ? err.message : 'Não foi possível concluir.'); }
  useEffect(() => {
    if (user.role !== 'customer') return;
    let active = true;
    api('me/profile').then(({ profile: data }: { profile: Profile }) => { if (active) { setProfile({ name: data.name, cpf: data.cpf ?? '', phone: data.phone ?? '' }); setAddress(data.address ?? emptyAddress); } }).catch(err => { if (active) report(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>, kind: 'profile' | 'address' | 'password') {
    event.preventDefault(); setError(''); setNotice('');
    if (kind === 'password' && password.next !== password.confirmation) { setError('A confirmação da nova senha não confere.'); return; }
    setBusy(true);
    try {
      const data = await api(`me/${kind}`, kind === 'profile' ? profile : kind === 'address' ? address : { currentPassword: password.current, newPassword: password.next }, kind === 'profile' ? 'PATCH' : kind === 'address' ? 'PUT' : 'POST');
      if (kind === 'password') { setPassword({ current: '', next: '', confirmation: '' }); passwordChanged(); return; }
      if (kind === 'profile') { setProfile({ name: data.profile.name, cpf: data.profile.cpf ?? '', phone: data.profile.phone ?? '' }); onName(data.profile.name); }
      else setAddress(data.profile.address);
      setNotice(data.message);
    } catch (err) { report(err); } finally { setBusy(false); }
  }
  if (loading) return <p role="status">Carregando dados da conta…</p>;
  return <div className="account-editor"><span className="eyebrow">SEU ESPAÇO</span><h2>Minha conta</h2><p>{user.email} · {user.role === 'customer' ? 'Cliente' : 'Funcionário'}</p>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {user.role === 'customer' ? <>
      <form onSubmit={e => save(e, 'profile')}><fieldset disabled={busy}><legend>Dados pessoais</legend>
        <label>Nome<input required minLength={2} maxLength={100} autoComplete="name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label>
        <label>CPF<input inputMode="numeric" maxLength={18} value={profile.cpf} onChange={e => setProfile({ ...profile, cpf: e.target.value })}/></label><small className="hint">Visível somente para você. Informe 11 dígitos.</small>
        <label>Telefone com DDD<input type="tel" autoComplete="tel-national" maxLength={30} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}/></label><small className="hint">Obrigatório para finalizar pedidos.</small>
        <button className="primary" disabled={busy}>Salvar dados pessoais</button>
      </fieldset></form>
      <form onSubmit={e => save(e, 'address')}><fieldset disabled={busy}><legend>Endereço de entrega</legend>
        {([['recipient', 'Destinatário', 100], ['postalCode', 'CEP', 10], ['street', 'Logradouro', 200], ['number', 'Número', 30], ['complement', 'Complemento (opcional)', 100], ['district', 'Bairro', 100], ['city', 'Cidade', 100]] as const).map(([key, label, limit]) => <label key={key}>{label}<input required={key !== 'complement'} maxLength={limit} inputMode={key === 'postalCode' ? 'numeric' : 'text'} value={address[key]} onChange={e => setAddress({ ...address, [key]: e.target.value })}/></label>)}
        <label>Estado<select required value={address.state} onChange={e => setAddress({ ...address, state: e.target.value })}><option value="">Selecione a UF</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(state => <option key={state}>{state}</option>)}</select></label>
        <button className="primary" disabled={busy}>Salvar endereço</button>
      </fieldset></form>
    </> : <p>{user.name}</p>}
    <form onSubmit={e => save(e, 'password')}><fieldset disabled={busy}><legend>Alterar senha</legend>
      <label>Senha atual<input required type="password" maxLength={128} autoComplete="current-password" value={password.current} onChange={e => setPassword({ ...password, current: e.target.value })}/></label>
      <label>Nova senha<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password.next} onChange={e => setPassword({ ...password, next: e.target.value })}/></label>
      <label>Confirme a nova senha<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password.confirmation} onChange={e => setPassword({ ...password, confirmation: e.target.value })}/></label>
      <small className="hint">De 8 a 128 caracteres. Após alterar, entre novamente em todos os dispositivos.</small><button className="primary" disabled={busy}>Alterar senha</button>
    </fieldset></form>
  </div>;
}
