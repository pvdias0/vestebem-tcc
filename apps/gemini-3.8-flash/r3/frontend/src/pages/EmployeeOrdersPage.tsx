import React, { useEffect, useState } from 'react';
import { api, type Order, type OrderStatus } from '../services/api.js';

interface EmployeeOrdersPageProps {
  onSelectOrder: (orderId: string) => void;
}

const STATUS_OPTIONS: OrderStatus[] = ['recebido', 'em preparação', 'enviado', 'cancelado'];

export const EmployeeOrdersPage: React.FC<EmployeeOrdersPageProps> = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAllOrders();
      setOrders(res.orders);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lista de pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      setError(null);
      setSuccessMessage(null);
      const res = await api.updateOrderStatus(orderId, newStatus);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: res.order.status, updatedAt: res.order.updatedAt } : o))
      );
      setSuccessMessage(`Status do pedido #${orderId.slice(0, 8)} atualizado para "${newStatus}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status do pedido.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'recebido':
        return 'badge-blue';
      case 'em preparação':
        return 'badge-amber';
      case 'enviado':
        return 'badge-green';
      case 'cancelado':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="page-card max-w-5xl text-center py-8">
        <p className="text-muted">Carregando painel de pedidos...</p>
      </div>
    );
  }

  return (
    <div className="page-card max-w-5xl">
      <div className="page-header flex-between">
        <div>
          <h2>Painel de Pedidos (Funcionário)</h2>
          <p className="page-subtitle">Gerencie todos os pedidos da loja e atualize seus status</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={fetchOrders}
          title="Atualizar lista"
        >
          🔄 Atualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="alert">
          {successMessage}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3>Nenhum pedido encontrado</h3>
          <p className="text-muted">Nenhum cliente realizou compras até o momento.</p>
        </div>
      ) : (
        <div className="orders-list">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Data</th>
                <th>Total</th>
                <th>Status Atual</th>
                <th style={{ width: '180px' }}>Alterar Status</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="order-id-badge" title={order.id}>
                      #{order.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td>
                    <div className="customer-cell">
                      <span className="font-medium">{order.customerName || 'Cliente'}</span>
                      <span className="text-xs text-muted">{order.customerEmail}</span>
                    </div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td className="font-semibold">
                    R$ {order.totalAmount.toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <select
                      className="form-control form-control-sm"
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => onSelectOrder(order.id)}
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
