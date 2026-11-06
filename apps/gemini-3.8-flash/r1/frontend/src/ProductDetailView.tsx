import React, { useState, useEffect } from 'react';
import { apiGetProductById } from './api';
import { Product } from './types';

interface ProductDetailViewProps {
  productId: number;
  onBack: () => void;
  onGoToOrderWithProduct?: (productId: number) => void;
  canEdit?: boolean;
  onEditProduct?: (productId: number) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  productId,
  onBack,
  onGoToOrderWithProduct,
  canEdit,
  onEditProduct
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGetProductById(productId);
        setProduct(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Erro ao carregar detalhes do produto.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  if (loading) {
    return (
      <div className="container-card">
        <div className="loading-state">Carregando informações da peça...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container-card">
        <div className="alert alert-danger">{error || 'Produto não encontrado.'}</div>
        <button type="button" className="nav-btn secondary" onClick={onBack}>
          ← Voltar para o Catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="container-card">
      <div style={{ marginBottom: '1.25rem' }}>
        <button type="button" className="link-btn" onClick={onBack}>
          ← Voltar ao Catálogo
        </button>
      </div>

      <div className="product-detail-layout">
        <div className="product-detail-info">
          <div>
            <span className="product-category-tag">{product.category}</span>
            <h1 className="card-title" style={{ fontSize: '1.85rem' }}>{product.name}</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Identificador do produto: #{product.id}
            </span>
          </div>

          <div className="product-detail-price">
            R$ {Number(product.price).toFixed(2)}
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="product-size-badge" style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
              Tamanho: {product.size}
            </span>
            <span className="status-badge" style={{
              backgroundColor: product.stock_quantity > 0 ? 'var(--badge-enviado-bg)' : 'var(--badge-canc-bg)',
              color: product.stock_quantity > 0 ? 'var(--badge-enviado-text)' : 'var(--badge-canc-text)'
            }}>
              {product.stock_quantity > 0
                ? `${product.stock_quantity} peças disponíveis em estoque`
                : 'Produto Esgotado'}
            </span>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Descrição da Peça
            </h4>
            <div className="product-detail-desc">
              {product.description}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {onGoToOrderWithProduct && (
              <button
                type="button"
                className="nav-btn primary"
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                onClick={() => onGoToOrderWithProduct(product.id)}
              >
                Comprar Agora
              </button>
            )}

            {canEdit && onEditProduct && (
              <button
                type="button"
                className="nav-btn secondary"
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                onClick={() => onEditProduct(product.id)}
              >
                Editar Produto (Funcionário)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
