import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, ORDER_STATUSES, STATUS_LABELS, type Order, type OrderStatus } from '../api';
import { useAuth } from '../auth';
import { AddressBlock, Flash, StatusBadge } from '../components';
import { formatDate, formatMoney } from '../format';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const staff = user?.role === 'funcionario';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<OrderStatus>('recebido');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrder(null); setError('');
    api.getOrder(id)
      .then((r) => { setOrder(r.order); setStatus(r.order.status); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro inesperado.'));
  }, [id]);

  async function save() {
    if (!order) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const r = await api.setStatus(order.id, status);
      setOrder(r.order);
      setMessage(`Status alterado para "${STATUS_LABELS[r.order.status]}".`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }

  const back = staff ? <Link to="/painel">← Voltar ao painel</Link> : <Link to="/meus-pedidos">← Voltar a Meus pedidos</Link>;

  return (
    <section className="card wide">
      {back}
      <h1>Pedido {order ? `nº ${order.id}` : ''}</h1>
      <Flash />
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {!order && !error && <p>Carregando…</p>}
      {order && (
        <>
          <dl className="details">
            <dt>Status</dt><dd><StatusBadge status={order.status} /></dd>
            <dt>Criado em</dt><dd>{formatDate(order.createdAt)}</dd>
            <dt>Cliente</dt><dd>{order.customer.name} ({order.customer.email})</dd>
            <dt>Última atualização</dt><dd>{formatDate(order.updatedAt)}</dd>
          </dl>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i}>
                    <td data-label="Descrição">
                      {it.productId !== null ? <Link to={`/produtos/${it.productId}`}>{it.description}</Link> : it.description}
                    </td>
                    <td data-label="Qtd.">{it.quantity}</td>
                    <td data-label="Preço unit.">{formatMoney(it.unitPriceCents)}</td>
                    <td data-label="Subtotal">{formatMoney(it.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="total">Total: <strong>{formatMoney(order.totalCents)}</strong></p>
          <h2>Entrega</h2>
          {order.shipping
            ? <AddressBlock address={order.shipping} phone={order.shipping.phone} />
            : <p className="muted left">Este pedido não possui informações de entrega registradas (criado antes do cadastro de endereços).</p>}
          {staff && (
            <div className="status-form">
              <label>Alterar status
                <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </label>
              <button onClick={save} disabled={saving || status === order.status}>
                {saving ? 'Salvando…' : 'Salvar status'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
