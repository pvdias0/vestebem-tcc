import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Order, OrderStatus, ActiveView } from '../types';
import { OrderStatusBadge } from '../components/OrderStatusBadge';

interface EmployeeOrdersPageProps {
  onSelectOrder: (orderId: number) => void;
  onNavigate: (view: ActiveView) => void;
}

export const EmployeeOrdersPage: React.FC<EmployeeOrdersPageProps> = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAllOrders();
      setOrders(res.orders);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível carregar a lista de pedidos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleQuickStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      setError(null);
      setSuccessMessage(null);
      const res = await api.updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: res.order.status } : ord))
      );
      setSuccessMessage(`Status do pedido #${orderId} atualizado para "${newStatus}".`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(`Erro ao alterar o status do pedido #${orderId}.`);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="card card-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Painel do Funcionário - Gestão de Pedidos
          </h1>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Visualize todos os pedidos da loja e gerencie os status de entrega
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={fetchOrders}
          disabled={loading}
        >
          Atualizar lista
        </button>
      </div>

      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-box" style={{ padding: '2rem 0' }}>
          <div className="spinner"></div>
          <span>Buscando todos os pedidos...</span>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>Nenhum pedido foi registrado no sistema ainda.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Data</th>
                <th>Total</th>
                <th>Status Atual</th>
                <th>Alterar Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const formattedDate = new Date(order.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={order.id}>
                    <td>
                      <strong>#{order.id}</strong>
                    </td>
                    <td>
                      <div>
                        <strong>{order.customer_name}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {order.customer_email}
                      </span>
                    </td>
                    <td>{formattedDate}</td>
                    <td>
                      <strong>R$ {order.total.toFixed(2)}</strong>
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8125rem', width: 'auto' }}
                        value={order.status}
                        onChange={(e) => handleQuickStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={updatingId === order.id}
                      >
                        <option value="recebido">recebido</option>
                        <option value="em preparação">em preparação</option>
                        <option value="enviado">enviado</option>
                        <option value="cancelado">cancelado</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onSelectOrder(order.id)}
                      >
                        Ver detalhes
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
