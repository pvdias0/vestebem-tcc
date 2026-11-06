import React, { useEffect, useState, useCallback } from 'react';
import { api, type Product } from '../services/api.js';

interface CatalogPageProps {
  onSelectProduct: (productId: string) => void;
  onOrderProduct?: (product: Product) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ onSelectProduct, onOrderProduct }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros e paginação
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Opções disponíveis vindas do backend
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  const fetchProducts = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getProducts({
        search: search.trim() || undefined,
        category: category || undefined,
        size: size || undefined,
        minPrice: minPrice !== '' ? Number(minPrice) : undefined,
        maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
        sortBy,
        sortOrder,
        page: targetPage,
        limit: 12,
      });

      setProducts(res.products);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
      setPage(res.page);
      if (res.categories && res.categories.length > 0) {
        setAvailableCategories(res.categories);
      }
      if (res.sizes && res.sizes.length > 0) {
        setAvailableSizes(res.sizes);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar catálogo.');
    } finally {
      setLoading(false);
    }
  }, [search, category, size, minPrice, maxPrice, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchProducts(1);
  }, [category, size, minPrice, maxPrice, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('');
    setSize('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('name');
    setSortOrder('asc');
  };

  return (
    <div className="page-card max-w-6xl">
      <div className="catalog-header">
        <div>
          <h2>Catálogo de Roupas</h2>
          <p className="page-subtitle">Confira nossa coleção exclusiva de peças e estilos</p>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="catalog-filters-panel">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome ou descrição (ex: Coleção D'Água)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Buscar
            </button>
          </div>
        </form>

        <div className="filters-grid">
          <div className="filter-group">
            <label>Categoria:</label>
            <select
              className="form-control form-control-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Tamanho:</label>
            <select
              className="form-control form-control-sm"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="">Todos os tamanhos</option>
              {availableSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Preço Mínimo (R$):</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className="form-control form-control-sm"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Preço Máximo (R$):</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Ex: 300"
              className="form-control form-control-sm"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Ordenar por:</label>
            <div className="flex-row gap-1">
              <select
                className="form-control form-control-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'price')}
              >
                <option value="name">Nome</option>
                <option value="price">Preço</option>
              </select>
              <select
                className="form-control form-control-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              >
                <option value="asc">Crescente (A-Z ou menor preço)</option>
                <option value="desc">Decrescente (Z-A ou maior preço)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="filter-actions-bar">
          <span className="results-count">
            {totalCount} {totalCount === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleClearFilters}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container py-8">
          <p className="text-muted">Carregando catálogo...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <h3>Nenhum produto encontrado</h3>
          <p className="text-muted">Tente ajustar seus termos de pesquisa ou filtros aplicados.</p>
          <button
            type="button"
            className="btn btn-outline mt-4"
            onClick={handleClearFilters}
          >
            Ver todos os produtos
          </button>
        </div>
      ) : (
        <>
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-card-top">
                  <span className="badge-category">{product.category}</span>
                  <span className="badge-size">Tam: {product.size}</span>
                </div>

                <h3 className="product-card-title" onClick={() => onSelectProduct(product.id)}>
                  {product.name}
                </h3>

                <p className="product-card-desc">
                  {product.description}
                </p>

                <div className="product-card-footer">
                  <div className="product-price-block">
                    <span className="price-tag">R$ {product.price.toFixed(2)}</span>
                    <span className="stock-info">
                      {product.stock > 0 ? `${product.stock} em estoque` : 'Esgotado'}
                    </span>
                  </div>

                  <div className="product-card-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => onSelectProduct(product.id)}
                    >
                      Detalhes
                    </button>
                    {onOrderProduct && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onOrderProduct(product)}
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
          {totalPages > 1 && (
            <div className="pagination-bar">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => fetchProducts(page - 1)}
              >
                ← Anterior
              </button>

              <span className="page-indicator">
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page >= totalPages}
                onClick={() => fetchProducts(page + 1)}
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
