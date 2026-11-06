import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, type ProductInput } from '../api';
import { parseMoneyToCents } from '../format';

interface FormState {
  name: string;
  description: string;
  category: string;
  size: string;
  price: string;
  stock: string;
}

const empty: FormState = { name: '', description: '', category: '', size: '', price: '', stock: '0' };
const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',');

/** Cadastro (sem :id) ou edição (com :id) de produto — somente funcionários. */
export function ProductFormPage() {
  const { id } = useParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<{ categories: string[]; sizes: string[] }>({ categories: [], sizes: [] });

  useEffect(() => {
    api.productFilters().then(setOpts, () => undefined);
    if (!editing) return;
    api.getProduct(id).then(
      ({ product: p }) => {
        setForm({ name: p.name, description: p.description, category: p.category, size: p.size, price: centsToInput(p.priceCents), stock: String(p.stock) });
        setLoaded(true);
      },
      (e) => setError(e instanceof ApiError ? e.message : 'Erro ao carregar o produto.'),
    );
  }, [editing, id]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    const priceCents = parseMoneyToCents(form.price);
    if (priceCents === null) f.priceCents = 'Informe um preço válido e não negativo (ex.: 49,90).';
    const stockOk = /^\d+$/.test(form.stock.trim());
    if (!stockOk) f.stock = 'O estoque deve ser um número inteiro igual ou maior que zero.';
    if (!form.name.trim()) f.name = 'Informe o nome.';
    if (!form.category.trim()) f.category = 'Informe a categoria.';
    if (!form.size.trim()) f.size = 'Informe o tamanho.';
    setFields(f);
    if (Object.keys(f).length) return setError('Verifique os campos informados.');
    const data: ProductInput = {
      name: form.name,
      description: form.description,
      category: form.category,
      size: form.size,
      priceCents: priceCents!,
      stock: Number(form.stock.trim()),
    };
    setBusy(true);
    try {
      const { product } = editing ? await api.updateProduct(Number(id), data) : await api.createProduct(data);
      navigate('/painel/produtos', {
        state: { flash: `Produto "${product.name}" ${editing ? 'atualizado' : 'cadastrado'} com sucesso.` },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else setError('Erro inesperado. Tente novamente.');
      setBusy(false);
    }
  };

  const err = (k: string) => fields[k] && <span className="field-error">{fields[k]}</span>;

  return (
    <section className="card card-wide">
      <p><Link to="/painel/produtos">← Voltar ao painel de produtos</Link></p>
      <h1>{editing ? `Editar produto nº ${id}` : 'Cadastrar produto'}</h1>
      {error && <div className="alert" role="alert">{error}</div>}
      {loaded && (
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="p-name">Nome</label>
            <input id="p-name" maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} />
            {err('name')}
          </div>
          <div className="field">
            <label htmlFor="p-desc">Descrição (texto simples)</label>
            <textarea id="p-desc" rows={4} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            {err('description')}
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="p-cat">Categoria</label>
              <input id="p-cat" list="cats" maxLength={60} value={form.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="cats">{opts.categories.map((c) => <option key={c} value={c} />)}</datalist>
              {err('category')}
            </div>
            <div className="field">
              <label htmlFor="p-size">Tamanho</label>
              <input id="p-size" list="sizes" maxLength={20} value={form.size} onChange={(e) => set('size', e.target.value)} />
              <datalist id="sizes">{opts.sizes.map((s) => <option key={s} value={s} />)}</datalist>
              {err('size')}
            </div>
            <div className="field">
              <label htmlFor="p-price">Preço (R$)</label>
              <input id="p-price" inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => set('price', e.target.value)} />
              {err('priceCents')}
            </div>
            <div className="field">
              <label htmlFor="p-stock">Estoque</label>
              <input id="p-stock" inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
              {err('stock')}
            </div>
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </form>
      )}
    </section>
  );
}
