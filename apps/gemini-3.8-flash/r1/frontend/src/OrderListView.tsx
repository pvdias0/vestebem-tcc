import React, { useState, useEffect } from 'react';
import { apiGetOrders } from './api';
import { Order } from './types';

interface OrderListViewProps {
  onSelectOrder: (orderId: number) => void;
  onCreateNewOrder: () => void;
}

export const OrderListView: React.FC<OrderListViewProps> = ({ onSelectOrder, onCreateNewOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetOrders();
      setOrders(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar lista de pedidos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="container-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 className="card-title">Meus Pedidos</h2>
          <p className="card-subtitle">Acompanhe suas compras na VesteBem</p>
        </div>
        <button type="button" className="nav-btn primary" onClick={onCreateNewOrder}>
          + Novo Pedido
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-state">Carregando seus pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="empty-box">
          <h3>Nenhum pedido encontrado</h3>
          <p>Você ainda não realizou compras na VesteBem.</p>
          <button
            type="button"
            className="nav-btn primary"
            style={{ marginTop: '1rem' }}
            onClick={onCreateNewOrder}
          >
            Fazer meu primeiro pedido
          </button>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const totalItemsCount = order.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
                const statusClass = `status-${order.status.replace(/\s+/g, '-')}`;

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
                      {totalItemsCount} {totalItemsCount === 1 ? 'peça' : 'peças'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      R$ {Number(order.total_amount).toFixed(2)}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {order.status}
                      </span>
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
