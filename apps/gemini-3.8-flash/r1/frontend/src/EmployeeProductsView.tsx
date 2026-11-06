import React, { useState, useEffect } from 'react';
import { apiGetProducts, apiCreateProduct, apiUpdateProduct, apiGetProductFilters } from './api';
import { Product } from './types';

export const EmployeeProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modo de formulário: 'none' | 'create' | 'edit'
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Metadados
  const [categoriesList, setCategoriesList] = useState<string[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Busca todos os produtos para a tabela do funcionário (limite alto)
      const res = await apiGetProducts({ limit: 100, sortBy: 'id', order: 'desc' });
      setProducts(res.products);

      const meta = await apiGetProductFilters();
      setCategoriesList(meta.categories);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar lista de produtos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenCreate = () => {
    setError(null);
    setSuccess(null);
    setFormMode('create');
    setEditingId(null);
    setName('');
    setDescription('');
    setCategory('');
    setSize('');
    setPrice('');
    setStock('0');
  };

  const handleOpenEdit = (p: Product) => {
    setError(null);
    setSuccess(null);
    setFormMode('edit');
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setSize(p.size);
    setPrice(String(p.price));
    setStock(String(p.stock_quantity));
  };

  const handleCancelForm = () => {
    setFormMode('none');
    setEditingId(null);
    setError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('O nome da peça é obrigatório.');
      return;
    }
    if (!description.trim()) {
      setError('A descrição da peça é obrigatória.');
      return;
    }
    if (!category.trim()) {
      setError('A categoria da peça é obrigatória.');
      return;
    }
    if (!size.trim()) {
      setError('O tamanho da peça é obrigatório.');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('O preço deve ser um valor numérico não negativo.');
      return;
    }

    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setError('O estoque deve ser um número inteiro igual ou superior a zero.');
      return;
    }

    try {
      setSubmitting(true);
      if (formMode === 'create') {
        const newProduct = await apiCreateProduct({
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          size: size.trim().toUpperCase(),
          price: parsedPrice,
          stock_quantity: parsedStock
        });
        setSuccess(`Produto "${newProduct.name}" cadastrado com sucesso!`);
      } else if (formMode === 'edit' && editingId) {
        const updated = await apiUpdateProduct(editingId, {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          size: size.trim().toUpperCase(),
          price: parsedPrice,
          stock_quantity: parsedStock
        });
        setSuccess(`Produto #${updated.id} atualizado com sucesso!`);
      }

      setFormMode('none');
      setEditingId(null);
      await fetchProducts();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao salvar produto.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 className="card-title">Gerenciamento do Catálogo</h2>
          <p className="card-subtitle">Cadastre e atualize produtos, preços e estoque da loja</p>
        </div>
        {formMode === 'none' && (
          <button type="button" className="nav-btn primary" onClick={handleOpenCreate}>
            + Cadastrar Produto
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Formulário de Cadastro / Edição */}
      {formMode !== 'none' && (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
            {formMode === 'create' ? 'Novo Produto' : `Editar Produto #${editingId}`}
          </h3>

          <form onSubmit={handleSubmitForm}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nome da Peça *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Vestido Coleção D'Água"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoria *</label>
                <input
                  type="text"
                  className="form-input"
                  list="categories-datalist"
                  placeholder="Ex: Vestidos, Camisas..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                  required
                />
                <datalist id="categories-datalist">
                  {categoriesList.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div className="form-group">
                <label className="form-label">Tamanho *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: P, M, G, GG, 40, 42..."
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preço Unitário (R$) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qtd. em Estoque *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição em texto simples *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Detalhes sobre tecido, corte, caimento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="nav-btn secondary"
                onClick={handleCancelForm}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="nav-btn primary"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : (formMode === 'create' ? 'Cadastrar Peça' : 'Salvar Alterações')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Produtos */}
      {loading ? (
        <div className="loading-state">Carregando catálogo de produtos...</div>
      ) : products.length === 0 ? (
        <div className="empty-box">
          <h3>Nenhum produto cadastrado</h3>
          <p>Clique em "+ Cadastrar Produto" acima para começar.</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Tamanho</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>#{p.id}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td><span className="product-size-badge">{p.size}</span></td>
                  <td style={{ fontWeight: 600 }}>R$ {Number(p.price).toFixed(2)}</td>
                  <td>
                    <span className="status-badge" style={{
                      backgroundColor: p.stock_quantity > 0 ? 'var(--badge-enviado-bg)' : 'var(--badge-canc-bg)',
                      color: p.stock_quantity > 0 ? 'var(--badge-enviado-text)' : 'var(--badge-canc-text)'
                    }}>
                      {p.stock_quantity} un
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="nav-btn secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => handleOpenEdit(p)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
