import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError, ORDER_STATUSES, STATUS_LABELS, type OrderStatus, type OrderSummary } from '../api';
import { Flash, StatusBadge } from '../components';
import { formatDate, formatMoney } from '../format';

/** "Meus pedidos" (cliente) e "Painel de pedidos" (funcionário, com alteração de status). */
export function OrdersListPage({ staff }: { staff: boolean }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<OrderStatus | ''>('');
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    api.listOrders()
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro inesperado.'));
  }, []);

  async function changeStatus(o: OrderSummary, status: OrderStatus) {
    setError(''); setMessage(''); setSavingId(o.id);
    try {
      const { order } = await api.setStatus(o.id, status);
      setOrders((os) => os && os.map((x) => (x.id === o.id ? { ...x, status: order.status, updatedAt: order.updatedAt } : x)));
      setMessage(`Pedido nº ${o.id} atualizado para "${STATUS_LABELS[order.status]}".`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.');
    } finally {
      setSavingId(null);
    }
  }

  const visible = orders?.filter((o) => !filter || o.status === filter) ?? [];

  return (
    <section className="card wide">
      <div className="title-row">
        <h1>{staff ? 'Painel de pedidos' : 'Meus pedidos'}</h1>
        {!staff && <Link className="button" to="/pedidos/novo">Novo pedido</Link>}
      </div>
      <Flash />
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {staff && (
        <label className="filter">Filtrar por status
          <select value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | '')}>
            <option value="">Todos</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
      )}
      {!orders && !error && <p>Carregando…</p>}
      {orders && visible.length === 0 && (
        <p className="muted">{staff ? 'Nenhum pedido encontrado.' : 'Você ainda não fez pedidos.'}</p>
      )}
      {visible.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th><th>Data</th>{staff && <th>Cliente</th>}<th>Itens</th><th>Total</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id}>
                  <td data-label="Nº">{o.id}</td>
                  <td data-label="Data">{formatDate(o.createdAt)}</td>
                  {staff && <td data-label="Cliente">{o.customer.name}<br /><small>{o.customer.email}</small></td>}
                  <td data-label="Itens">{o.itemCount}</td>
                  <td data-label="Total">{formatMoney(o.totalCents)}</td>
                  <td data-label="Status">
                    {staff ? (
                      <select aria-label={`Status do pedido ${o.id}`} value={o.status} disabled={savingId === o.id}
                        onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}>
                        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    ) : <StatusBadge status={o.status} />}
                  </td>
                  <td><Link to={`/pedidos/${o.id}`}>Detalhes</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
