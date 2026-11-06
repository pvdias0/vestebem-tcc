import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Product, ActiveView } from '../types';
import { useAuth } from '../context/AuthContext';

interface ProductDetailsPageProps {
  productId: number;
  onBack: () => void;
  onNavigate: (view: ActiveView) => void;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({ productId, onBack, onNavigate }) => {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getProductById(productId);
        setProduct(res.product);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Não foi possível carregar as informações do produto.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [productId]);

  return (
    <div className="card card-wide">
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          className="btn-link"
          style={{ marginBottom: '0.75rem', display: 'inline-block' }}
          onClick={onBack}
        >
          &larr; Voltar para o catálogo
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-box" style={{ padding: '3rem 0' }}>
          <div className="spinner"></div>
          <span>Carregando detalhes do produto...</span>
        </div>
      ) : product ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-customer">{product.category}</span>
                <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  Tamanho {product.size}
                </span>
              </div>
              <h1 className="card-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
                {product.name}
              </h1>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Código do produto: #{product.id}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                R$ {product.price.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.875rem', color: product.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {product.stock_quantity > 0 ? `${product.stock_quantity} unidades disponíveis em estoque` : 'Produto indisponível no momento'}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
              Descrição do produto
            </h2>
            <div style={{
              whiteSpace: 'pre-wrap',
              fontSize: '0.95rem',
              color: '#374151',
              backgroundColor: '#f9fafb',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              lineHeight: 1.6
            }}>
              {product.description}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {user ? (
              user.role === 'customer' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onNavigate('new-order')}
                >
                  Fazer pedido desta peça
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onNavigate('employee-products')}
                >
                  Editar produto no Painel
                </button>
              )
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('login')}
              >
                Entre para fazer um pedido
              </button>
            )}

            <button type="button" className="btn btn-outline" onClick={onBack}>
              Continuar navegando no catálogo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
