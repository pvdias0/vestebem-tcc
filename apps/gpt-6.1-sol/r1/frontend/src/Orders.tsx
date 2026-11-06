import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type User } from './api';
import { Catalog, ProductEditor, type Product } from './Catalog';
import { Account, DeliveryView, type Delivery, type Profile } from './Account';
import './orders.css';

const labels = { received: 'Recebido', preparing: 'Em preparação', shipped: 'Enviado', cancelled: 'Cancelado' };
type Status = keyof typeof labels;
type Item = { id: number; description: string; quantity: number; unitPriceCents: number; productId: number | null };
type Order = { id: number; customerId: number; customerName: string; createdAt: string; status: Status; totalCents: number; items?: Item[]; delivery?: Delivery | null };
type Draft = { key: number; product: Product; quantity: string };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
export function Workspace({ user, logout, expired, onName, passwordChanged }: { user: User; logout: () => Promise<void>; expired: () => void; onName: (name: string) => void; passwordChanged: () => void }) {
  const [path, setPath] = useState(location.pathname);
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Status>('received');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deliveryRevision, setDeliveryRevision] = useState(0);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const employee = user.role === 'employee';
  const detail = /^\/pedidos\/\d+$/.test(path);
  const creating = path === '/pedidos/novo';
  const listing = path === '/meus-pedidos' || path === '/funcionario';
  const managing = path.startsWith('/funcionario/produtos');
  const listPath = employee ? '/funcionario' : '/meus-pedidos';
  const listTitle = employee ? 'Painel de funcionário' : 'Meus pedidos';
  useEffect(() => {
    if (!creating || employee) return;
    let active = true; setConfirmed(false); setProfile(null); setDeliveryLoading(true);
    api('me/profile').then(data => { if (active) setProfile(data.profile); }).catch(err => { if (active) report(err); }).finally(() => { if (active) setDeliveryLoading(false); });
    return () => { active = false; };
  }, [creating, deliveryRevision]);
  function navigate(next: string) {
    history.pushState({}, '', next); setPath(next); setError(''); setNotice(''); setOrder(null); setOrders([]);
  }
  function report(err: unknown) {
    if (err instanceof ApiError && err.status === 401) { expired(); return; }
    setError(err instanceof Error ? err.message : 'Verifique a conexão e tente novamente.');
  }
  useEffect(() => {
    const pop = () => { setPath(location.pathname); setOrder(null); setOrders([]); setError(''); setNotice(''); };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!listing && !detail) return;
    let active = true;
    setLoading(true); setError(''); setOrder(null); setOrders([]);
    api(detail ? `orders/${path.split('/')[2]}` : 'orders')
      .then(data => { if (!active) return; if (detail) { setOrder(data.order); setStatus(data.order.status); } else setOrders(data.orders); })
      .catch(err => { if (active) report(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  const estimated = drafts.reduce((sum, item) => sum + item.product.priceCents * (Number(item.quantity) || 0), 0);
  function edit(key: number, field: 'quantity', value: string) {
    setDrafts(items => items.map(item => item.key === key ? { ...item, [field]: value } : item));
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const items = drafts.map(item => ({ productId: item.product.id, quantity: Number(item.quantity) }));
    if (!items.length) { setError('Selecione pelo menos um produto.'); return; }
    setBusy(true);
    try {
      const data = await api('orders', { items, confirmDelivery: confirmed, deliveryVersion: profile?.deliveryVersion });
      setDrafts([]);
      navigate(`/pedidos/${data.order.id}`); setNotice('Pedido criado com sucesso!');
    } catch (err) { report(err); }
    finally { setBusy(false); }
  }
  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!order) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await api(`orders/${order.id}/status`, { status }, 'PATCH');
      setOrder(current => current ? { ...current, ...data.order } : null); setNotice('Status atualizado com sucesso.');
    } catch (err) { report(err); }
    finally { setBusy(false); }
  }
  return <div className="workspace">
    <nav className="account-nav" aria-label="Navegação da conta">
      <a href="/produtos">Catálogo</a>
      {employee && <a href="/funcionario/produtos">Gerenciar produtos</a>}
      <button disabled={busy} onClick={() => navigate('/minha-conta')} aria-current={path === '/minha-conta' ? 'page' : undefined}>Minha conta</button>
      <button disabled={busy} onClick={() => navigate(listPath)} aria-current={listing ? 'page' : undefined}>{employee ? 'Todos os pedidos' : 'Meus pedidos'}</button>
      {!employee && <button disabled={busy} onClick={() => navigate('/pedidos/novo')} aria-current={creating ? 'page' : undefined}>Criar pedido</button>}
      <button disabled={busy} onClick={async () => { setBusy(true); try { await logout(); } finally { setBusy(false); } }}>Sair da conta</button>
    </nav>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    {managing ? employee ? path === '/funcionario/produtos' ? <Catalog manage user={user}/> : <ProductEditor key={path}/> : <p>Somente funcionários podem gerenciar produtos.</p> : listing ? <>
      <span className="eyebrow">{employee ? 'GESTÃO DE PEDIDOS' : 'SEU ESPAÇO'}</span><h2>{listTitle}</h2>
      <p className="intro">{employee ? 'Consulte todos os pedidos e atualize o status nos detalhes.' : 'Acompanhe os pedidos que você criou.'}</p>
      <button className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Atualizar lista</button>
      {loading ? <p role="status">Carregando pedidos…</p> : !error && orders.length === 0 ? <p>Nenhum pedido encontrado.</p> : <div className="order-list">{orders.map(item => <article className="order-card" key={item.id}>
        <div><h3>Pedido #{item.id}</h3><span className={`badge ${item.status}`}>{labels[item.status]}</span></div>
        {employee && <p>Cliente: {item.customerName}</p>}<p>{date(item.createdAt)}</p><strong>{money(item.totalCents)}</strong>
        <button className="secondary" onClick={() => navigate(`/pedidos/${item.id}`)}>Ver detalhes do pedido #{item.id}</button>
      </article>)}</div>}
    </> : detail ? <>
      <button className="text-button" disabled={busy} onClick={() => navigate(listPath)}>← {listTitle}</button>
      {loading ? <p role="status">Carregando pedido…</p> : order && <>
        <h2>Pedido #{order.id}</h2><span className={`badge ${order.status}`}>{labels[order.status]}</span>
        <dl className="order-meta"><dt>Cliente responsável</dt><dd>{order.customerName}</dd><dt>Data de criação</dt><dd>{date(order.createdAt)}</dd></dl>
        <div className="table-scroll"><table><caption>Itens do pedido</caption><thead><tr><th>Peça</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>{order.items?.map(item => <tr key={item.id}><td>{item.description}<small className="hint">{item.productId ? `Produto #${item.productId}` : 'Item anterior ao catálogo'}</small></td><td>{item.quantity}</td><td>{money(item.unitPriceCents)}</td><td>{money(item.quantity * item.unitPriceCents)}</td></tr>)}</tbody></table></div>
        <p className="order-total">Total <strong>{money(order.totalCents)}</strong></p>
        <h3 className="delivery-heading">Dados de entrega</h3>{order.delivery ? <DeliveryView delivery={order.delivery}/> : <p>Este pedido não possui informações de entrega registradas.</p>}
        {employee && <form className="status-form" onSubmit={changeStatus}><label>Status do pedido<select value={status} onChange={e => setStatus(e.target.value as Status)} disabled={busy}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar status'}</button></form>}
      </>}
    </> : creating ? employee ? <p>A criação de pedidos está disponível somente para clientes.</p> : <>
      <span className="eyebrow">DO SEU JEITO</span><h2>Criar pedido</h2><p className="intro">Selecione produtos do catálogo e informe as quantidades. O preço cadastrado no momento da confirmação será usado.</p>
      {!busy && <Catalog onSelect={product => { if (drafts.some(item => item.product.id === product.id)) { setError('Produto já selecionado. Ajuste a quantidade abaixo.'); return; } if (drafts.length >= 50) { setError('Limite de 50 produtos por pedido.'); return; } setError(''); setDrafts(items => [...items, { key: product.id, product, quantity: '1' }]); }}/>}
      <form onSubmit={create}>
        {drafts.map((item, index) => <fieldset key={item.key} disabled={busy}><legend>Item {index + 1}</legend>
          <p className="selected-product">{item.product.name} · {item.product.size} · {money(item.product.priceCents)}</p>
          <label>Quantidade<input required type="number" min="1" max="10000" step="1" value={item.quantity} onChange={e => edit(item.key, 'quantity', e.target.value)}/></label>
          <button className="text-button" type="button" onClick={() => setDrafts(items => items.filter(row => row.key !== item.key))}>Remover item {index + 1}</button>
        </fieldset>)}
        <h3 className="delivery-heading">Entrega</h3>{deliveryLoading ? <p role="status">Carregando endereço…</p> : profile?.address && profile.phone && profile.deliveryVersion ? <><DeliveryView delivery={{ ...profile.address, phone: profile.phone }}/><label className="delivery-confirm"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>Confirmo a utilização deste destinatário, telefone e endereço neste pedido.</label></> : <p>Cadastre seu endereço e telefone em <button type="button" className="text-button" onClick={() => navigate('/minha-conta')}>Minha conta</button> antes de finalizar.</p>}
        <button type="button" className="secondary" disabled={busy || deliveryLoading} onClick={() => setDeliveryRevision(value => value + 1)}>Recarregar entrega</button>
        <p className="order-total">Total estimado <strong>{money(estimated)}</strong></p><small className="hint">O total será confirmado pelo servidor. Até 50 produtos por pedido. Não há reserva nem baixa de estoque.</small><button className="primary" disabled={busy || !drafts.length || !confirmed || !profile?.deliveryVersion}>{busy ? 'Criando pedido…' : 'Confirmar pedido'}</button>
      </form>
    </> : <Account user={user} onName={onName} passwordChanged={passwordChanged} expired={expired}/>}
  </div>;
}
