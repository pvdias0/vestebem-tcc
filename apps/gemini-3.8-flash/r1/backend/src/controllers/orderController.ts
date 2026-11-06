import { Request, Response } from 'express';
import { getDatabase } from '../db/index';
import { OrderItem, OrderRecord, OrderStatus, ProductRecord, SafeUser } from '../types';

const VALID_STATUSES: OrderStatus[] = ['recebido', 'em preparação', 'enviado', 'cancelado'];

export function createOrder(req: Request, res: Response): void {
  try {
    if (!req.user || req.user.role !== 'customer') {
      res.status(403).json({ error: 'Apenas clientes autenticados podem criar pedidos.' });
      return;
    }

    const { items, confirm_address } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'O pedido deve conter pelo menos um item.' });
      return;
    }

    const db = getDatabase();

    // 1. Obter os dados atuais do cliente para validar endereço e telefone
    const currentUser = db.prepare(`
      SELECT id, name, email, role, cpf, phone, recipient_name, cep, street, number, complement, neighborhood, city, state
      FROM users WHERE id = ?
    `).get(req.user.id) as unknown as SafeUser;

    const hasCompleteAddress =
      currentUser.recipient_name &&
      currentUser.cep &&
      currentUser.street &&
      currentUser.number &&
      currentUser.neighborhood &&
      currentUser.city &&
      currentUser.state;

    if (!hasCompleteAddress) {
      res.status(400).json({
        error: 'É necessário cadastrar um endereço de entrega completo na sua conta antes de finalizar o pedido.'
      });
      return;
    }

    if (!confirm_address) {
      res.status(400).json({
        error: 'Você deve confirmar a utilização do endereço de entrega cadastrado para finalizar o pedido.'
      });
      return;
    }

    const validatedItems: {
      product_id: number;
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }[] = [];

    let calculatedTotal = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const productId = Number(item.product_id);
      if (!productId || isNaN(productId)) {
        res.status(400).json({ error: `O item #${i + 1} deve ter um produto selecionado válido.` });
        return;
      }

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        res.status(400).json({ error: `O item #${i + 1} deve ter uma quantidade inteira e positiva.` });
        return;
      }

      // Busca o produto no catálogo para obter preço oficial e nome atual
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as unknown as ProductRecord | undefined;
      if (!product) {
        res.status(400).json({ error: `Produto com identificador #${productId} não encontrado no catálogo.` });
        return;
      }

      const unitPrice = Number(product.price);
      const itemTotal = Number((qty * unitPrice).toFixed(2));
      calculatedTotal += itemTotal;

      const description = `${product.name} (Tam: ${product.size})`;

      validatedItems.push({
        product_id: product.id,
        description,
        quantity: qty,
        unit_price: unitPrice,
        total_price: itemTotal
      });
    }

    calculatedTotal = Number(calculatedTotal.toFixed(2));

    // Insere o pedido com SNAPSHOT de entrega congelado
    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        customer_id,
        total_amount,
        status,
        delivery_recipient_name,
        delivery_phone,
        delivery_cep,
        delivery_street,
        delivery_number,
        delivery_complement,
        delivery_neighborhood,
        delivery_city,
        delivery_state
      )
      VALUES (?, ?, 'recebido', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertOrderStmt.run(
      req.user.id,
      calculatedTotal,
      currentUser.recipient_name || '',
      currentUser.phone || null,
      currentUser.cep || '',
      currentUser.street || '',
      currentUser.number || '',
      currentUser.complement || null,
      currentUser.neighborhood || '',
      currentUser.city || '',
      currentUser.state || ''
    );
    const orderId = Number(result.lastInsertRowid);

    // Insere os itens do pedido com product_id registrado
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const it of validatedItems) {
      insertItemStmt.run(orderId, it.product_id, it.description, it.quantity, it.unit_price, it.total_price);
    }

    // Busca o pedido sem expor CPF
    const createdOrder = db.prepare(`
      SELECT o.id, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             o.total_amount, o.status,
             o.delivery_recipient_name, o.delivery_phone, o.delivery_cep, o.delivery_street,
             o.delivery_number, o.delivery_complement, o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             o.created_at, o.updated_at
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      WHERE o.id = ?
    `).get(orderId) as unknown as OrderRecord;

    const createdItems = db.prepare(`
      SELECT id, order_id, product_id, description, quantity, unit_price, total_price
      FROM order_items
      WHERE order_id = ?
    `).all(orderId) as unknown as OrderItem[];

    createdOrder.items = createdItems;

    res.status(201).json({
      message: 'Pedido criado com sucesso!',
      order: createdOrder
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro interno ao criar pedido.' });
  }
}

export function listOrders(req: Request, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const db = getDatabase();
    let orders: OrderRecord[] = [];

    // O CPF é omitido intencionalmente de todas as queries
    if (req.user.role === 'employee') {
      orders = db.prepare(`
        SELECT o.id, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
               o.total_amount, o.status,
               o.delivery_recipient_name, o.delivery_phone, o.delivery_cep, o.delivery_street,
               o.delivery_number, o.delivery_complement, o.delivery_neighborhood, o.delivery_city, o.delivery_state,
               o.created_at, o.updated_at
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        ORDER BY o.created_at DESC
      `).all() as unknown as OrderRecord[];
    } else {
      orders = db.prepare(`
        SELECT o.id, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
               o.total_amount, o.status,
               o.delivery_recipient_name, o.delivery_phone, o.delivery_cep, o.delivery_street,
               o.delivery_number, o.delivery_complement, o.delivery_neighborhood, o.delivery_city, o.delivery_state,
               o.created_at, o.updated_at
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
      `).all(req.user.id) as unknown as OrderRecord[];
    }

    const getItemsStmt = db.prepare(`
      SELECT id, order_id, product_id, description, quantity, unit_price, total_price
      FROM order_items
      WHERE order_id = ?
    `);

    for (const ord of orders) {
      ord.items = getItemsStmt.all(ord.id) as unknown as OrderItem[];
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro interno ao buscar pedidos.' });
  }
}

export function getOrderById(req: Request, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const orderId = Number(req.params.id);
    if (!orderId || isNaN(orderId)) {
      res.status(400).json({ error: 'Identificador do pedido inválido.' });
      return;
    }

    const db = getDatabase();
    // O CPF nunca é selecionado nas consultas de pedidos
    const order = db.prepare(`
      SELECT o.id, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             o.total_amount, o.status,
             o.delivery_recipient_name, o.delivery_phone, o.delivery_cep, o.delivery_street,
             o.delivery_number, o.delivery_complement, o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             o.created_at, o.updated_at
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      WHERE o.id = ?
    `).get(orderId) as unknown as OrderRecord | undefined;

    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      res.status(403).json({ error: 'Você não tem permissão para acessar os dados deste pedido.' });
      return;
    }

    const items = db.prepare(`
      SELECT id, order_id, product_id, description, quantity, unit_price, total_price
      FROM order_items
      WHERE order_id = ?
    `).all(order.id) as unknown as OrderItem[];

    order.items = items;

    res.status(200).json({ order });
  } catch (error) {
    console.error('Erro ao buscar pedido por id:', error);
    res.status(500).json({ error: 'Erro interno ao obter pedido.' });
  }
}

export function updateOrderStatus(req: Request, res: Response): void {
  try {
    if (!req.user || req.user.role !== 'employee') {
      res.status(403).json({ error: 'Apenas funcionários podem alterar o status de um pedido.' });
      return;
    }

    const orderId = Number(req.params.id);
    const { status } = req.body;

    if (!orderId || isNaN(orderId)) {
      res.status(400).json({ error: 'Identificador de pedido inválido.' });
      return;
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        error: `Status inválido. Os status permitidos são: ${VALID_STATUSES.join(', ')}.`
      });
      return;
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
    if (!existing) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, orderId);

    const updatedOrder = db.prepare(`
      SELECT o.id, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             o.total_amount, o.status,
             o.delivery_recipient_name, o.delivery_phone, o.delivery_cep, o.delivery_street,
             o.delivery_number, o.delivery_complement, o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             o.created_at, o.updated_at
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      WHERE o.id = ?
    `).get(orderId) as unknown as OrderRecord;

    const items = db.prepare(`
      SELECT id, order_id, product_id, description, quantity, unit_price, total_price
      FROM order_items
      WHERE order_id = ?
    `).all(orderId) as unknown as OrderItem[];

    updatedOrder.items = items;

    res.status(200).json({
      message: `Status do pedido #${orderId} atualizado para "${status}".`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar status.' });
  }
}
