import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, type Order, type OrderStatus, type OrderSummary } from '../api';
import { useAuth } from '../auth';
import { Flash, ShippingInfo, StatusBadge } from '../components';
import { formatDate, formatMoney, STATUS_LABELS, STATUSES } from '../format';

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');

export function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listOrders().then((r) => setOrders(r.orders), (e) => setError(errMsg(e)));
  }, []);

  return (
    <section className="card card-wide">
      <div className="title-row">
        <h1>Meus pedidos</h1>
        <Link to="/pedidos/novo" className="btn btn-inline">Novo pedido</Link>
      </div>
      <Flash />
      {error && <div className="alert" role="alert">{error}</div>}
      {!orders && !error && <p className="muted">Carregando…</p>}
      {orders?.length === 0 && <p className="muted">Você ainda não fez nenhum pedido.</p>}
      {orders && orders.length > 0 && (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/pedidos/${o.id}`} className="order-link">
                <span><strong>Pedido nº {o.id}</strong><br /><span className="muted">{formatDate(o.createdAt)} · {o.itemCount} peça(s)</span></span>
                <span className="order-right"><StatusBadge status={o.status} /><strong>{formatMoney(o.totalCents)}</strong></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    setOrder(null);
    setError('');
    api.getOrder(id).then((r) => setOrder(r.order), (e) => setError(errMsg(e)));
  }, [id]);

  return (
    <section className="card card-wide">
      <p><Link to={isEmployee ? '/painel/pedidos' : '/meus-pedidos'}>← Voltar</Link></p>
      <Flash />
      {msg && <div className="success" role="status">{msg}</div>}
      {error && <div className="alert" role="alert">{error}</div>}
      {!order && !error && <p className="muted">Carregando…</p>}
      {order && (
        <>
          <div className="title-row">
            <h1>Pedido nº {order.id}</h1>
            <StatusBadge status={order.status} />
          </div>
          <dl className="info">
            <dt>Data</dt><dd>{formatDate(order.createdAt)}</dd>
            <dt>Cliente</dt><dd>{order.customer.name} ({order.customer.email})</dd>
            <dt>Status</dt><dd>{STATUS_LABELS[order.status]}</dd>
          </dl>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Produto</th><th className="num">Qtd.</th><th className="num">Preço unit.</th><th className="num">Subtotal</th></tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      {it.description}
                      {it.productId === null && <span className="muted small-text"> (item sem vínculo com o catálogo)</span>}
                    </td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{formatMoney(it.unitPriceCents)}</td>
                    <td className="num">{formatMoney(it.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th colSpan={3}>Total</th><th className="num">{formatMoney(order.totalCents)}</th></tr>
              </tfoot>
            </table>
          </div>
          <h2>Entrega</h2>
          {order.shipping ? (
            <ShippingInfo shipping={order.shipping} />
          ) : (
            <p className="notice">Este pedido não possui informações de entrega registradas (criado antes do cadastro de endereços).</p>
          )}
          {isEmployee && (
            <StatusChanger order={order} onChanged={(o, m) => { setOrder(o); setMsg(m); }} onError={(m) => { setMsg(''); setError(m); }} />
          )}
        </>
      )}
    </section>
  );
}

function StatusChanger(props: {
  order: OrderSummary;
  onChanged: (o: Order, msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(props.order.status);
  const [busy, setBusy] = useState(false);
  useEffect(() => setStatus(props.order.status), [props.order.status]);

  const save = async () => {
    setBusy(true);
    try {
      const { order } = await api.updateOrderStatus(props.order.id, status);
      props.onChanged(order, `Status do pedido nº ${order.id} alterado para "${STATUS_LABELS[order.status]}".`);
    } catch (e) {
      props.onError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="status-changer">
      <label htmlFor={`st-${props.order.id}`} className="sr-only">Status do pedido {props.order.id}</label>
      <select id={`st-${props.order.id}`} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} disabled={busy}>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      <button type="button" className="btn btn-inline" onClick={save} disabled={busy || status === props.order.status}>
        {busy ? 'Salvando…' : 'Alterar status'}
      </button>
    </div>
  );
}

export function EmployeeOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | ''>('');
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    api.listOrders(filter || undefined).then((r) => setOrders(r.orders), (e) => setError(errMsg(e)));
  }, [filter]);
  useEffect(load, [load]);

  return (
    <section className="card card-xwide">
      <h1>Painel de pedidos</h1>
      <div className="toolbar">
        <label htmlFor="filtro">Filtrar por status:</label>
        <select id="filtro" value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | '')}>
          <option value="">Todos</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {msg && <div className="success" role="status">{msg}</div>}
      {error && <div className="alert" role="alert">{error}</div>}
      {!orders && !error && <p className="muted">Carregando…</p>}
      {orders?.length === 0 && <p className="muted">Nenhum pedido encontrado.</p>}
      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nº</th><th>Data</th><th>Cliente</th><th className="num">Total</th><th>Status</th><th>Alterar status</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/pedidos/${o.id}`}>{o.id}</Link></td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.customer.name}<br /><span className="muted small-text">{o.customer.email}</span></td>
                  <td className="num">{formatMoney(o.totalCents)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>
                    <StatusChanger
                      order={o}
                      onChanged={(updated, m) => {
                        setMsg(m);
                        setError('');
                        if (filter && updated.status !== filter) load();
                        else setOrders((os) => os?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
                      }}
                      onError={(m) => { setMsg(''); setError(m); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
