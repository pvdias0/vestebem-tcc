import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, type ProductFilters, type ProductPage } from '../api';
import { useAuth } from '../auth';
import { Pagination } from '../components';
import { formatMoney, parseMoneyToCents } from '../format';

const SORTS = [
  { value: 'name-asc', label: 'Nome (A–Z)' },
  { value: 'name-desc', label: 'Nome (Z–A)' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
];
const FIELDS = ['q', 'category', 'size', 'minPrice', 'maxPrice'] as const;
type Field = (typeof FIELDS)[number];

/** Converte "49,90" do formulário para "49.90" na URL; texto inválido segue como está e a API responde com erro. */
function priceParam(v: string): string {
  const t = v.trim();
  const cents = parseMoneyToCents(t);
  return t === "" || cents === null ? t : (cents / 100).toFixed(2);
}

/** Catálogo público. Os critérios ficam na URL (podem ser compartilhados e voltar com o navegador). */
export function CatalogPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Record<Field, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, (params.get(f) ?? '').replace('.', ',')])) as Record<Field, string>);
  const [filters, setFilters] = useState<ProductFilters>({ categories: [], sizes: [] });
  const [data, setData] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const sort = `${params.get('sort') ?? 'name'}-${params.get('order') ?? 'asc'}`;
  const key = params.toString();

  useEffect(() => { api.productFilters().then(setFilters).catch(() => {}); }, []);
  useEffect(() => {
    setError('');
    api.listProducts(new URLSearchParams(key))
      .then(setData)
      .catch((e) => { setData(null); setError(e instanceof ApiError ? e.message : 'Erro inesperado.'); });
  }, [key]);

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    setParams(p);
  }
  const current = () => Object.fromEntries([...params.entries()]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = { ...current(), page: '' };
    for (const f of FIELDS) next[f] = f.endsWith('Price') ? priceParam(form[f]) : form[f].trim();
    apply(next);
  }
  function clear() {
    setForm({ q: '', category: '', size: '', minPrice: '', maxPrice: '' });
    apply({});
  }
  function changeSort(v: string) {
    const [s, o] = v.split('-');
    apply({ ...current(), sort: s === 'name' ? '' : s!, order: o === 'asc' ? '' : o!, page: '' });
  }

  const set = (f: Field) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [f]: e.target.value }));

  return (
    <section className="catalog">
      <h1>Catálogo</h1>
      <form className="filters" onSubmit={submit} role="search">
        <label className="grow">Pesquisar
          <input type="search" placeholder="Nome ou descrição" value={form.q} onChange={set('q')} maxLength={100} />
        </label>
        <label>Categoria
          <select value={form.category} onChange={set('category')}>
            <option value="">Todas</option>
            {filters.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Tamanho
          <select value={form.size} onChange={set('size')}>
            <option value="">Todos</option>
            {filters.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="price">Preço mín. (R$)
          <input inputMode="decimal" placeholder="0,00" value={form.minPrice} onChange={set('minPrice')} />
        </label>
        <label className="price">Preço máx. (R$)
          <input inputMode="decimal" placeholder="0,00" value={form.maxPrice} onChange={set('maxPrice')} />
        </label>
        <div className="filter-actions">
          <button type="submit">Aplicar</button>
          <button type="button" className="secondary" onClick={clear}>Limpar</button>
        </div>
      </form>

      <div className="catalog-bar">
        <span className="muted-inline">{data ? `${data.total} produto(s) encontrado(s)` : ''}</span>
        <label className="inline">Ordenar por
          <select value={sort} onChange={(e) => changeSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <p>Carregando…</p>}
      {data && data.products.length === 0 && <p className="card muted">Nenhum produto corresponde aos critérios informados.</p>}
      {data && data.products.length > 0 && (
        <ul className="grid">
          {data.products.map((p) => (
            <li key={p.id} className="product-card">
              <Link to={`/produtos/${p.id}`} className="product-link">
                <span className="product-category">{p.category}</span>
                <span className="product-name">{p.name}</span>
                <span className="product-meta">Tamanho {p.size}</span>
                <span className="product-price">{formatMoney(p.priceCents)}</span>
                <span className={p.stock > 0 ? 'stock' : 'stock out'}>
                  {p.stock > 0 ? `${p.stock} em estoque` : 'Sem estoque'}
                </span>
              </Link>
              {user?.role === 'funcionario' && <Link className="edit-link" to={`/painel/produtos/${p.id}`}>Editar</Link>}
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages}
        onChange={(page) => apply({ ...current(), page: page === 1 ? '' : String(page) })} />}
    </section>
  );
}
