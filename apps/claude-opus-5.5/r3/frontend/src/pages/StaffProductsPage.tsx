import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, type ProductPage } from '../api';
import { Flash, Pagination } from '../components';
import { formatMoney } from '../format';

export function StaffProductsPage() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [data, setData] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const key = params.toString();

  useEffect(() => {
    api.listProducts(new URLSearchParams(key))
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro inesperado.'));
  }, [key]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setParams(term.trim() ? { q: term.trim() } : {});
  }

  return (
    <section className="card wide">
      <div className="title-row">
        <h1>Produtos</h1>
        <Link className="button" to="/painel/produtos/novo">Novo produto</Link>
      </div>
      <Flash />
      {error && <p className="alert" role="alert">{error}</p>}
      <form className="search-row" onSubmit={submit} role="search">
        <input type="search" aria-label="Pesquisar produto" placeholder="Pesquisar por nome ou descrição"
          value={term} onChange={(e) => setTerm(e.target.value)} maxLength={100} />
        <button type="submit" className="secondary">Pesquisar</button>
      </form>
      {data && data.products.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}
      {data && data.products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cód.</th><th>Nome</th><th>Categoria</th><th>Tam.</th><th>Preço</th><th>Estoque</th><th></th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td data-label="Cód.">{p.id}</td>
                  <td data-label="Nome">{p.name}</td>
                  <td data-label="Categoria">{p.category}</td>
                  <td data-label="Tam.">{p.size}</td>
                  <td data-label="Preço">{formatMoney(p.priceCents)}</td>
                  <td data-label="Estoque">{p.stock}</td>
                  <td><Link to={`/painel/produtos/${p.id}`}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages}
        onChange={(page) => { const p = new URLSearchParams(key); p.set('page', String(page)); setParams(p); }} />}
    </section>
  );
}
