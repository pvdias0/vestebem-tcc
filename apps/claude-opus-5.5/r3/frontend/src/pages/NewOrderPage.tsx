import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, type Account, type Product } from '../api';
import { AddressBlock } from '../components';
import { formatMoney } from '../format';

interface Line { product: Product; quantity: string }

export function NewOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [lines, setLines] = useState<Line[]>([]);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { api.account().then(setAccount).catch(() => {}); }, []);
  const canShip = Boolean(account?.address && account.user.phone);

  function add(product: Product) {
    setErrors([]);
    setLines((ls) => ls.some((l) => l.product.id === product.id)
      ? ls.map((l) => (l.product.id === product.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l))
      : [...ls, { product, quantity: '1' }]);
  }

  // Produto vindo da página de detalhes (?produto=ID)
  const initial = params.get('produto');
  useEffect(() => {
    if (!initial) return;
    api.getProduct(initial).then((r) => { if (r.product.stock > 0) add(r.product); }).catch(() => {});
  }, [initial]);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (term.trim()) p.set('q', term.trim());
    try {
      setResults((await api.listProducts(p)).products);
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : 'Erro inesperado.']);
    }
  }
  useEffect(() => { void search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = (l: Line) => (/^\d+$/.test(l.quantity.trim()) ? Number(l.quantity) : NaN);
  // Prévia com os preços do catálogo; o valor oficial é calculado pelo servidor.
  const preview = lines.reduce((s, l) => s + (Number.isInteger(qty(l)) ? qty(l) * l.product.priceCents : 0), 0);

  async function submit() {
    const errs: string[] = [];
    if (lines.length === 0) errs.push('O pedido deve conter pelo menos um item.');
    if (!canShip) errs.push('Cadastre endereço de entrega e telefone em Minha conta antes de finalizar o pedido.');
    else if (!confirmed) errs.push('Confirme o endereço de entrega para finalizar o pedido.');
    for (const l of lines) {
      const q = qty(l);
      if (!Number.isInteger(q) || q < 1) errs.push(`"${l.product.name}": a quantidade deve ser um número inteiro positivo.`);
    }
    setErrors(errs);
    if (errs.length) return;
    setSending(true);
    try {
      const { order } = await api.createOrder(lines.map((l) => ({ productId: l.product.id, quantity: qty(l) })), confirmed);
      navigate(`/pedidos/${order.id}`, { state: { flash: `Pedido nº ${order.id} criado com sucesso.` } });
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.errors.length ? err.errors : [err.message]) : ['Erro inesperado.']);
      setSending(false);
    }
  }

  return (
    <section className="card wide">
      <h1>Novo pedido</h1>
      {errors.length > 0 && <div className="alert" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>}

      <h2>Itens do pedido</h2>
      {lines.length === 0 ? <p className="muted left">Nenhum produto selecionado. Escolha abaixo.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Preço unit.</th><th>Quantidade</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.product.id}>
                  <td data-label="Produto">{l.product.name}<br /><small>Tam. {l.product.size} · {l.product.stock} em estoque</small></td>
                  <td data-label="Preço unit.">{formatMoney(l.product.priceCents)}</td>
                  <td data-label="Quantidade">
                    <input className="qty" inputMode="numeric" aria-label={`Quantidade de ${l.product.name}`} value={l.quantity}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x.product.id === l.product.id ? { ...x, quantity: e.target.value } : x)))} />
                  </td>
                  <td data-label="Subtotal">{Number.isInteger(qty(l)) ? formatMoney(qty(l) * l.product.priceCents) : '—'}</td>
                  <td><button type="button" className="link-button danger"
                    onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="total">Total estimado: <strong>{formatMoney(preview)}</strong></p>
      <h2>Entrega</h2>
      {!account && <p className="muted left">Carregando dados de entrega…</p>}
      {account && !canShip && (
        <p className="alert">
          Para finalizar o pedido, cadastre {!account.address ? 'um endereço de entrega' : ''}
          {!account.address && !account.user.phone ? ' e ' : ''}{!account.user.phone ? 'um telefone' : ''} em{' '}
          <Link to="/minha-conta">Minha conta</Link>.
        </p>
      )}
      {account && canShip && account.address && (
        <div className="shipping-confirm">
          <AddressBlock address={account.address} phone={account.user.phone} />
          <label className="checkbox">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Confirmo a entrega neste endereço
          </label>
          <small>Para alterar, edite o endereço em <Link to="/minha-conta">Minha conta</Link>.</small>
        </div>
      )}
      <button type="button" onClick={submit} disabled={sending || lines.length === 0 || !canShip || !confirmed}>
        {sending ? 'Enviando…' : 'Criar pedido'}
      </button>

      <h2>Adicionar produtos</h2>
      <form className="search-row" onSubmit={search} role="search">
        <input type="search" aria-label="Pesquisar produto" placeholder="Pesquisar por nome ou descrição"
          value={term} onChange={(e) => setTerm(e.target.value)} maxLength={100} />
        <button type="submit" className="secondary">Pesquisar</button>
      </form>
      {results && results.length === 0 && <p className="muted left">Nenhum produto encontrado.</p>}
      {results && results.length > 0 && (
        <ul className="pick-list">
          {results.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.name}</strong> <small>· Tam. {p.size} · {p.category}</small><br />
                {formatMoney(p.priceCents)} <small className={p.stock > 0 ? '' : 'out'}>{p.stock > 0 ? `· ${p.stock} em estoque` : '· Sem estoque'}</small>
              </span>
              <button type="button" className="secondary" disabled={p.stock === 0} onClick={() => add(p)}>Adicionar</button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 12 && <p className="muted left">Mostrando os 12 primeiros resultados; refine a pesquisa.</p>}
    </section>
  );
}
