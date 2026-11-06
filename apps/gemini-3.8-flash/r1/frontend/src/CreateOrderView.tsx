import React, { useState, useEffect } from 'react';
import { apiCreateOrder, apiGetProducts } from './api';
import { Order, Product, User } from './types';

interface OrderItemSelection {
  productId: number;
  quantity: number;
}

interface CreateOrderViewProps {
  currentUser: User;
  onOrderCreated: (order: Order) => void;
  onCancel: () => void;
  onGoToAddressSettings: () => void;
  initialProductId?: number | null;
}

export const CreateOrderView: React.FC<CreateOrderViewProps> = ({
  currentUser,
  onOrderCreated,
  onCancel,
  onGoToAddressSettings,
  initialProductId
}) => {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [items, setItems] = useState<OrderItemSelection[]>([
    { productId: initialProductId || 0, quantity: 1 }
  ]);
  const [confirmAddress, setConfirmAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCompleteAddress = Boolean(
    currentUser.recipient_name &&
    currentUser.cep &&
    currentUser.street &&
    currentUser.number &&
    currentUser.neighborhood &&
    currentUser.city &&
    currentUser.state
  );

  useEffect(() => {
    async function fetchCatalog() {
      try {
        setLoadingCatalog(true);
        const res = await apiGetProducts({ limit: 100, sortBy: 'name', order: 'asc' });
        setCatalog(res.products);

        if (initialProductId && res.products.some(p => p.id === initialProductId)) {
          setItems([{ productId: initialProductId, quantity: 1 }]);
        } else if (res.products.length > 0 && items[0].productId === 0) {
          setItems([{ productId: res.products[0].id, quantity: 1 }]);
        }
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        setError('Não foi possível carregar a lista de produtos do catálogo.');
      } finally {
        setLoadingCatalog(false);
      }
    }
    fetchCatalog();
  }, [initialProductId]);

  const handleAddItem = () => {
    if (catalog.length === 0) return;
    const defaultId = catalog[0].id;
    setItems(prev => [...prev, { productId: defaultId, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setError('O pedido precisa ter pelo menos um item.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItemSelection, value: number) => {
    setError(null);
    setItems(prev => {
      const next = [...prev];
      if (field === 'productId') {
        next[index].productId = value;
      } else if (field === 'quantity') {
        next[index].quantity = Math.max(1, value);
      }
      return next;
    });
  };

  const calculateTotal = (): number => {
    return items.reduce((acc, it) => {
      const product = catalog.find(p => p.id === it.productId);
      if (!product) return acc;
      return acc + (it.quantity * product.price);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasCompleteAddress) {
      setError('Você precisa cadastrar um endereço de entrega na sua conta antes de fazer um pedido.');
      return;
    }

    if (!confirmAddress) {
      setError('Por favor, marque a caixa confirmando o endereço de entrega para prosseguir.');
      return;
    }

    if (items.length === 0) {
      setError('Adicione pelo menos um produto ao pedido.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId || !catalog.some(p => p.id === it.productId)) {
        setError(`Selecione um produto válido para o item #${i + 1}.`);
        return;
      }
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
        setError(`A quantidade do item #${i + 1} deve ser inteira e positiva.`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = items.map(it => ({
        product_id: it.productId,
        quantity: it.quantity
      }));

      const created = await apiCreateOrder(payload, confirmAddress);
      onOrderCreated(created);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao criar o pedido.');
      }
    } finally {
      setLoading(false);
    }
  };

  const totalCalculated = calculateTotal();

  if (loadingCatalog) {
    return (
      <div className="container-card">
        <div className="loading-state">Carregando catálogo para o pedido...</div>
      </div>
    );
  }

  return (
    <div className="container-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 className="card-title">Novo Pedido</h2>
          <p className="card-subtitle">Selecione peças do catálogo e confirme o endereço de entrega</p>
        </div>
        <button type="button" className="nav-btn secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Caixa de Verificação de Endereço de Entrega */}
      <div style={{ background: hasCompleteAddress ? '#f8fafc' : '#fffbeb', border: `1px solid ${hasCompleteAddress ? 'var(--border-color)' : '#fef08a'}`, padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: hasCompleteAddress ? 'var(--primary)' : '#92400e', marginBottom: '0.25rem' }}>
              {hasCompleteAddress ? 'Endereço de Entrega Cadastrado' : '⚠️ Endereço de Entrega Pendente'}
            </h3>
            {hasCompleteAddress ? (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <strong>Destinatário:</strong> {currentUser.recipient_name} | <strong>Telefone:</strong> {currentUser.phone || 'Não informado'}<br />
                {currentUser.street}, {currentUser.number} {currentUser.complement ? `(${currentUser.complement})` : ''} - {currentUser.neighborhood}<br />
                {currentUser.city} / {currentUser.state} - CEP: {currentUser.cep}
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: '#92400e' }}>
                Para finalizar pedidos na VesteBem, você precisa ter um endereço de entrega completo cadastrado em sua conta.
              </div>
            )}
          </div>

          <button
            type="button"
            className="nav-btn secondary"
            style={{ fontSize: '0.85rem' }}
            onClick={onGoToAddressSettings}
          >
            {hasCompleteAddress ? 'Editar Endereço na Conta' : 'Cadastrar Endereço Agora'}
          </button>
        </div>

        {hasCompleteAddress && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={confirmAddress}
                onChange={(e) => setConfirmAddress(e.target.checked)}
                disabled={loading}
              />
              Confirmo a utilização deste endereço de entrega para este pedido
            </label>
          </div>
        )}
      </div>

      {catalog.length === 0 ? (
        <div className="empty-box">
          <h3>Nenhum produto disponível no catálogo</h3>
          <p>Aguarde a equipe cadastrar peças para poder fazer pedidos.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="items-list-header">
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Peças Selecionadas</span>
            <button
              type="button"
              className="nav-btn secondary"
              onClick={handleAddItem}
              disabled={loading}
            >
              + Adicionar Outra Peça
            </button>
          </div>

          {items.map((item, index) => {
            const selectedProd = catalog.find(p => p.id === item.productId);
            const unitPrice = selectedProd ? selectedProd.price : 0;
            const itemSubtotal = item.quantity * unitPrice;

            return (
              <div key={index} className="order-product-picker-row">
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Peça do Catálogo</label>
                  <select
                    className="form-select"
                    value={item.productId}
                    onChange={(e) => handleItemChange(index, 'productId', Number(e.target.value))}
                    disabled={loading}
                    required
                  >
                    {catalog.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Tam: {p.size} (R$ {Number(p.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Qtd.</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Preço Unit.</label>
                  <div style={{ padding: '0.65rem 0.5rem', fontSize: '0.95rem', fontWeight: 500 }}>
                    R$ {Number(unitPrice).toFixed(2)}
                  </div>
                </div>

                <div className="item-total-preview">
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subtotal</span>
                  <span>R$ {itemSubtotal.toFixed(2)}</span>
                </div>

                <div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-item"
                      title="Remover peça"
                      onClick={() => handleRemoveItem(index)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="order-summary-box">
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block' }}>
                Total Geral calculado ({items.length} {items.length === 1 ? 'item' : 'itens'})
              </span>
              <span className="order-summary-total">R$ {totalCalculated.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              className="submit-btn"
              style={{ width: 'auto', padding: '0.75rem 2.5rem' }}
              disabled={loading || !hasCompleteAddress}
            >
              {loading ? 'Processando Pedido...' : 'Concluir Pedido'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
