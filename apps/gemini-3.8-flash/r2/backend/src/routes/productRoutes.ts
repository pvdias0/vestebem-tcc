import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ProductService } from '../services/productService.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

export const productRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1, 'O nome do produto é obrigatório.'),
  description: z.string().min(1, 'A descrição do produto é obrigatória.'),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  size: z.string().min(1, 'O tamanho é obrigatório.'),
  price: z.number().nonnegative('O preço não pode ser negativo.'),
  stock_quantity: z.number().int('O estoque deve ser um número inteiro.').nonnegative('O estoque não pode ser negativo.'),
});

const updateProductSchema = z.object({
  name: z.string().min(1, 'O nome não pode ser vazio.').optional(),
  description: z.string().min(1, 'A descrição não pode ser vazia.').optional(),
  category: z.string().min(1, 'A categoria não pode ser vazia.').optional(),
  size: z.string().min(1, 'O tamanho não pode ser vazio.').optional(),
  price: z.number().nonnegative('O preço não pode ser negativo.').optional(),
  stock_quantity: z.number().int('O estoque deve ser inteiro.').nonnegative('O estoque não pode ser negativo.').optional(),
});

// GET /api/products/filters - Opções de filtros (público)
productRouter.get('/filters', (_req: Request, res: Response) => {
  const options = ProductService.getFilterOptions();
  res.json(options);
});

// GET /api/products - Catálogo público com paginação, busca e filtros
productRouter.get('/', (req: Request, res: Response, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const size = req.query.size as string | undefined;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const sortBy = (req.query.sortBy as 'name' | 'price') || undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || undefined;

    const result = ProductService.listProducts({
      page,
      limit,
      search,
      category,
      size,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Detalhes do produto (público)
productRouter.get('/:id', (req: Request, res: Response, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Identificador do produto inválido.' });
      return;
    }

    const product = ProductService.getProductById(id);
    if (!product) {
      res.status(404).json({ message: 'Produto não encontrado.' });
      return;
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Cadastrar produto (somente funcionários)
productRouter.post('/', authMiddleware, requireRole('employee'), (req: Request, res: Response, next) => {
  try {
    const parseResult = createProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const newProduct = ProductService.createProduct(parseResult.data);
    res.status(201).json({
      message: 'Produto cadastrado com sucesso.',
      product: newProduct,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Atualizar produto (somente funcionários)
productRouter.put('/:id', authMiddleware, requireRole('employee'), (req: Request, res: Response, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Identificador do produto inválido.' });
      return;
    }

    const parseResult = updateProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const updatedProduct = ProductService.updateProduct(id, parseResult.data);
    res.json({
      message: 'Produto atualizado com sucesso.',
      product: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
});
