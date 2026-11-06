import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, type ProductFilters } from '../api';
import { Flash } from '../components';
import { centsToInput, parseMoneyToCents } from '../format';

const EMPTY = { name: '', description: '', category: '', size: '', price: '', stock: '0' };
type Form = typeof EMPTY;

/** Cadastro (sem id) e edição (com id) de produto. */
export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(!id);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<ProductFilters>({ categories: [], sizes: [] });

  useEffect(() => { api.productFilters().then(setOptions).catch(() => {}); }, []);
  useEffect(() => {
    if (!id) { setForm(EMPTY); setLoaded(true); return; }
    setLoaded(false);
    api.getProduct(id)
      .then(({ product: p }) => {
        setForm({ name: p.name, description: p.description, category: p.category, size: p.size,
          price: centsToInput(p.priceCents), stock: String(p.stock) });
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro inesperado.'));
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setMessage('');
    const f: Record<string, string> = {};
    if (!form.name.trim()) f.name = 'Informe o nome.';
    if (!form.category.trim()) f.category = 'Informe a categoria.';
    if (!form.size.trim()) f.size = 'Informe o tamanho.';
    const priceCents = parseMoneyToCents(form.price);
    if (priceCents === null) f.priceCents = 'Informe um preço válido, não negativo (ex.: 49,90).';
    const stock = /^\d+$/.test(form.stock.trim()) ? Number(form.stock) : NaN;
    if (!Number.isInteger(stock)) f.stock = 'O estoque deve ser um número inteiro igual ou maior que zero.';
    setFields(f);
    if (Object.keys(f).length) { setError('Verifique os dados do produto.'); return; }
    const payload = { name: form.name, description: form.description, category: form.category, size: form.size,
      priceCents: priceCents!, stock };
    setSending(true);
    try {
      if (id) {
        const { product } = await api.updateProduct(Number(id), payload);
        setForm({ ...form, price: centsToInput(product.priceCents), stock: String(product.stock) });
        setMessage('Produto atualizado com sucesso.');
      } else {
        const { product } = await api.createProduct(payload);
        navigate(`/painel/produtos/${product.id}`, { replace: true, state: { flash: `Produto "${product.name}" cadastrado com sucesso.` } });
      }
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFields(err.fields); } else setError('Erro inesperado.');
    } finally {
      setSending(false);
    }
  }

  const input = (k: keyof Form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value })) });
  const err = (k: string) => fields[k] && <span className="field-error">{fields[k]}</span>;

  return (
    <section className="card wide">
      <Link to="/painel/produtos">← Voltar aos produtos</Link>
      <h1>{id ? `Editar produto nº ${id}` : 'Novo produto'}</h1>
      <Flash />
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {loaded && (
        <form onSubmit={submit} noValidate>
          <label>Nome<input {...input('name')} maxLength={120} required />{err('name')}</label>
          <label>Descrição<textarea {...input('description')} maxLength={2000} rows={4} />{err('description')}</label>
          <div className="form-row">
            <label>Categoria<input {...input('category')} list="categorias" maxLength={60} required />{err('category')}</label>
            <label>Tamanho<input {...input('size')} list="tamanhos" maxLength={20} required />{err('size')}</label>
          </div>
          <div className="form-row">
            <label>Preço (R$)<input {...input('price')} inputMode="decimal" placeholder="0,00" required />{err('priceCents')}</label>
            <label>Quantidade em estoque<input {...input('stock')} inputMode="numeric" required />{err('stock')}</label>
          </div>
          <datalist id="categorias">{options.categories.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="tamanhos">{options.sizes.map((s) => <option key={s} value={s} />)}</datalist>
          <button type="submit" disabled={sending}>{sending ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar produto'}</button>
          {id && <Link to={`/produtos/${id}`}>Ver no catálogo</Link>}
        </form>
      )}
    </section>
  );
}
