import React, { useState, useEffect } from 'react';
import { api, type Product, type CreateOrderItemPayload } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface CreateOrderPageProps {
  initialProduct?: Product | null;
  onOrderCreated: (orderId: string) => void;
  onCancel: () => void;
  onGoToAccount: () => void;
}

interface FormItem {
  id: string;
  productId: string;
  quantity: string;
}

export const CreateOrderPage: React.FC<CreateOrderPageProps> = ({
  initialProduct,
  onOrderCreated,
  onCancel,
  onGoToAccount,
}) => {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [items, setItems] = useState<FormItem[]>([
    {
      id: '1',
      productId: initialProduct ? initialProduct.id : '',
      quantity: '1',
    },
  ]);
  const [confirmShipping, setConfirmShipping] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoadingCatalog(true);
        const res = await api.getProducts({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
        setCatalog(res.products);
        if (res.products.length > 0 && !initialProduct) {
          setItems([{ id: '1', productId: res.products[0].id, quantity: '1' }]);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar catálogo para pedido.');
      } finally {
        setLoadingCatalog(false);
      }
    };

    fetchCatalog();
  }, [initialProduct]);

  const handleAddItem = () => {
    const defaultProdId = catalog.length > 0 ? catalog[0].id : '';
    setItems((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), productId: defaultProdId, quantity: '1' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('O pedido deve conter pelo menos um item.');
      return;
    }
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getProduct = (productId: string): Product | undefined => {
    return catalog.find((p) => p.id === productId);
  };

  const calculatedTotal = items.reduce((acc, item) => {
    const product = getProduct(item.productId);
    const qty = parseInt(item.quantity, 10);
    if (product && !isNaN(qty) && qty > 0) {
      return acc + qty * product.price;
    }
    return acc;
  }, 0);

  const hasAddress = Boolean(
    user?.address &&
    user.address.recipientName &&
    user.address.cep &&
    user.address.street &&
    user.address.number &&
    user.address.city &&
    user.address.state
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasAddress) {
      setError('Você precisa cadastrar um endereço de entrega antes de finalizar o pedido.');
      return;
    }

    if (!confirmShipping) {
      setError('Você deve marcar a caixa confirmando a utilização do endereço de entrega exibido.');
      return;
    }

    if (catalog.length === 0) {
      setError('Não há produtos disponíveis no catálogo para criar um pedido.');
      return;
    }

    const payloadItems: CreateOrderItemPayload[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        setError(`Item ${i + 1}: selecione uma peça do catálogo.`);
        return;
      }

      const product = getProduct(item.productId);
      if (!product) {
        setError(`Item ${i + 1}: produto selecionado inválido.`);
        return;
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0 || String(qty) !== item.quantity.trim()) {
        setError(`Item ${i + 1} ("${product.name}"): a quantidade deve ser um número inteiro e positivo.`);
        return;
      }

      payloadItems.push({
        productId: product.id,
        quantity: qty,
      });
    }

    try {
      setSubmitting(true);
      const res = await api.createOrder(payloadItems, confirmShipping);
      onOrderCreated(res.order.id);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCatalog) {
    return (
      <div className="page-card max-w-3xl text-center py-8">
        <p className="text-muted">Carregando catálogo de produtos...</p>
      </div>
    );
  }

  return (
    <div className="page-card max-w-3xl">
      <div className="page-header">
        <div>
          <h2>Criar novo pedido</h2>
          <p className="page-subtitle">Selecione as peças e confirme o endereço de entrega</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Verificação do Endereço de Entrega */}
      {!hasAddress ? (
        <div className="shipping-warning-box">
          <div className="warning-content">
            <span className="warning-icon">📍</span>
            <div>
              <h4 className="font-semibold text-danger">Endereço de entrega não cadastrado</h4>
              <p className="text-sm text-muted">
                Para concluir um pedido na VesteBem, é obrigatório possuir um endereço de entrega cadastrado em sua conta.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-3"
            onClick={onGoToAccount}
          >
            Cadastrar endereço agora na Minha Conta
          </button>
        </div>
      ) : (
        <div className="shipping-confirmation-box">
          <h4 className="section-title text-sm mt-0">Endereço de entrega cadastrado:</h4>
          <div className="shipping-info-preview">
            <p className="font-medium text-main">
              <strong>Destinatário:</strong> {user?.address?.recipientName}
            </p>
            <p className="text-sm text-muted">
              {user?.address?.street}, {user?.address?.number}{' '}
              {user?.address?.complement ? `(${user?.address?.complement})` : ''} -{' '}
              {user?.address?.neighborhood}, {user?.address?.city}/{user?.address?.state} - CEP:{' '}
              {user?.address?.cep}
            </p>
            {user?.phone && (
              <p className="text-sm text-muted">
                <strong>Telefone para contato:</strong> {user.phone}
              </p>
            )}
          </div>

          <label className="checkbox-label mt-2">
            <input
              type="checkbox"
              checked={confirmShipping}
              onChange={(e) => setConfirmShipping(e.target.checked)}
              disabled={submitting}
            />
            <span>Confirmo a utilização deste endereço e telefone para entrega deste pedido</span>
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <h3 className="section-title">Peças selecionadas</h3>
        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>Peça do Catálogo</th>
                <th style={{ width: '100px' }}>Qtd.</th>
                <th style={{ width: '130px' }} className="text-right">Preço Unit.</th>
                <th style={{ width: '130px' }} className="text-right">Subtotal</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const product = getProduct(item.productId);
                const qty = parseInt(item.quantity, 10);
                const subtotal = product && !isNaN(qty) && qty > 0 ? qty * product.price : 0;

                return (
                  <tr key={item.id}>
                    <td>
                      <select
                        className="form-control"
                        value={item.productId}
                        disabled={submitting}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      >
                        {catalog.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.category} | Tam: {p.size} - R$ {p.price.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        disabled={submitting}
                        required
                      />
                    </td>
                    <td className="text-right font-medium">
                      R$ {product ? product.price.toFixed(2) : '0.00'}
                    </td>
                    <td className="text-right font-semibold text-primary">
                      R$ {subtotal.toFixed(2)}
                    </td>
                    <td className="text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon-danger"
                          title="Remover peça"
                          onClick={() => handleRemoveItem(index)}
                          disabled={submitting}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="order-form-controls">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleAddItem}
            disabled={submitting}
          >
            + Adicionar outra peça
          </button>

          <div className="order-total-preview">
            <span className="total-label">Total calculado:</span>
            <span className="total-value">R$ {calculatedTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="form-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !hasAddress}
          >
            {submitting ? 'Gravando pedido...' : 'Finalizar Pedido com este Endereço'}
          </button>
        </div>
      </form>
    </div>
  );
};
