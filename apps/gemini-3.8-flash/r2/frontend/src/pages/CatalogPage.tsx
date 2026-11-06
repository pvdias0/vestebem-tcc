import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Product, ActiveView } from '../types';

interface CatalogPageProps {
  onSelectProduct: (productId: number) => void;
  onNavigate: (view: ActiveView) => void;
  onAddToCart?: (product: Product) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ onSelectProduct, onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Opções de categorias e tamanhos
  const [categories, setCategories] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);

  // Carregar opções de filtros
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const res = await api.getProductFilters();
        setCategories(res.categories);
        setSizes(res.sizes);
      } catch {
        // silencioso
      }
    }
    loadFilterOptions();
  }, []);

  // Buscar produtos
  const fetchProducts = async (currentPage = page) => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getProducts({
        page: currentPage,
        limit: 12,
        search: search.trim() || undefined,
        category: category || undefined,
        size: size || undefined,
        minPrice: minPrice ? parseFloat(minPrice.replace(',', '.')) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice.replace(',', '.')) : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      });

      setProducts(res.products);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao carregar o catálogo de produtos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, [category, size, sortBy, sortOrder]);

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
    setSortBy('');
    setSortOrder('asc');
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
          Catálogo VesteBem
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
          Explore nossa seleção exclusiva com peças de qualidade e design atemporal
        </p>
      </div>

      {/* Painel de Busca e Filtros */}
      <div className="card" style={{ maxWidth: '100%', marginBottom: '2rem', padding: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Pesquisar produto</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex.: Coleção D'Água, Camisa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Categoria</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tamanho</label>
              <select
                className="form-select"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="">Todos os tamanhos</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Faixa de Preço (R$)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span>-</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ordenar por</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="">Padrão</option>
                  <option value="name">Nome</option>
                  <option value="price">Preço</option>
                </select>
                {sortBy && (
                  <select
                    className="form-select"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                  >
                    <option value="asc">Crescente</option>
                    <option value="desc">Decrescente</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClearFilters}>
              Limpar filtros
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Buscar produtos
            </button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {total} {total === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onNavigate('new-order')}
        >
          + Fazer um pedido
        </button>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="loading-box" style={{ padding: '4rem 0' }}>
          <div className="spinner"></div>
          <span>Buscando produtos...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ maxWidth: '100%', textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Nenhum produto encontrado com os filtros selecionados.
          </p>
          <button type="button" className="btn btn-outline" onClick={handleClearFilters}>
            Limpar filtros e ver todos
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {products.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{
                maxWidth: '100%',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                cursor: 'pointer',
              }}
              onClick={() => onSelectProduct(p.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span className="badge badge-customer">{p.category}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Tam: {p.size}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
                  {p.name}
                </h3>

                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '1rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {p.description}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    R$ {p.price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: p.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {p.stock_quantity > 0 ? `${p.stock_quantity} em estoque` : 'Esgotado'}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct(p.id);
                  }}
                >
                  Ver detalhes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação (12 por página) */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '3rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchProducts(page - 1)}
          >
            &laquo; Anterior
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => fetchProducts(page + 1)}
          >
            Próxima &raquo;
          </button>
        </div>
      )}
    </div>
  );
};
