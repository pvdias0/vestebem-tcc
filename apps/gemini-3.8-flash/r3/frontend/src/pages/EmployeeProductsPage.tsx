import React, { useEffect, useState } from 'react';
import { api, type Product, type CreateProductPayload } from '../services/api.js';

export const EmployeeProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulário de Criação/Edição
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProducts({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
      setProducts(res.products);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lista de produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleStartCreate = () => {
    setIsEditing(true);
    setEditingId(null);
    setName('');
    setDescription('');
    setCategory('');
    setSize('');
    setPrice('');
    setStock('0');
    setError(null);
    setSuccess(null);
  };

  const handleStartEdit = (product: Product) => {
    setIsEditing(true);
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description);
    setCategory(product.category);
    setSize(product.size);
    setPrice(String(product.price));
    setStock(String(product.stock));
    setError(null);
    setSuccess(null);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setError(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const trimmedCat = category.trim();
    const trimmedSize = size.trim();
    const numPrice = parseFloat(price.replace(',', '.'));
    const numStock = parseInt(stock, 10);

    if (!trimmedName) {
      setError('O nome do produto é obrigatório.');
      return;
    }
    if (!trimmedDesc) {
      setError('A descrição do produto é obrigatória.');
      return;
    }
    if (!trimmedCat) {
      setError('A categoria é obrigatória.');
      return;
    }
    if (!trimmedSize) {
      setError('O tamanho é obrigatório.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setError('O preço deve ser um valor numérico válido e não negativo.');
      return;
    }
    if (isNaN(numStock) || numStock < 0 || String(numStock) !== stock.trim()) {
      setError('O estoque deve ser um número inteiro igual ou superior a zero.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateProductPayload = {
        name: trimmedName,
        description: trimmedDesc,
        category: trimmedCat,
        size: trimmedSize,
        price: numPrice,
        stock: numStock,
      };

      if (editingId) {
        await api.updateProduct(editingId, payload);
        setSuccess(`Produto "${trimmedName}" atualizado com sucesso!`);
      } else {
        await api.createProduct(payload);
        setSuccess(`Produto "${trimmedName}" cadastrado com sucesso!`);
      }

      setIsEditing(false);
      setEditingId(null);
      await fetchProducts();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar produto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card max-w-5xl">
      <div className="page-header flex-between">
        <div>
          <h2>Gerenciamento de Produtos</h2>
          <p className="page-subtitle">Cadastre novas peças e atualize preços, tamanhos e estoque</p>
        </div>
        {!isEditing && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartCreate}
          >
            + Cadastrar novo produto
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Formulário Modal/Embutido */}
      {isEditing && (
        <div className="product-form-box">
          <h3 className="section-title">
            {editingId ? 'Editar Produto' : 'Novo Produto'}
          </h3>

          <form onSubmit={handleSaveProduct} noValidate>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Nome do produto</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Vestido Floral Coleção D'Água"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Vestidos, Camisetas, Calças"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tamanho</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: P, M, G, GG, 40, 42"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label>Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantidade em Estoque</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-control"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group mt-2">
              <label>Descrição em texto simples</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Descreva o corte, tecido e detalhes da peça..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="form-actions-bar mt-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCancelForm}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : editingId ? 'Atualizar Produto' : 'Cadastrar Produto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Produtos Cadastrados */}
      {loading ? (
        <div className="loading-container py-8">
          <p className="text-muted">Carregando catálogo para gestão...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👗</span>
          <h3>Nenhum produto cadastrado</h3>
          <p className="text-muted">Clique no botão acima para cadastrar a primeira peça da loja.</p>
        </div>
      ) : (
        <div className="items-table-container mt-4">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Tamanho</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="font-semibold">{p.name}</span>
                    <p className="text-xs text-muted line-clamp-1">{p.description}</p>
                  </td>
                  <td>
                    <span className="badge-category">{p.category}</span>
                  </td>
                  <td>
                    <span className="badge-size">{p.size}</span>
                  </td>
                  <td className="font-semibold">R$ {p.price.toFixed(2)}</td>
                  <td>
                    <span className={`font-medium ${p.stock > 0 ? 'text-success' : 'text-danger'}`}>
                      {p.stock} un.
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleStartEdit(p)}
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
