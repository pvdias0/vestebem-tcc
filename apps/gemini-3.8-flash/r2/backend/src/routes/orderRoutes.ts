import { Router, Response } from 'express';
import { z } from 'zod';
import { OrderService } from '../services/orderService.js';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { OrderStatus } from '../types/order.js';

export const orderRouter = Router();

orderRouter.use(authMiddleware);

const itemInputSchema = z.object({
  product_id: z.number().int().positive('Identificador do produto deve ser positivo.'),
  quantity: z.number().int('A quantidade deve ser um número inteiro.').positive('A quantidade deve ser maior que zero.'),
});

const createOrderSchema = z.object({
  items: z.array(itemInputSchema).min(1, 'O pedido deve conter pelo menos um item.'),
  confirmDelivery: z.boolean().refine((val) => val === true, {
    message: 'É obrigatório confirmar a utilização do endereço de entrega cadastrado.',
  }),
});

const updateStatusSchema = z.object({
  status: z.enum(['recebido', 'em preparação', 'enviado', 'cancelado'] as const, {
    errorMap: () => ({ message: 'Status inválido. Escolha: recebido, em preparação, enviado ou cancelado.' }),
  }),
});

// POST /api/orders - Criar pedido a partir de produtos do catálogo com confirmação de endereço
orderRouter.post('/', requireRole('customer'), (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parseResult = createOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Dados do pedido inválidos.',
      });
      return;
    }

    const userId = req.user!.id;
    const order = OrderService.createOrder(userId, parseResult.data.items, parseResult.data.confirmDelivery);

    res.status(201).json({
      message: 'Pedido criado com sucesso.',
      order,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/my - Meus pedidos
orderRouter.get('/my', requireRole('customer'), (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const orders = OrderService.listOrdersByUser(userId);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/all - Listar todos os pedidos (funcionários)
orderRouter.get('/all', requireRole('employee'), (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const orders = OrderService.listAllOrders();
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Detalhes do pedido (com dados de envio para funcionário ou cliente responsável)
orderRouter.get('/:id', (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json({ message: 'Identificador de pedido inválido.' });
      return;
    }

    const isEmployee = req.user!.role === 'employee';
    const order = OrderService.findOrderById(orderId, req.user!.id, isEmployee);

    if (!order) {
      res.status(404).json({ message: 'Pedido não encontrado.' });
      return;
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status - Alterar status
orderRouter.patch('/:id/status', requireRole('employee'), (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json({ message: 'Identificador de pedido inválido.' });
      return;
    }

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Status inválido.',
      });
      return;
    }

    const updatedOrder = OrderService.updateOrderStatus(orderId, parseResult.data.status as OrderStatus);
    res.json({
      message: 'Status do pedido atualizado com sucesso.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});
