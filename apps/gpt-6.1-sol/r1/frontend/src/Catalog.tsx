import { useEffect, useState, type FormEvent } from 'react';
import { api, type User } from './api';
import './catalog.css';
export type Product = { id: number; name: string; description: string; category: string; size: string; priceCents: number; stock: number };
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function cents(value: string) { const normalized = value.trim().replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : NaN; }
export function Catalog({ user, onSelect, manage = false }: { user?: User | null; onSelect?: (product: Product) => void; manage?: boolean }) {
  const [query, setQuery] = useState(() => onSelect ? '' : location.search.slice(1));
  const initial = new URLSearchParams(query);
  const [filters, setFilters] = useState({ q: initial.get('q') ?? '', category: initial.get('category') ?? '', size: initial.get('size') ?? '', min: initial.has('minPriceCents') ? String(Number(initial.get('minPriceCents')) / 100) : '', max: initial.has('maxPriceCents') ? String(Number(initial.get('maxPriceCents')) / 100) : '', sort: initial.get('sort') ?? 'name_asc' });
  const [options, setOptions] = useState<{ categories: string[]; sizes: string[] }>({ categories: [], sizes: [] });
  const [result, setResult] = useState<{ products: Product[]; total: number; page: number; totalPages: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const detailId = !onSelect && !manage ? /^\/produtos\/(\d+)$/.exec(location.pathname)?.[1] : undefined;
  const [product, setProduct] = useState<Product | null>(null);
  useEffect(() => { api('products/filters').then(setOptions).catch(() => {}); }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setResult(null); setProduct(null);
    api(detailId ? `products/${detailId}` : `products?${query}`).then(data => { if (active) { if (detailId) setProduct(data.product); else setResult(data); } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar produtos.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, detailId]);
  function apply(params: URLSearchParams) { const value = params.toString(); setError(''); setQuery(value); if (!onSelect) history.replaceState({}, '', `${location.pathname}${value ? `?${value}` : ''}`); }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const params = new URLSearchParams();
    for (const key of ['q', 'category', 'size', 'sort'] as const) if (filters[key]) params.set(key, filters[key]);
    for (const [field, param] of [['min', 'minPriceCents'], ['max', 'maxPriceCents']] as const) if (filters[field].trim()) { const value = cents(filters[field]); if (!Number.isInteger(value)) { setError('Informe preços válidos com até duas casas decimais.'); return; } params.set(param, String(value)); }
    apply(params);
  }
  function edit(field: keyof typeof filters, value: string) { setFilters(current => ({ ...current, [field]: value })); }
  return <div className="catalog">
    {!onSelect && !manage && <nav className="account-nav"><a href="/produtos">Catálogo</a><a href={user ? '/minha-conta' : '/login'}>{user ? 'Minha conta' : 'Entrar'}</a>{user?.role === 'employee' && <a href="/funcionario/produtos">Gerenciar produtos</a>}</nav>}
    <span className="eyebrow">{manage ? 'GESTÃO DO CATÁLOGO' : 'VESTEBEM'}</span><h2>{detailId ? 'Detalhes do produto' : onSelect ? 'Selecione seus produtos' : manage ? 'Produtos' : 'Encontre seu estilo'}</h2>
    {manage && <a className="secondary" href="/funcionario/produtos/novo">Cadastrar produto</a>}
    {!detailId && <form className="catalog-filters" onSubmit={search}>
      <label>Pesquisar<input value={filters.q} maxLength={200} placeholder="Nome ou descrição" onChange={e => edit('q', e.target.value)}/></label>
      <label>Categoria<select value={filters.category} onChange={e => edit('category', e.target.value)}><option value="">Todas</option>{options.categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Tamanho<select value={filters.size} onChange={e => edit('size', e.target.value)}><option value="">Todos</option>{options.sizes.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Preço mínimo (R$)<input inputMode="decimal" value={filters.min} maxLength={12} onChange={e => edit('min', e.target.value)}/></label>
      <label>Preço máximo (R$)<input inputMode="decimal" value={filters.max} maxLength={12} onChange={e => edit('max', e.target.value)}/></label>
      <label>Ordenar por<select value={filters.sort} onChange={e => edit('sort', e.target.value)}><option value="name_asc">Nome: A a Z</option><option value="name_desc">Nome: Z a A</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option></select></label>
      <button className="secondary">Pesquisar e filtrar</button><button className="text-button" type="button" onClick={() => { setFilters({ q: '', category: '', size: '', min: '', max: '', sort: 'name_asc' }); apply(new URLSearchParams()); }}>Limpar filtros</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}{loading && <p role="status">Carregando produtos…</p>}
    {product && <article className="product-detail"><h3>{product.name}</h3><p className="description">{product.description}</p><p>{product.category} · Tamanho {product.size}</p><p>Estoque: {product.stock}</p><strong>{money(product.priceCents)}</strong><p><a href="/produtos">← Voltar ao catálogo</a></p>{user?.role === 'customer' && <a className="secondary" href="/pedidos/novo">Criar pedido</a>}</article>}
    {result && <><p className="hint">{result.total} produto(s) encontrado(s)</p><div className="product-grid">{result.products.map(item => <article className="product-card" key={item.id}>
      <span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p className="description">{item.description}</p><p>Tamanho {item.size} · Estoque: {item.stock}</p><strong>{money(item.priceCents)}</strong>
      {onSelect ? <button className="secondary" type="button" onClick={() => onSelect(item)}>Selecionar {item.name}</button> : <a className="secondary" href={manage ? `/funcionario/produtos/${item.id}` : `/produtos/${item.id}`}>{manage ? 'Editar produto' : 'Ver produto'}</a>}
    </article>)}</div>{result.total === 0 && <p>Nenhum produto corresponde aos critérios informados.</p>}
    <nav className="pagination" aria-label="Paginação de produtos"><button type="button" className="secondary" disabled={result.page <= 1} onClick={() => { const params = new URLSearchParams(query); params.set('page', String(result.page - 1)); apply(params); }}>Anterior</button><span>Página {result.page} de {Math.max(1, result.totalPages)}</span><button type="button" className="secondary" disabled={result.page >= result.totalPages} onClick={() => { const params = new URLSearchParams(query); params.set('page', String(result.page + 1)); apply(params); }}>Próxima</button></nav></>}
  </div>;
}
export function ProductEditor() {
  const [id, setId] = useState(/^\/funcionario\/produtos\/(\d+)$/.exec(location.pathname)?.[1]);
  const [form, setForm] = useState({ name: '', description: '', category: '', size: '', price: '', stock: '0' });
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!id) return;
    let active = true;
    api(`products/${id}`).then(({ product }: { product: Product }) => { if (active) setForm({ name: product.name, description: product.description, category: product.category, size: product.size, price: (product.priceCents / 100).toFixed(2).replace('.', ','), stock: String(product.stock) }); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const edit = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); const priceCents = cents(form.price);
    if (!Number.isInteger(priceCents)) { setError('Preço inválido. Use até duas casas decimais.'); return; }
    setBusy(true);
    try { const data = await api(id ? `products/${id}` : 'products', { name: form.name, description: form.description, category: form.category, size: form.size, priceCents, stock: Number(form.stock) }, id ? 'PUT' : 'POST'); if (!id) { history.replaceState({}, '', `/funcionario/produtos/${data.product.id}`); setId(String(data.product.id)); } setNotice('Produto salvo com sucesso.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <div><a href="/funcionario/produtos">← Produtos</a><h2>{id ? 'Atualizar produto' : 'Cadastrar produto'}</h2>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}{loading ? <p role="status">Carregando produto…</p> : <form onSubmit={save}><fieldset disabled={busy}>
    <label>Nome<input required maxLength={200} value={form.name} onChange={e => edit('name', e.target.value)}/></label><label>Descrição<textarea required maxLength={4000} value={form.description} onChange={e => edit('description', e.target.value)}/></label>
    <label>Categoria<input required maxLength={80} value={form.category} onChange={e => edit('category', e.target.value)}/></label><label>Tamanho<input required maxLength={30} value={form.size} onChange={e => edit('size', e.target.value)}/></label>
    <label>Preço (R$)<input required inputMode="decimal" maxLength={12} value={form.price} onChange={e => edit('price', e.target.value)}/></label><label>Estoque<input required type="number" min="0" max="100000000" step="1" value={form.stock} onChange={e => edit('stock', e.target.value)}/></label>
    <button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar produto'}</button></fieldset></form>}</div>;
}
