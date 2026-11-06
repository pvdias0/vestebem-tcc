import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, type Account, type Product, type ProductPage } from '../api';
import { ShippingInfo } from '../components';
import { formatMoney } from '../format';

interface Line {
  product: Product;
  quantity: string;
}

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');
const validQty = (q: string) => /^\d+$/.test(q.trim()) && Number(q) > 0;

export function NewOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Dados de entrega da conta (endereço + telefone) e confirmação do cliente
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const loadAccount = () =>
    api.getAccount().then(setAccount, (e) => setAccountError(errMsg(e)));
  useEffect(() => {
    void loadAccount();
  }, []);
  const shippingReady = !!account?.address && !!account.profile.phone;

  // Busca de produtos para adicionar
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState({ q: '', page: 1 });
  const [results, setResults] = useState<ProductPage | null>(null);
  const [searchError, setSearchError] = useState('');

  const add = (p: Product) =>
    setLines((ls) =>
      ls.some((l) => l.product.id === p.id)
        ? ls.map((l) => (l.product.id === p.id && validQty(l.quantity) ? { ...l, quantity: String(Number(l.quantity) + 1) } : l))
        : [...ls, { product: p, quantity: '1' }],
    );

  // Produto pré-selecionado vindo da página de detalhes (?produto=ID)
  const preselected = searchParams.get('produto');
  useEffect(() => {
    if (!preselected) return;
    api.getProduct(preselected).then(
      ({ product }) => setLines((ls) => (ls.some((l) => l.product.id === product.id) ? ls : [...ls, { product, quantity: '1' }])),
      () => setError('O produto selecionado não foi encontrado.'),
    );
  }, [preselected]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (query.q) p.set('q', query.q);
    if (query.page > 1) p.set('pagina', String(query.page));
    setSearchError('');
    api.listProducts(p).then(setResults, (e) => setSearchError(errMsg(e)));
  }, [query]);

  // Prévia com preços atuais; o valor oficial é calculado pelo servidor.
  const preview = lines.every((l) => validQty(l.quantity))
    ? lines.reduce((s, l) => s + Number(l.quantity) * l.product.priceCents, 0)
    : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (lines.length === 0) return setError('Adicione pelo menos um produto ao pedido.');
    for (const l of lines)
      if (!validQty(l.quantity)) return setError(`"${l.product.name}": a quantidade deve ser um número inteiro positivo.`);
    if (!account?.address || !shippingReady)
      return setError('Cadastre seu endereço de entrega e telefone em "Minha conta" antes de finalizar o pedido.');
    if (!confirmed) return setError('Confirme o endereço de entrega para finalizar o pedido.');
    setBusy(true);
    try {
      const { order } = await api.createOrder(
        lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
        account.address.updatedAt,
      );
      navigate(`/pedidos/${order.id}`, { state: { flash: `Pedido nº ${order.id} criado com sucesso!` } });
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ApiError && err.status === 409) {
        setConfirmed(false);
        void loadAccount();
      }
      setBusy(false);
    }
  };

  return (
    <section className="card card-xwide">
      <h1>Novo pedido</h1>
      <div className="order-layout">
        <div>
          <h2>Escolha os produtos</h2>
          <form
            className="inline-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery({ q: term.trim(), page: 1 });
            }}
          >
            <label htmlFor="busca" className="sr-only">Pesquisar produtos</label>
            <input id="busca" type="search" placeholder="Pesquisar no catálogo" maxLength={100} value={term} onChange={(e) => setTerm(e.target.value)} />
            <button type="submit" className="btn btn-inline">Buscar</button>
          </form>
          {searchError && <div className="alert" role="alert">{searchError}</div>}
          {results && results.products.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}
          <ul className="picker">
            {results?.products.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="muted small-text">{p.category} · Tam. {p.size} · {p.stock > 0 ? `${p.stock} em estoque` : 'Esgotado'}</span>
                </span>
                <span className="picker-right">
                  {formatMoney(p.priceCents)}
                  <button type="button" className="btn btn-secondary btn-inline" disabled={p.stock === 0} onClick={() => add(p)}>Adicionar</button>
                </span>
              </li>
            ))}
          </ul>
          {results && results.totalPages > 1 && (
            <div className="pagination">
              <button type="button" className="btn btn-secondary btn-inline" disabled={results.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>‹</button>
              <span>Página {results.page} de {results.totalPages}</span>
              <button type="button" className="btn btn-secondary btn-inline" disabled={results.page >= results.totalPages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>›</button>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} noValidate className="order-summary">
          <h2>Itens do pedido</h2>
          {error && <div className="alert" role="alert">{error}</div>}
          {lines.length === 0 && <p className="muted">Nenhum produto adicionado.</p>}
          {lines.map((l) => (
            <div key={l.product.id} className="line">
              <div>
                <strong>{l.product.name}</strong>
                <br />
                <span className="muted small-text">Tam. {l.product.size} · {formatMoney(l.product.priceCents)} cada</span>
              </div>
              <div className="line-controls">
                <label htmlFor={`q-${l.product.id}`} className="sr-only">Quantidade de {l.product.name}</label>
                <input
                  id={`q-${l.product.id}`}
                  className="qty"
                  inputMode="numeric"
                  value={l.quantity}
                  aria-invalid={!validQty(l.quantity) || undefined}
                  onChange={(e) => setLines((ls) => ls.map((x) => (x.product.id === l.product.id ? { ...x, quantity: e.target.value } : x)))}
                />
                <button type="button" className="link-btn" onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))}>Remover</button>
              </div>
            </div>
          ))}
          <h2 className="mt">Entrega</h2>
          {accountError && <div className="alert" role="alert">{accountError}</div>}
          {!account && !accountError && <p className="muted">Carregando dados de entrega…</p>}
          {account && !shippingReady && (
            <p className="notice">
              Para finalizar o pedido, cadastre {!account.address ? 'um endereço de entrega' : ''}
              {!account.address && !account.profile.phone ? ' e ' : ''}
              {!account.profile.phone ? 'um telefone' : ''} em <Link to="/minha-conta">Minha conta</Link>.
            </p>
          )}
          {account?.address && shippingReady && (
            <>
              <ShippingInfo shipping={{ ...account.address, phone: account.profile.phone }} />
              <label className="check">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                Confirmo o envio para este endereço
              </label>
              <p className="muted small-text">Para usar outro endereço, altere-o em <Link to="/minha-conta">Minha conta</Link>.</p>
            </>
          )}
          <p className="total">Total estimado: <strong>{preview === null ? '—' : formatMoney(preview)}</strong></p>
          <p className="muted small-text">O total final é calculado com os preços cadastrados no momento da confirmação.</p>
          <button type="submit" className="btn" disabled={busy || lines.length === 0 || !shippingReady || !confirmed}>{busy ? 'Enviando…' : 'Confirmar pedido'}</button>
        </form>
      </div>
    </section>
  );
}
