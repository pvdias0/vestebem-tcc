import { useEffect, useState, type FormEvent } from 'react';
import { catalogApi, money, parsePrice, type Product, type ProductPage } from './catalog-api';
import type { User } from './Account';
export function Catalog({ user }: { user: User | null }) {
 const [url, setUrl] = useState(location.pathname+location.search);
 const [revision,setRevision] = useState(0);
 const [data, setData] = useState<ProductPage | null>(null);
 const [product, setProduct] = useState<Product | null>(null);
 const [options, setOptions] = useState<{ categories: string[]; sizes: string[] }>({ categories: [], sizes: [] });
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const path = url.split('?')[0];
 const params = new URLSearchParams(url.split('?')[1]);
 const managing = path.startsWith('/gestao-produtos');
 const editing = /^\/gestao-produtos\/(novo|\d+)$/.exec(path);
 const detail = /^\/produtos\/(\d+)$/.exec(path);
 function navigate(next: string) { history.pushState({},'',next); setLoading(true); setUrl(next); setRevision(value=>value+1); setError(''); setNotice(''); }
 useEffect(() => { const listener = () => { setLoading(true); setUrl(location.pathname+location.search); setRevision(value=>value+1); setNotice(''); }; addEventListener('popstate',listener); return () => removeEventListener('popstate',listener); }, []);
 useEffect(() => {
  let active = true; setLoading(true); setError(''); setData(null); setProduct(null);
  const id = detail?.[1] || (editing?.[1] !== 'novo' ? editing?.[1] : null);
  const endpoint = id ? 'products/'+id : editing ? null : 'products?'+(url.split('?')[1] || '');
  Promise.all([endpoint ? catalogApi<Product | ProductPage>(endpoint) : Promise.resolve(null),catalogApi<typeof options>('products/options')]).then(([result,opts]) => { if (!active) return; setOptions(opts); if (result && 'items' in result) setData(result); else setProduct(result); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [url,revision]);
 function search(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const values = new FormData(event.currentTarget); const next = new URLSearchParams();
  for (const key of ['q','category','size','sort']) { const value = String(values.get(key) || '').trim(); if (value) next.set(key,value); }
  for (const [field,key] of [['min','minPriceCents'],['max','maxPriceCents']]) { const value = String(values.get(field) || '').trim(); if (value) { const cents = parsePrice(value); if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000) { setError('Informe preços válidos com até duas casas decimais.'); return; } next.set(key,String(cents)); } }
  if (next.has('minPriceCents') && next.has('maxPriceCents') && Number(next.get('minPriceCents')) > Number(next.get('maxPriceCents'))) { setError('O preço mínimo não pode superar o máximo.'); return; }
  navigate((managing ? '/gestao-produtos' : '/catalogo')+'?'+next);
 }
 function page(number: number) { params.set('page',String(number)); navigate((managing ? '/gestao-produtos' : '/catalogo')+'?'+params); }
 if (managing && user?.role !== 'employee') return <div className="catalog-area"><h2 id="title">Gestão de produtos</h2><p role="alert">Somente funcionários podem acessar este painel.</p><a href="/login">Entrar na conta</a></div>;
 return <div className="catalog-area"><nav className="account-nav"><button onClick={() => navigate('/catalogo')}>Catálogo</button><a href="/minha-conta">Minha conta</a>{user?.role === 'employee' && <button onClick={() => navigate('/gestao-produtos')}>Gerenciar produtos</button>}</nav>
 {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
 {loading ? <p role="status">Carregando produtos…</p> : editing ? <><h2 id="title">{editing[1] === 'novo' ? 'Cadastrar produto' : 'Atualizar produto'}</h2>{(editing[1] === 'novo' || product) && <ProductEditor key={url} product={product} onSuccess={id => { navigate('/gestao-produtos/'+id); setNotice(editing[1] === 'novo' ? 'Produto cadastrado com sucesso.' : 'Produto atualizado com sucesso.'); }}/>}<button className="secondary" onClick={() => navigate('/gestao-produtos')}>Voltar à gestão</button></> : detail ? <><h2 id="title">{product?.name || 'Detalhes do produto'}</h2>{product && <><p className="product-description">{product.description}</p><dl><dt>Identificador</dt><dd>#{product.id}</dd><dt>Categoria</dt><dd>{product.category}</dd><dt>Tamanho</dt><dd>{product.size}</dd><dt>Estoque</dt><dd>{product.stock} unidades</dd><dt>Preço</dt><dd>{money(product.priceCents)}</dd></dl>{user?.role === 'customer' ? <a className="primary" href={'/novo-pedido?produto='+product.id}>Criar pedido com este produto</a> : !user && <a href="/login">Entre como cliente para criar pedidos</a>}</>}<p><button className="secondary" onClick={() => navigate('/catalogo')}>Voltar ao catálogo</button></p></> : <><h2 id="title">{managing ? 'Gestão de produtos' : 'Catálogo'}</h2><p className="subtitle">Encontre a peça que combina com você.</p>{managing && <button className="primary" onClick={() => navigate('/gestao-produtos/novo')}>Cadastrar produto</button>}
 <form className="catalog-filters" key={url} onSubmit={search}><label>Pesquisar<input name="q" maxLength={200} defaultValue={params.get('q') || ''} placeholder="Nome ou descrição"/></label><label>Categoria<select name="category" defaultValue={params.get('category') || ''}><option value="">Todas</option>{[...new Set([...options.categories,...(params.get('category') ? [params.get('category')!] : [])])].map(value => <option key={value}>{value}</option>)}</select></label><label>Tamanho<select name="size" defaultValue={params.get('size') || ''}><option value="">Todos</option>{[...new Set([...options.sizes,...(params.get('size') ? [params.get('size')!] : [])])].map(value => <option key={value}>{value}</option>)}</select></label><label>Preço mínimo (R$)<input name="min" inputMode="decimal" defaultValue={params.has('minPriceCents') ? String(Number(params.get('minPriceCents'))/100) : ''}/></label><label>Preço máximo (R$)<input name="max" inputMode="decimal" defaultValue={params.has('maxPriceCents') ? String(Number(params.get('maxPriceCents'))/100) : ''}/></label><label>Ordenar por<select name="sort" defaultValue={params.get('sort') || 'name_asc'}><option value="name_asc">Nome crescente</option><option value="name_desc">Nome decrescente</option><option value="price_asc">Preço crescente</option><option value="price_desc">Preço decrescente</option></select></label><button className="primary">Aplicar filtros</button><button type="button" className="secondary" onClick={() => navigate(managing ? '/gestao-produtos' : '/catalogo')}>Limpar filtros</button></form>
 {data && <><p role="status">{data.total} produtos encontrados · Página {data.page} de {Math.max(1,data.totalPages)}</p><div className="product-grid">{data.items.map(item => <article key={item.id} className="product-card"><h3>{item.name}</h3><p>{item.category} · {item.size}</p><p className="product-description">{item.description}</p><strong>{money(item.priceCents)}</strong><p>Estoque: {item.stock}</p><button className="secondary" onClick={() => navigate((managing ? '/gestao-produtos/' : '/produtos/')+item.id)}>{managing ? 'Editar produto' : 'Ver produto'} #{item.id}</button></article>)}</div>{data.items.length === 0 && <p>Nenhum produto nesta página. Ajuste os filtros ou volte à página anterior.</p>}<div className="pagination"><button className="secondary" disabled={data.page <= 1} onClick={() => page(data.page-1)}>Página anterior</button><button className="secondary" disabled={data.page >= data.totalPages} onClick={() => page(data.page+1)}>Próxima página</button></div></>}</>}
 </div>;
}
function ProductEditor({ product, onSuccess }: { product: Product | null; onSuccess: (id: number) => void }) {
 const [busy,setBusy] = useState(false); const [error,setError] = useState('');
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget));
  const priceCents = parsePrice(String(values.price)); const stock = Number(values.stock);
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 100000000 || !Number.isInteger(stock) || stock < 0 || stock > 1000000000) { setError('Confira preço e estoque.'); return; }
  setBusy(true);
  try { const result = await catalogApi<{ id: number }>('products'+(product ? '/'+product.id : ''),product ? 'PUT' : 'POST',{ name: values.name,description: values.description,category: values.category,size: values.size,priceCents,stock }); onSuccess(result.id); } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
 }
 return <form onSubmit={submit} className="product-editor">{error && <p className="error" role="alert">{error}</p>}<fieldset disabled={busy}><label>Nome do produto<input name="name" maxLength={200} required defaultValue={product?.name}/></label><label>Descrição<textarea name="description" maxLength={5000} required defaultValue={product?.description}/></label><label>Categoria<input name="category" maxLength={80} required defaultValue={product?.category}/></label><label>Tamanho<input name="size" maxLength={30} required defaultValue={product?.size}/></label><label>Preço (R$)<input name="price" inputMode="decimal" required defaultValue={product ? (product.priceCents/100).toFixed(2).replace('.',',') : ''}/></label><label>Quantidade em estoque<input name="stock" type="number" min="0" max="1000000000" step="1" required defaultValue={product?.stock ?? 0}/></label><button className="primary">{busy ? 'Salvando…' : 'Salvar produto'}</button></fieldset></form>;
}
