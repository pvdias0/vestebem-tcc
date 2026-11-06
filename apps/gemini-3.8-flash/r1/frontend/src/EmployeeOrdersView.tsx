import React, { useState, useEffect } from 'react';
import { apiGetOrders, apiUpdateOrderStatus } from './api';
import { Order, OrderStatus } from './types';

interface EmployeeOrdersViewProps {
  onSelectOrder: (orderId: number) => void;
}

const ALL_STATUSES: OrderStatus[] = ['recebido', 'em preparação', 'enviado', 'cancelado'];

export const EmployeeOrdersView: React.FC<EmployeeOrdersViewProps> = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetOrders();
      setOrders(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar lista de todos os pedidos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      setError(null);
      setSuccess(null);
      const updated = await apiUpdateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
      setSuccess(`Pedido #${orderId} atualizado para "${newStatus}".`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao atualizar o status do pedido.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 className="card-title">Gerenciamento de Pedidos (Funcionário)</h2>
          <p className="card-subtitle">Listagem global e atualização de status em tempo real</p>
        </div>
        <button type="button" className="nav-btn secondary" onClick={fetchAllOrders} disabled={loading}>
          Atualizar Lista
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading-state">Carregando todos os pedidos do sistema...</div>
      ) : orders.length === 0 ? (
        <div className="empty-box">
          <h3>Nenhum pedido cadastrado</h3>
          <p>Nenhum cliente realizou compras até o momento.</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Status Atual</th>
                <th>Alterar Status</th>
                <th style={{ textAlign: 'right' }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const totalItemsCount = order.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
                const statusClass = `status-${order.status.replace(/\s+/g, '-')}`;
                const isUpdating = updatingId === order.id;

                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>#{order.id}</td>
                    <td>
                      {new Date(order.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <div><strong>{order.customer_name || `Cliente #${order.customer_id}`}</strong></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.customer_email}</div>
                    </td>
                    <td>{totalItemsCount} peças</td>
                    <td style={{ fontWeight: 600 }}>R$ {Number(order.total_amount).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={isUpdating}
                      >
                        {ALL_STATUSES.map(st => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="nav-btn secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => onSelectOrder(order.id)}
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
