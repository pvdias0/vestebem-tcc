import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  createOrder,
  listOrdersByCustomer,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
} from '../services/order.service.js';

export const orderRouter = Router();

// Todas as rotas de pedidos exigem autenticação
orderRouter.use(requireAuth);

// POST /api/orders - Criar pedido (Apenas clientes)
orderRouter.post('/', requireRole(['customer']), (req: AuthenticatedRequest, res) => {
  try {
    const customerId = req.user!.id;
    const { items, confirmShipping } = req.body;

    const newOrder = createOrder(customerId, items, confirmShipping);
    res.status(201).json({ order: newOrder, message: 'Pedido criado com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao criar pedido.' });
  }
});

// GET /api/orders/my - Meus pedidos (Apenas clientes)
orderRouter.get('/my', requireRole(['customer']), (req: AuthenticatedRequest, res) => {
  try {
    const customerId = req.user!.id;
    const orders = listOrdersByCustomer(customerId);
    res.status(200).json({ orders });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro ao listar pedidos.' });
  }
});

// GET /api/orders - Listar todos os pedidos (Apenas funcionários)
orderRouter.get('/', requireRole(['employee']), (_req: AuthenticatedRequest, res) => {
  try {
    const orders = listAllOrders();
    res.status(200).json({ orders });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro ao listar pedidos.' });
  }
});

// GET /api/orders/:id - Detalhes do pedido (Cliente acessa o seu; Funcionário acessa todos)
orderRouter.get('/:id', (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const user = req.user!;

    const order = getOrderById(orderId, { id: user.id, role: user.role });
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    res.status(200).json({ order });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro ao buscar detalhes do pedido.' });
  }
});

// PATCH /api/orders/:id/status - Alterar status do pedido (Apenas funcionários)
orderRouter.patch('/:id/status', requireRole(['employee']), (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'O novo status é obrigatório.' });
      return;
    }

    const updatedOrder = updateOrderStatus(orderId, status);
    res.status(200).json({ order: updatedOrder, message: 'Status do pedido atualizado com sucesso!' });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Erro ao atualizar status do pedido.' });
  }
});
