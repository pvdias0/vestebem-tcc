import React, { useEffect, useState } from 'react';
import { api, type Order } from '../services/api.js';

interface MyOrdersPageProps {
  onSelectOrder: (orderId: string) => void;
  onCreateNewOrder: () => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ onSelectOrder, onCreateNewOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMyOrders();
      setOrders(res.orders);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
      <div className="page-card max-w-4xl text-center py-8">
        <p className="text-muted">Carregando seus pedidos...</p>
      </div>
    );
  }

  return (
    <div className="page-card max-w-4xl">
      <div className="page-header flex-between">
        <div>
          <h2>Meus pedidos</h2>
          <p className="page-subtitle">Acompanhe o andamento das suas compras</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onCreateNewOrder}
        >
          + Criar novo pedido
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛍️</span>
          <h3>Você ainda não possui pedidos</h3>
          <p className="text-muted">Crie seu primeiro pedido adicionando as peças desejadas.</p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={onCreateNewOrder}
          >
            Fazer meu primeiro pedido
          </button>
        </div>
      ) : (
        <div className="orders-list">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Status</th>
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
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="font-semibold">
                    R$ {order.totalAmount.toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => onSelectOrder(order.id)}
                    >
                      Ver detalhes
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
