import React, { useState, useEffect } from 'react';
import { apiGetProducts, apiGetProductFilters } from './api';
import { Product, PaginationMeta } from './types';

interface ProductCatalogViewProps {
  onSelectProduct: (productId: number) => void;
  onGoToOrderWithProduct?: (productId: number) => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  onSelectProduct,
  onGoToOrderWithProduct
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 12,
    totalItems: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros e Ordenação
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Metadados de filtros
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  useEffect(() => {
    async function loadFilters() {
      try {
        const filters = await apiGetProductFilters();
        setAvailableCategories(filters.categories);
        setAvailableSizes(filters.sizes);
      } catch (err) {
        console.error('Erro ao carregar opções de filtros:', err);
      }
    }
    loadFilters();
  }, []);

  const loadProducts = async (pageNumber: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGetProducts({
        page: pageNumber,
        limit: 12,
        search,
        category,
        size,
        minPrice,
        maxPrice,
        sortBy,
        order
      });
      setProducts(res.products);
      setPagination(res.pagination);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar catálogo.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(1);
  }, [category, size, sortBy, order]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('');
    setSize('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('name');
    setOrder('asc');
    setTimeout(() => {
      loadProducts(1);
    }, 0);
  };

  return (
    <div className="catalog-container">
      <div>
        <h2 className="card-title">Catálogo de Roupas VesteBem</h2>
        <p className="card-subtitle">Confira nossa coleção exclusiva de peças e lançamentos</p>
      </div>

      {/* Barra de Pesquisa, Filtros e Ordenação */}
      <div className="filter-bar">
        <form onSubmit={handleSearchSubmit} className="filter-row">
          <input
            type="text"
            className="filter-input"
            placeholder="Pesquisar por nome ou descrição (ex: D'Água, Linho)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="nav-btn primary">
            Buscar
          </button>
          {(search || category || size || minPrice || maxPrice || sortBy !== 'name' || order !== 'asc') && (
            <button type="button" className="nav-btn secondary" onClick={handleClearFilters}>
              Limpar Filtros
            </button>
          )}
        </form>

        <div className="filter-row">
          <select
            className="filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas as Categorias</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="">Todos os Tamanhos</option>
            {availableSizes.map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>

          <input
            type="number"
            className="filter-input"
            style={{ maxWidth: '140px' }}
            placeholder="Preço Mín (R$)"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={() => loadProducts(1)}
          />

          <input
            type="number"
            className="filter-input"
            style={{ maxWidth: '140px' }}
            placeholder="Preço Máx (R$)"
            min="0"
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={() => loadProducts(1)}
          />

          <select
            className="filter-select"
            value={`${sortBy}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-') as ['name' | 'price', 'asc' | 'desc'];
              setSortBy(s);
              setOrder(o);
            }}
          >
            <option value="name-asc">Nome: A - Z</option>
            <option value="name-desc">Nome: Z - A</option>
            <option value="price-asc">Menor Preço</option>
            <option value="price-desc">Maior Preço</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Grid de Produtos */}
      {loading ? (
        <div className="loading-state">Carregando catálogo de roupas...</div>
      ) : products.length === 0 ? (
        <div className="empty-box container-card">
          <h3>Nenhum produto encontrado</h3>
          <p>Tente ajustar os termos de pesquisa ou remover alguns filtros.</p>
          <button type="button" className="nav-btn secondary" style={{ marginTop: '1rem' }} onClick={handleClearFilters}>
            Restaurar Filtros
          </button>
        </div>
      ) : (
        <>
          <div className="catalog-grid">
            {products.map((product) => (
              <div
                key={product.id}
                className="product-card"
                onClick={() => onSelectProduct(product.id)}
              >
                <div>
                  <span className="product-category-tag">{product.category}</span>
                  <h3 className="product-card-title">{product.name}</h3>
                  <p className="product-card-desc">{product.description}</p>
                </div>

                <div>
                  <div className="product-card-meta">
                    <span className="product-price">R$ {Number(product.price).toFixed(2)}</span>
                    <span className="product-size-badge">Tam: {product.size}</span>
                  </div>

                  <span className="product-stock-tag">
                    {product.stock_quantity > 0
                      ? `${product.stock_quantity} unidades em estoque`
                      : 'Esgotado'}
                  </span>

                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="nav-btn secondary"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(product.id);
                      }}
                    >
                      Ver Detalhes
                    </button>
                    {onGoToOrderWithProduct && (
                      <button
                        type="button"
                        className="nav-btn primary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGoToOrderWithProduct(product.id);
                        }}
                      >
                        Comprar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {pagination.totalPages > 1 && (
            <div className="pagination-container">
              <button
                type="button"
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => loadProducts(pagination.page - 1)}
              >
                ← Anterior
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pagination-btn ${pagination.page === p ? 'active' : ''}`}
                  onClick={() => loadProducts(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadProducts(pagination.page + 1)}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
