import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderStatus
} from '../controllers/orderController';

const router = Router();

// Todas as rotas de pedidos exigem autenticação
router.use(authenticate);

// Listar pedidos (clientes vêem os seus, funcionários vêem todos)
router.get('/', listOrders);

// Detalhes de um pedido por ID (clientes vêem somente o seu, funcionários vêem qualquer um)
router.get('/:id', getOrderById);

// Criar pedido (somente clientes)
router.post('/', requireRole(['customer']), createOrder);

// Alterar status de pedido (somente funcionários)
router.patch('/:id/status', requireRole(['employee']), updateOrderStatus);

export default router;
