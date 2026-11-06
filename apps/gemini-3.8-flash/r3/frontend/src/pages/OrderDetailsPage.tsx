import React, { useEffect, useState } from 'react';
import { api, type Order } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface OrderDetailsPageProps {
  orderId: string;
  onBack: () => void;
}

export const OrderDetailsPage: React.FC<OrderDetailsPageProps> = ({ orderId, onBack }) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getOrderById(orderId);
        setOrder(res.order);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar detalhes do pedido.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

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
      <div className="page-card max-w-3xl text-center py-8">
        <p className="text-muted">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page-card max-w-3xl">
        <div className="alert alert-error">{error || 'Pedido não encontrado.'}</div>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="page-card max-w-3xl">
      <div className="page-header flex-between">
        <div>
          <button type="button" className="btn-inline text-sm mb-2" onClick={onBack}>
            ← Voltar para listagem
          </button>
          <h2>Pedido #{order.id}</h2>
          <p className="page-subtitle">Realizado em {formatDate(order.createdAt)}</p>
        </div>
        <div>
          <span className={`status-badge text-base ${getStatusBadgeClass(order.status)}`}>
            {order.status}
          </span>
        </div>
      </div>

      {user?.role === 'employee' && (
        <div className="order-customer-banner">
          <span className="font-semibold">Cliente da conta:</span> {order.customerName} ({order.customerEmail})
        </div>
      )}

      {/* Informações de Entrega do Pedido */}
      <div className="shipping-details-card">
        <h3 className="section-title text-sm mt-0">Dados de Entrega do Pedido</h3>
        {order.shipping ? (
          <div className="shipping-info-grid">
            <div className="shipping-field">
              <span className="field-label">Destinatário:</span>
              <span className="field-value font-semibold">{order.shipping.recipientName}</span>
            </div>
            {order.shipping.phone && (
              <div className="shipping-field">
                <span className="field-label">Telefone:</span>
                <span className="field-value">{order.shipping.phone}</span>
              </div>
            )}
            <div className="shipping-field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">Endereço de envio:</span>
              <span className="field-value">
                {order.shipping.street}, {order.shipping.number}{' '}
                {order.shipping.complement ? `(${order.shipping.complement})` : ''} -{' '}
                {order.shipping.neighborhood}, {order.shipping.city}/{order.shipping.state}
              </span>
            </div>
            <div className="shipping-field">
              <span className="field-label">CEP:</span>
              <span className="field-value font-mono">{order.shipping.cep}</span>
            </div>
          </div>
        ) : (
          <div className="shipping-empty-note">
            <p className="text-muted text-sm">
              ℹ️ Este pedido foi criado antes da implementação do sistema de entregas e não possui informações de entrega registradas.
            </p>
          </div>
        )}
      </div>

      <h3 className="section-title">Itens do pedido</h3>
      <div className="items-table-container">
        <table className="items-table">
          <thead>
            <tr>
              <th>Descrição da peça</th>
              <th className="text-center" style={{ width: '90px' }}>Qtd.</th>
              <th className="text-right" style={{ width: '130px' }}>Preço Unit.</th>
              <th className="text-right" style={{ width: '130px' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="font-medium">
                  {item.productName ? item.productName : item.description}
                  {item.productId && (
                    <span className="text-xs text-muted block">ID Peça: {item.productId}</span>
                  )}
                </td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">R$ {item.unitPrice.toFixed(2)}</td>
                <td className="text-right font-semibold">R$ {item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right font-bold">Total do Pedido:</td>
              <td className="text-right font-bold text-lg text-primary">
                R$ {order.totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="order-details-meta">
        <div className="meta-item">
          <span className="meta-label">Última atualização:</span>
          <span className="meta-value">{formatDate(order.updatedAt)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Identificador único:</span>
          <span className="meta-value font-mono">{order.id}</span>
        </div>
      </div>
    </div>
  );
};
