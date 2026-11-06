import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, ApiError, type Product, type ProductPage } from '../api';
import { useAuth } from '../auth';
import { Flash } from '../components';
import { formatMoney } from '../format';

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');

const SORT_OPTIONS = [
  ['nome_asc', 'Nome (A–Z)'],
  ['nome_desc', 'Nome (Z–A)'],
  ['preco_asc', 'Menor preço'],
  ['preco_desc', 'Maior preço'],
] as const;

const FILTER_KEYS = ['q', 'categoria', 'tamanho', 'precoMin', 'precoMax', 'ordem'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/** Formulário de pesquisa/filtros/ordenação sincronizado com a URL (?q=&categoria=...). */
function CatalogFilters({ params, onApply }: { params: URLSearchParams; onApply: (p: URLSearchParams) => void }) {
  const [opts, setOpts] = useState<{ categories: string[]; sizes: string[] }>({ categories: [], sizes: [] });
  const read = () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<FilterKey, string>;
  const [form, setForm] = useState(read);
  const key = params.toString();
  useEffect(() => setForm(read()), [key]);
  useEffect(() => {
    api.productFilters().then(setOpts, () => undefined);
  }, []);

  const set = (k: FilterKey, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) if (form[k].trim()) p.set(k, form[k].trim());
    onApply(p);
  };

  return (
    <form className="filters" onSubmit={submit} role="search">
      <div className="field f-q">
        <label htmlFor="f-q">Pesquisar</label>
        <input id="f-q" type="search" placeholder="Nome ou descrição" maxLength={100} value={form.q} onChange={(e) => set('q', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="f-cat">Categoria</label>
        <select id="f-cat" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
          <option value="">Todas</option>
          {opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-tam">Tamanho</label>
        <select id="f-tam" value={form.tamanho} onChange={(e) => set('tamanho', e.target.value)}>
          <option value="">Todos</option>
          {opts.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="field f-price">
        <label htmlFor="f-min">Preço mín. (R$)</label>
        <input id="f-min" inputMode="decimal" placeholder="0,00" value={form.precoMin} onChange={(e) => set('precoMin', e.target.value)} />
      </div>
      <div className="field f-price">
        <label htmlFor="f-max">Preço máx. (R$)</label>
        <input id="f-max" inputMode="decimal" placeholder="0,00" value={form.precoMax} onChange={(e) => set('precoMax', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="f-ord">Ordenar por</label>
        <select id="f-ord" value={form.ordem || 'nome_asc'} onChange={(e) => set('ordem', e.target.value)}>
          {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="filter-actions">
        <button type="submit" className="btn btn-inline">Aplicar</button>
        <button type="button" className="btn btn-secondary btn-inline" onClick={() => onApply(new URLSearchParams())}>Limpar</button>
      </div>
    </form>
  );
}

function Pagination({ data, params, onGo }: { data: ProductPage; params: URLSearchParams; onGo: (p: URLSearchParams) => void }) {
  if (data.totalPages <= 1) return null;
  const go = (page: number) => {
    const p = new URLSearchParams(params);
    if (page <= 1) p.delete('pagina');
    else p.set('pagina', String(page));
    onGo(p);
  };
  return (
    <nav className="pagination" aria-label="Paginação">
      <button type="button" className="btn btn-secondary btn-inline" disabled={data.page <= 1} onClick={() => go(data.page - 1)}>‹ Anterior</button>
      <span>Página {data.page} de {data.totalPages}</span>
      <button type="button" className="btn btn-secondary btn-inline" disabled={data.page >= data.totalPages} onClick={() => go(data.page + 1)}>Próxima ›</button>
    </nav>
  );
}

function useProductSearch() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const key = params.toString();
  useEffect(() => {
    let alive = true;
    setError('');
    api.listProducts(new URLSearchParams(key)).then(
      (d) => alive && setData(d),
      (e) => alive && (setData(null), setError(errMsg(e))),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  const apply = (p: URLSearchParams) => {
    setParams(p);
    window.scrollTo({ top: 0 });
  };
  return { params, data, error, apply };
}

export function StockInfo({ stock }: { stock: number }) {
  if (stock === 0) return <span className="stock stock-out">Esgotado</span>;
  return <span className="stock">{stock} em estoque</span>;
}

export function CatalogPage() {
  const { params, data, error, apply } = useProductSearch();
  return (
    <section className="page-wide">
      <h1>Catálogo</h1>
      <CatalogFilters params={params} onApply={apply} />
      {error && <div className="alert" role="alert">{error}</div>}
      {!data && !error && <p className="muted">Carregando…</p>}
      {data && (
        <>
          <p className="muted" aria-live="polite">{data.total} produto(s) encontrado(s)</p>
          {data.products.length === 0 ? (
            <p className="card center">Nenhum produto corresponde aos critérios informados.</p>
          ) : (
            <ul className="product-grid">
              {data.products.map((p) => (
                <li key={p.id} className="product-card">
                  <Link to={`/produtos/${p.id}`} className="product-link">
                    <span className="product-cat">{p.category}</span>
                    <strong className="product-name">{p.name}</strong>
                    <span className="muted">Tamanho {p.size}</span>
                    <span className="product-price">{formatMoney(p.priceCents)}</span>
                    <StockInfo stock={p.stock} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pagination data={data} params={params} onGo={apply} />
        </>
      )}
    </section>
  );
}

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setProduct(null);
    setError('');
    api.getProduct(id).then((r) => setProduct(r.product), (e) => setError(errMsg(e)));
  }, [id]);

  return (
    <section className="card card-wide">
      <p><Link to="/">← Voltar ao catálogo</Link></p>
      <Flash />
      {error && <div className="alert" role="alert">{error}</div>}
      {!product && !error && <p className="muted">Carregando…</p>}
      {product && (
        <>
          <span className="product-cat">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="product-price big">{formatMoney(product.priceCents)}</p>
          <dl className="info">
            <dt>Tamanho</dt><dd>{product.size}</dd>
            <dt>Categoria</dt><dd>{product.category}</dd>
            <dt>Estoque</dt><dd><StockInfo stock={product.stock} /></dd>
            <dt>Código</dt><dd>{product.id}</dd>
          </dl>
          {product.description && <p className="description">{product.description}</p>}
          <div className="actions">
            {(!user || user.role === 'customer') && product.stock > 0 && (
              <Link to={user ? `/pedidos/novo?produto=${product.id}` : '/entrar'} className="btn btn-inline">
                {user ? 'Adicionar a um novo pedido' : 'Entre para fazer um pedido'}
              </Link>
            )}
            {user?.role === 'employee' && (
              <Link to={`/painel/produtos/${product.id}/editar`} className="btn btn-inline">Editar produto</Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function EmployeeProductsPage() {
  const { params, data, error, apply } = useProductSearch();
  return (
    <section className="card card-xwide">
      <div className="title-row">
        <h1>Painel de produtos</h1>
        <Link to="/painel/produtos/novo" className="btn btn-inline">Cadastrar produto</Link>
      </div>
      <Flash />
      <CatalogFilters params={params} onApply={apply} />
      {error && <div className="alert" role="alert">{error}</div>}
      {!data && !error && <p className="muted">Carregando…</p>}
      {data && data.products.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}
      {data && data.products.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Cód.</th><th>Nome</th><th>Categoria</th><th>Tam.</th><th className="num">Preço</th><th className="num">Estoque</th><th></th></tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td><Link to={`/produtos/${p.id}`}>{p.name}</Link></td>
                  <td>{p.category}</td>
                  <td>{p.size}</td>
                  <td className="num">{formatMoney(p.priceCents)}</td>
                  <td className="num">{p.stock}</td>
                  <td><Link to={`/painel/produtos/${p.id}/editar`}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination data={data} params={params} onGo={apply} />}
    </section>
  );
}
