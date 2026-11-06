import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, type Product } from '../api';
import { useAuth } from '../auth';
import { formatMoney } from '../format';

export function ProductPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setProduct(null); setError('');
    api.getProduct(id)
      .then((r) => setProduct(r.product))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro inesperado.'));
  }, [id]);

  return (
    <section className="card wide">
      <Link to="/">← Voltar ao catálogo</Link>
      {error && <p className="alert" role="alert">{error}</p>}
      {!product && !error && <p>Carregando…</p>}
      {product && (
        <>
          <p className="product-category">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="product-price big">{formatMoney(product.priceCents)}</p>
          <dl className="details">
            <dt>Tamanho</dt><dd>{product.size}</dd>
            <dt>Estoque</dt><dd>{product.stock > 0 ? `${product.stock} unidade(s)` : 'Sem estoque'}</dd>
            <dt>Código</dt><dd>{product.id}</dd>
          </dl>
          {product.description && <p className="description">{product.description}</p>}
          <div className="actions">
            {!user && <p className="muted">Para comprar, <Link to="/entrar">entre</Link> ou <Link to="/cadastro">crie sua conta</Link>.</p>}
            {user?.role === 'cliente' && (product.stock > 0
              ? <Link className="button" to={`/pedidos/novo?produto=${product.id}`}>Fazer pedido com este produto</Link>
              : <p className="muted">Produto indisponível no momento.</p>)}
            {user?.role === 'funcionario' && <Link className="button" to={`/painel/produtos/${product.id}`}>Editar produto</Link>}
          </div>
        </>
      )}
    </section>
  );
}
