import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Order, OrderStatus, ActiveView } from '../types';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { useAuth } from '../context/AuthContext';

interface OrderDetailsPageProps {
  orderId: number;
  onBack: () => void;
  onNavigate: (view: ActiveView) => void;
}

export const OrderDetailsPage: React.FC<OrderDetailsPageProps> = ({ orderId, onBack }) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Estados para funcionário alterar status
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('recebido');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getOrderById(orderId);
        setOrder(res.order);
        setSelectedStatus(res.order.status);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Não foi possível carregar os detalhes do pedido.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      setUpdatingStatus(true);
      setStatusMessage(null);
      setError(null);
      const res = await api.updateOrderStatus(order.id, selectedStatus);
      setOrder(res.order);
      setStatusMessage('Status atualizado com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao atualizar status do pedido.');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isEmployee = user?.role === 'employee';

  return (
    <div className="card card-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <button
            type="button"
            className="btn-link"
            style={{ marginBottom: '0.5rem', display: 'inline-block' }}
            onClick={onBack}
          >
            &larr; Voltar para a listagem
          </button>
          <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Detalhes do Pedido #{orderId}
          </h1>
        </div>
        {order && <OrderStatusBadge status={order.status} />}
      </div>

      {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-box" style={{ padding: '2rem 0' }}>
          <div className="spinner"></div>
          <span>Carregando dados do pedido...</span>
        </div>
      ) : order ? (
        <>
          {/* Informações Gerais do Pedido */}
          <div className="info-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="info-item">
              <span className="info-label">Identificador</span>
              <span className="info-value">#{order.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Cliente Responsável</span>
              <span className="info-value">{order.customer_name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">E-mail do Cliente</span>
              <span className="info-value">{order.customer_email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Data de Criação</span>
              <span className="info-value">
                {new Date(order.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Dados de Envio e Entrega Preservados no Pedido */}
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
              Informações de Entrega e Envio
            </h3>
            {order.has_delivery_info ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Destinatário
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                    {order.delivery_recipient || 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Telefone de Contato
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                    {order.delivery_phone || 'Não informado'}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Endereço de Entrega
                  </span>
                  <div style={{ fontSize: '0.95rem', color: '#374151', marginTop: '0.15rem' }}>
                    {order.delivery_street}, {order.delivery_number} {order.delivery_complement && `(${order.delivery_complement})`}
                    <br />
                    {order.delivery_neighborhood} - {order.delivery_city}/{order.delivery_state}
                    <br />
                    CEP: {order.delivery_zip_code}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                Este pedido não possui informações de entrega registradas (pedido anterior à integração de entrega).
              </p>
            )}
          </div>

          {/* Painel do Funcionário para alterar status */}
          {isEmployee && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>
                Painel do Funcionário: Atualizar Status do Pedido
              </h3>
              <form onSubmit={handleStatusChange} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  style={{ maxWidth: '240px' }}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  disabled={updatingStatus}
                >
                  <option value="recebido">recebido</option>
                  <option value="em preparação">em preparação</option>
                  <option value="enviado">enviado</option>
                  <option value="cancelado">cancelado</option>
                </select>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={updatingStatus || selectedStatus === order.status}
                >
                  {updatingStatus ? 'Salvando...' : 'Salvar novo status'}
                </button>
              </form>
            </div>
          )}

          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Peças do pedido
          </h2>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Descrição da peça</th>
                  <th style={{ textAlign: 'center' }}>Quantidade</th>
                  <th style={{ textAlign: 'right' }}>Preço Unitário Praticado</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product_name || item.description}</strong>
                      {item.product_id && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>
                          Código produto: #{item.product_id}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>R$ {item.unit_price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>R$ {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="total-bar">
            <span>Valor Total:</span>
            <span>R$ {order.total.toFixed(2)}</span>
          </div>

          <div className="form-actions" style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-outline" onClick={onBack}>
              Voltar
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
