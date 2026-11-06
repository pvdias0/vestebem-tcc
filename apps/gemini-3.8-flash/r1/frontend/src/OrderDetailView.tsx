import React, { useState, useEffect } from 'react';
import { apiGetOrderById, apiUpdateOrderStatus } from './api';
import { Order, OrderStatus, UserRole } from './types';

interface OrderDetailViewProps {
  orderId: number;
  userRole: UserRole;
  onBack: () => void;
  onSelectProduct?: (productId: number) => void;
}

const ALL_STATUSES: OrderStatus[] = ['recebido', 'em preparação', 'enviado', 'cancelado'];

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  orderId,
  userRole,
  onBack,
  onSelectProduct
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('recebido');

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetOrderById(orderId);
      setOrder(data);
      setSelectedStatus(data.status);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar detalhes do pedido.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleUpdateStatus = async () => {
    if (!order || selectedStatus === order.status) return;

    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);
      const updated = await apiUpdateOrderStatus(order.id, selectedStatus);
      setOrder(updated);
      setSuccess(`Status atualizado com sucesso para "${updated.status}".`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao atualizar status do pedido.');
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container-card">
        <div className="loading-state">Carregando detalhes do pedido #{orderId}...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="container-card">
        <div className="alert alert-danger">{error}</div>
        <button type="button" className="nav-btn secondary" onClick={onBack}>
          ← Voltar
        </button>
      </div>
    );
  }

  if (!order) return null;

  const statusClass = `status-${order.status.replace(/\s+/g, '-')}`;

  return (
    <div className="container-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button type="button" className="link-btn" onClick={onBack} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
            ← Voltar para lista de pedidos
          </button>
          <h2 className="card-title">Pedido #{order.id}</h2>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Realizado em{' '}
            {new Date(order.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        <div>
          <span className={`status-badge ${statusClass}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}>
            {order.status}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div>
          <span className="info-label">Cliente Responsável</span>
          <div style={{ fontWeight: 600 }}>{order.customer_name || `Cliente #${order.customer_id}`}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.customer_email}</div>
        </div>

        <div>
          <span className="info-label">Status Atual</span>
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{order.status}</div>
        </div>

        <div>
          <span className="info-label">Valor Total</span>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>
            R$ {Number(order.total_amount).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Dados de Entrega do Pedido */}
      <div style={{ background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.75rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
          📦 Dados de Entrega para Envio
        </h4>
        {order.delivery_street ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
            <div>
              <span className="info-label">Destinatário</span>
              <div style={{ fontWeight: 600 }}>{order.delivery_recipient_name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Telefone: {order.delivery_phone || 'Não informado'}
              </div>
            </div>

            <div>
              <span className="info-label">Endereço Completo</span>
              <div>
                {order.delivery_street}, {order.delivery_number}
                {order.delivery_complement ? ` - ${order.delivery_complement}` : ''}
              </div>
              <div>{order.delivery_neighborhood}</div>
            </div>

            <div>
              <span className="info-label">Localidade & CEP</span>
              <div>{order.delivery_city} - {order.delivery_state}</div>
              <div style={{ fontWeight: 500 }}>CEP: {order.delivery_cep}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Este pedido foi realizado sem informações de entrega registradas (anterior à integração de entregas).
          </div>
        )}
      </div>

      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', fontWeight: 600 }}>Peças do Pedido</h3>
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Descrição / Peça</th>
              <th style={{ textAlign: 'center' }}>Quantidade</th>
              <th style={{ textAlign: 'right' }}>Preço Unitário</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              {onSelectProduct && <th style={{ textAlign: 'center' }}>Catálogo</th>}
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, idx) => (
              <tr key={item.id || idx}>
                <td style={{ fontWeight: 500 }}>
                  {item.description}
                  {item.product_id ? (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Cód. Produto: #{item.product_id}
                    </span>
                  ) : null}
                </td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>R$ {Number(item.unit_price).toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  R$ {Number(item.total_price || (item.quantity * item.unit_price)).toFixed(2)}
                </td>
                {onSelectProduct && (
                  <td style={{ textAlign: 'center' }}>
                    {item.product_id ? (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => onSelectProduct(item.product_id!)}
                      >
                        Ver Peça
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block' }}>Total do Pedido:</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
            R$ {Number(order.total_amount).toFixed(2)}
          </span>
        </div>
      </div>

      {userRole === 'employee' && (
        <div style={{ marginTop: '2rem', padding: '1.25rem', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px' }}>
          <h4 style={{ color: '#854d0e', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Painel do Funcionário: Atualizar Status</h4>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ maxWidth: '220px' }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
              disabled={updating}
            >
              {ALL_STATUSES.map(st => (
                <option key={st} value={st}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="nav-btn primary"
              onClick={handleUpdateStatus}
              disabled={updating || selectedStatus === order.status}
            >
              {updating ? 'Salvando...' : 'Salvar Novo Status'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
