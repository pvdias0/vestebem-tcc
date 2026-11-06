import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Order, ActiveView } from '../types';
import { OrderStatusBadge } from '../components/OrderStatusBadge';

interface MyOrdersPageProps {
  onSelectOrder: (orderId: number) => void;
  onNavigate: (view: ActiveView) => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ onSelectOrder, onNavigate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        setLoading(true);
        const res = await api.getMyOrders();
        setOrders(res.orders);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Não foi possível carregar os pedidos.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className="card card-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Meus pedidos
          </h1>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Acompanhe o histórico e o status dos seus pedidos
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate('new-order')}
        >
          + Fazer novo pedido
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-box" style={{ padding: '2rem 0' }}>
          <div className="spinner"></div>
          <span>Buscando seus pedidos...</span>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Você ainda não realizou nenhum pedido.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('new-order')}
          >
            Criar meu primeiro pedido
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const totalItemsCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
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
                    <td>{formattedDate}</td>
                    <td>{totalItemsCount} {totalItemsCount === 1 ? 'peça' : 'peças'}</td>
                    <td>
                      <strong>R$ {order.total.toFixed(2)}</strong>
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
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
