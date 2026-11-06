import { useEffect, useState, type FormEvent } from 'react';
import { ProductOrder } from './ProductOrder';
import { ProfilePanel, DeliveryDetails, type Delivery } from './Profile';
export type User = { name: string; email: string; role: 'customer' | 'employee' };
type OrderItem = { productId: number | null; description: string; quantity: number; unitPriceCents: number };
type Order = { delivery: Delivery | null; id: number; customerName: string; customerEmail: string; createdAt: string; status: Status; totalCents: number; items: OrderItem[] };
type Status = 'received' | 'preparing' | 'sent' | 'cancelled';
const labels: Record<Status, string> = { received: 'Recebido', preparing: 'Em preparação', sent: 'Enviado', cancelled: 'Cancelado' };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 const response = await fetch('/api/' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
 const data = response.status === 204 ? {} : await response.json();
 if (!response.ok) throw new ApiError(data.message || 'Não foi possível concluir a solicitação.', response.status);
 return data as T;
}
export function Account({ user, logout, busy, error }: { user: User; logout: () => void; busy: boolean; error: string }) {
 const [path, setPath] = useState(location.pathname);
 const [orders, setOrders] = useState<Order[]>([]);
 const [order, setOrder] = useState<Order | null>(null);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [failure, setFailure] = useState('');
 const [notice, setNotice] = useState('');
 const [expired, setExpired] = useState(false);
 const [refresh, setRefresh] = useState(0);
 const [status, setStatus] = useState<Status>('received');
 const listPath = user.role === 'employee' ? '/painel' : '/meus-pedidos';
 const isList = path === '/meus-pedidos' || path === '/painel';
 const isNew = path === '/novo-pedido';
 const match = /^\/pedidos\/(\d+)$/.exec(path);
 function navigate(next: string) { history.pushState({}, '', next); setPath(next); setNotice(''); setFailure(''); setOrder(null); }
 function handleError(error: unknown) { setFailure(error instanceof Error ? error.message : 'Ocorreu um erro.'); if (error instanceof ApiError && error.status === 401) { setExpired(true); setOrder(null); setOrders([]); } }
 useEffect(() => { const listener = () => { setPath(location.pathname); setFailure(''); setNotice(''); setOrder(null); }; window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, []);
 useEffect(() => {
  let active = true;
  setOrder(null); setOrders([]); setFailure('');
  const endpoint = isList ? 'orders' : match ? 'orders/' + match[1] : null;
  if (!endpoint) { setLoading(false); return; }
  setLoading(true);
  request<Order[] | Order>(endpoint).then(data => { if (!active) return; if (Array.isArray(data)) setOrders(data); else { setOrder(data); setStatus(data.status); } }).catch(error => { if (active) handleError(error); }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [path, refresh]);
 async function changeStatus(event: FormEvent) {
  event.preventDefault(); if (!order) return;
  setSaving(true); setFailure(''); setNotice('');
  try { await request('orders/' + order.id + '/status', 'PATCH', { status }); setOrder({ ...order, status }); setNotice('Status atualizado com sucesso.'); } catch (error) { handleError(error); } finally { setSaving(false); }
 }
 if (expired) return <><h2 id="title">Sessão encerrada</h2><p role="alert">Entre novamente para acessar sua conta e seus pedidos.</p><a href="/login">Ir para o login</a></>;
 return <div className="account-area"><nav className="account-nav" aria-label="Minha conta"><a href="/catalogo">Catálogo</a>{user.role === 'employee' && <a href="/gestao-produtos">Gerenciar produtos</a>}<button disabled={saving} onClick={() => navigate('/minha-conta')}>Minha conta</button><button disabled={saving} onClick={() => navigate(listPath)}>{user.role === 'employee' ? 'Painel de pedidos' : 'Meus pedidos'}</button>{user.role === 'customer' && <button disabled={saving} onClick={() => navigate('/novo-pedido')}>Criar pedido</button>}</nav>
 {(failure || error) && <p className="error" role="alert">{failure || error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
 {loading ? <p role="status">Carregando pedidos…</p> : isList ? <><h2 id="title">{user.role === 'employee' ? 'Todos os pedidos' : 'Meus pedidos'}</h2><p className="subtitle">{user.role === 'employee' ? 'Consulte os pedidos e atualize seus status.' : 'Acompanhe seus pedidos por aqui.'}</p>{!failure && orders.length === 0 && <p>Nenhum pedido por aqui ainda.</p>}<div className="order-list">{orders.map(item => <button className="order-summary" key={item.id} onClick={() => navigate('/pedidos/' + item.id)}><strong>Pedido #{item.id}</strong><span className="badge">{labels[item.status]}</span>{user.role === 'employee' && <span>{item.customerName}</span>}<span>{date(item.createdAt)}</span><strong>{money(item.totalCents)}</strong><span>Ver detalhes →</span></button>)}</div>{failure && <button onClick={() => setRefresh(refresh + 1)}>Tentar novamente</button>}</> : match ? <><h2 id="title">Pedido #{match[1]}</h2>{order && <><p className="badge">{labels[order.status]}</p><dl><dt>Cliente</dt><dd>{order.customerName}</dd><dt>E-mail</dt><dd>{order.customerEmail}</dd><dt>Criado em</dt><dd>{date(order.createdAt)}</dd></dl><DeliveryDetails delivery={order.delivery}/><div className="table-scroll"><table><caption>Itens do pedido</caption><thead><tr><th>Peça</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={index}><td>{item.description}<small className="item-reference">{item.productId ? `Produto #${item.productId}` : 'Item anterior ao catálogo'}</small></td><td>{item.quantity}</td><td>{money(item.unitPriceCents)}</td><td>{money(item.quantity * item.unitPriceCents)}</td></tr>)}</tbody></table></div><p className="total">Total <strong>{money(order.totalCents)}</strong></p>{user.role === 'employee' && <form onSubmit={changeStatus}><label>Status do pedido<select value={status} onChange={event => setStatus(event.target.value as Status)} disabled={saving}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar status'}</button></form>}</>}<button className="secondary" onClick={() => navigate(listPath)}>Voltar aos pedidos</button></> : isNew ? user.role === 'customer' ? <ProductOrder onError={handleError} onSuccess={id => { navigate('/pedidos/' + id); setNotice('Pedido criado com sucesso.'); }}/>: <><h2 id="title">Criar pedido</h2><p>Somente clientes podem criar pedidos.</p></> : <><ProfilePanel user={user}/><button className="primary" disabled={busy} onClick={logout}>{busy ? 'Saindo…' : 'Sair da conta'}</button></>}
 </div>;
}
