import React, { useEffect, useState } from 'react';
import { api, type Product } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface ProductDetailsPageProps {
  productId: string;
  onBack: () => void;
  onOrderNow?: (product: Product) => void;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({
  productId,
  onBack,
  onOrderNow,
}) => {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getProductById(productId);
        setProduct(res.product);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar detalhes do produto.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="page-card max-w-3xl text-center py-8">
        <p className="text-muted">Carregando detalhes do produto...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-card max-w-3xl">
        <div className="alert alert-error">{error || 'Produto não encontrado.'}</div>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          ← Voltar para o catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="page-card max-w-3xl">
      <div className="product-details-container">
        <button type="button" className="btn-inline text-sm mb-4" onClick={onBack}>
          ← Voltar ao catálogo
        </button>

        <div className="product-details-header">
          <div className="product-badges">
            <span className="badge-category">{product.category}</span>
            <span className="badge-size">Tamanho: {product.size}</span>
          </div>
          <h2 className="product-title-lg">{product.name}</h2>
          <div className="product-price-lg">R$ {product.price.toFixed(2)}</div>
        </div>

        <div className="product-details-body">
          <h3 className="section-title">Descrição da Peça</h3>
          <p className="product-full-description">
            {product.description}
          </p>

          <div className="product-specs-box">
            <div className="spec-row">
              <span className="spec-label">Disponibilidade:</span>
              <span className={`spec-value font-semibold ${product.stock > 0 ? 'text-success' : 'text-danger'}`}>
                {product.stock > 0 ? `${product.stock} unidades em estoque` : 'Produto indisponível no momento'}
              </span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Código de referência:</span>
              <span className="spec-value font-mono">{product.id}</span>
            </div>
          </div>

          <div className="product-details-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onBack}
            >
              Continuar navegando
            </button>

            {onOrderNow && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onOrderNow(product)}
              >
                {user ? 'Fazer pedido desta peça' : 'Entrar para comprar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
