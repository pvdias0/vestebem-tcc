import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import { Product, CreateProductInput, UpdateProductInput } from '../types';

export const EmployeeProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modo de formulário: 'closed', 'create', 'edit'
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Buscar lista de produtos (limite alto para gestão completa)
      const res = await api.getProducts({ limit: 100 });
      setProducts(res.products);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível carregar os produtos.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateForm = () => {
    setFormMode('create');
    setEditingId(null);
    setName('');
    setDescription('');
    setCategory('');
    setSize('');
    setPrice('');
    setStockQuantity('');
    setError(null);
    setSuccessMessage(null);
  };

  const openEditForm = (p: Product) => {
    setFormMode('edit');
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setSize(p.size);
    setPrice(p.price.toString());
    setStockQuantity(p.stock_quantity.toString());
    setError(null);
    setSuccessMessage(null);
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const priceNum = parseFloat(price.replace(',', '.'));
    const stockNum = parseInt(stockQuantity, 10);

    if (!name.trim()) {
      setError('O nome do produto é obrigatório.');
      return;
    }
    if (!description.trim()) {
      setError('A descrição do produto é obrigatória.');
      return;
    }
    if (!category.trim()) {
      setError('A categoria do produto é obrigatória.');
      return;
    }
    if (!size.trim()) {
      setError('O tamanho do produto é obrigatório.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('O preço unitário não pode ser negativo.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      setError('O estoque deve ser um número inteiro igual ou superior a zero.');
      return;
    }

    try {
      setSubmitting(true);
      if (formMode === 'create') {
        const payload: CreateProductInput = {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          size: size.trim(),
          price: priceNum,
          stock_quantity: stockNum,
        };
        const res = await api.createProduct(payload);
        setSuccessMessage(`Produto "${res.product.name}" cadastrado com sucesso!`);
      } else if (formMode === 'edit' && editingId) {
        const payload: UpdateProductInput = {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          size: size.trim(),
          price: priceNum,
          stock_quantity: stockNum,
        };
        const res = await api.updateProduct(editingId, payload);
        setSuccessMessage(`Produto "${res.product.name}" atualizado com sucesso!`);
      }

      setFormMode('closed');
      await fetchProducts();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao salvar o produto.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card card-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
            Painel do Funcionário - Catálogo de Produtos
          </h1>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Cadastre novos produtos ou atualize preços, tamanhos e quantidades em estoque
          </p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn btn-primary" onClick={openCreateForm}>
            + Novo Produto
          </button>
        )}
      </div>

      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Formulário de Cadastro / Edição */}
      {formMode !== 'closed' && (
        <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-primary)' }}>
            {formMode === 'create' ? 'Cadastrar Novo Produto' : `Atualizar Produto #${editingId}`}
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do produto</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex.: Camisa Linho Coleção D'Água"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Categoria</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex.: Camisas, Calças, Vestidos..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tamanho</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex.: P, M, G, GG, 40, 42..."
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preço (R$)</label>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quantidade em Estoque</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  placeholder="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição da peça (texto simples)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Descreva o tecido, caimento e detalhes da peça..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={closeForm} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Salvando...' : formMode === 'create' ? 'Salvar Produto' : 'Atualizar Produto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Produtos */}
      {loading ? (
        <div className="loading-box" style={{ padding: '3rem 0' }}>
          <div className="spinner"></div>
          <span>Buscando produtos cadastrados...</span>
        </div>
      ) : products.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0' }}>
          Nenhum produto cadastrado no momento.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table">
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
                  <td>#{p.id}</td>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.category}</td>
                  <td>{p.size}</td>
                  <td>R$ {p.price.toFixed(2)}</td>
                  <td>
                    <span style={{ color: p.stock_quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                      {p.stock_quantity} un.
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openEditForm(p)}
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
