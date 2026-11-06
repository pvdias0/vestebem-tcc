import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  createProduct,
  updateProduct,
  getProductById,
  listProducts,
} from '../services/product.service.js';

export const productRouter = Router();

// GET /api/products - Catálogo público com paginação, filtros e ordenação
productRouter.get('/', (req, res) => {
  try {
    const { search, category, size, minPrice, maxPrice, sortBy, sortOrder, page, limit } = req.query;

    const result = listProducts({
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      size: typeof size === 'string' ? size : undefined,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
      sortBy: sortBy === 'price' || sortBy === 'createdAt' ? sortBy : 'name',
      sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
      page: page !== undefined ? Number(page) : 1,
      limit: limit !== undefined ? Number(limit) : 12,
    });

    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro ao listar produtos.' });
  }
});

// GET /api/products/:id - Detalhes públicos de um produto
productRouter.get('/:id', (req, res) => {
  try {
    const id = req.params.id as string;
    const product = getProductById(id);

    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    res.status(200).json({ product });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro ao buscar detalhes do produto.' });
  }
});

// POST /api/products - Cadastrar produto (Somente funcionários)
productRouter.post('/', requireAuth, requireRole(['employee']), (req: AuthenticatedRequest, res) => {
  try {
    const product = createProduct(req.body);
    res.status(201).json({ product, message: 'Produto cadastrado com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao cadastrar produto.' });
  }
});

// PUT /api/products/:id - Atualizar produto (Somente funcionários)
productRouter.put('/:id', requireAuth, requireRole(['employee']), (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const product = updateProduct(id, req.body);
    res.status(200).json({ product, message: 'Produto atualizado com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao atualizar produto.' });
  }
});
