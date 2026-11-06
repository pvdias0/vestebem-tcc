import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import {
  listProducts,
  getProductById,
  getCategoriesAndSizes,
  createProduct,
  updateProduct
} from '../controllers/productController';

const router = Router();

// Rotas públicas
router.get('/', listProducts);
router.get('/meta/filters', getCategoriesAndSizes);
router.get('/:id', getProductById);

// Rotas exclusivas de funcionários
router.post('/', authenticate, requireRole(['employee']), createProduct);
router.put('/:id', authenticate, requireRole(['employee']), updateProduct);

export default router;
