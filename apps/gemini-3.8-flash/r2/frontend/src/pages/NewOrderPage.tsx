import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Product, ActiveView, CreateOrderItemInput } from '../types';
import { useAuth } from '../context/AuthContext';

interface NewOrderPageProps {
  onOrderCreated: (orderId: number) => void;
  onNavigate: (view: ActiveView) => void;
}

interface SelectedItem {
  productId: number;
  quantity: number;
}

export const NewOrderPage: React.FC<NewOrderPageProps> = ({ onOrderCreated, onNavigate }) => {
  const { user } = useAuth();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [confirmDelivery, setConfirmDelivery] = useState<boolean>(true);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carregar produtos disponíveis do catálogo
  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoadingCatalog(true);
        const res = await api.getProducts({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
        setCatalogProducts(res.products);
        if (res.products.length > 0) {
          setSelectedItems([{ productId: res.products[0].id, quantity: 1 }]);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Não foi possível carregar os produtos do catálogo.');
        }
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  const handleProductChange = (index: number, newProductId: number) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], productId: newProductId };
      return updated;
    });
  };

  const handleQuantityChange = (index: number, newQtyStr: string) => {
    const qty = parseInt(newQtyStr, 10);
    setSelectedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: isNaN(qty) ? 1 : qty };
      return updated;
    });
  };

  const handleAddItem = () => {
    if (catalogProducts.length > 0) {
      setSelectedItems((prev) => [...prev, { productId: catalogProducts[0].id, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (selectedItems.length <= 1) {
      setError('O pedido deve conter pelo menos um item.');
      return;
    }
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

  const total = selectedItems.reduce((sum, item) => {
    const prod = productMap.get(item.productId);
    if (prod && item.quantity > 0) {
      return sum + prod.price * item.quantity;
    }
    return sum;
  }, 0);

  const hasAddress = Boolean(user?.address);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasAddress) {
      setError('Você precisa cadastrar um endereço de entrega na sua conta antes de finalizar o pedido.');
      return;
    }

    if (!confirmDelivery) {
      setError('Por favor, marque a caixa confirmando a utilização do seu endereço de entrega.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Selecione pelo menos um produto para o pedido.');
      return;
    }

    const payloadItems: CreateOrderItemInput[] = [];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      if (!item.productId || !productMap.has(item.productId)) {
        setError(`Selecione um produto válido para a linha ${i + 1}.`);
        return;
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setError(`A quantidade do item ${i + 1} deve ser um número inteiro e positivo.`);
        return;
      }
      payloadItems.push({
        product_id: item.productId,
        quantity: item.quantity,
      });
    }

    try {
      setSubmitting(true);
      const res = await api.createOrder(payloadItems, confirmDelivery);
      onOrderCreated(res.order.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao criar o pedido. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card card-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Criar novo pedido
          </h1>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Selecione as peças desejadas do catálogo e confirme o endereço para envio
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onNavigate('catalog')}
        >
          Ver catálogo completo
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Aviso se o cliente não tiver endereço cadastrado */}
      {!hasAddress && (
        <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span>Você ainda não possui um endereço de entrega cadastrado. É obrigatório cadastrá-lo para concluir pedidos.</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('account')}
          >
            Cadastrar Endereço na Minha Conta
          </button>
        </div>
      )}

      {loadingCatalog ? (
        <div className="loading-box" style={{ padding: '3rem 0' }}>
          <div className="spinner"></div>
          <span>Carregando peças do catálogo...</span>
        </div>
      ) : catalogProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Nenhum produto cadastrado no catálogo no momento.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {selectedItems.map((item, index) => {
            const product = productMap.get(item.productId);
            const unitPrice = product ? product.price : 0;
            const subtotal = unitPrice * (item.quantity > 0 ? item.quantity : 0);

            return (
              <div key={index} className="item-row" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Peça do Catálogo #{index + 1}</label>
                  <select
                    className="form-select"
                    value={item.productId}
                    onChange={(e) => handleProductChange(index, Number(e.target.value))}
                    disabled={submitting}
                  >
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Tam: {p.size}) - R$ {p.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Preço Unitário (Catálogo)</label>
                  <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#e5e7eb', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                    R$ {unitPrice.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Subtotal: R$ {subtotal.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={submitting || selectedItems.length <= 1}
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAddItem}
              disabled={submitting}
            >
              + Adicionar outro produto ao pedido
            </button>
          </div>

          {/* Seção de Confirmação de Endereço de Entrega */}
          {hasAddress && user?.address && (
            <div style={{ backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                Endereço de Entrega do Pedido
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.25rem' }}>
                <strong>Destinatário:</strong> {user.address.recipient} {user.phone && `| Tel: ${user.phone}`}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.75rem' }}>
                {user.address.street}, {user.address.number} {user.address.complement && `(${user.address.complement})`}, {user.address.neighborhood} - {user.address.city}/{user.address.state} (CEP: {user.address.zip_code})
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                <input
                  type="checkbox"
                  checked={confirmDelivery}
                  onChange={(e) => setConfirmDelivery(e.target.checked)}
                  disabled={submitting}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                />
                Confirmar a utilização deste endereço para o envio deste pedido
              </label>
            </div>
          )}

          <div className="total-bar">
            <span>Valor Total Calculado:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>

          <div className="form-actions" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('my-orders')}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !hasAddress}>
              {submitting ? 'Registrando pedido...' : 'Confirmar e Fechar Pedido'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
