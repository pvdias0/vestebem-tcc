import { db } from '../db/connection.js';
import { Order, OrderItem, OrderStatus, CreateOrderItemInput } from '../types/order.js';
import { ProductService } from './productService.js';
import { UserService } from './userService.js';

export class OrderService {
  static createOrder(userId: number, items: CreateOrderItemInput[], confirmDelivery: boolean): Order {
    if (!items || items.length === 0) {
      const err = new Error('O pedido deve conter pelo menos um item.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!confirmDelivery) {
      const err = new Error('Você deve confirmar a utilização do seu endereço de entrega cadastrado.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Verificar se o cliente possui endereço cadastrado
    const address = UserService.getUserAddress(userId);
    if (!address) {
      const err = new Error('Para finalizar um pedido, é necessário cadastrar um endereço de entrega na sua conta.');
      (err as any).statusCode = 400;
      throw err;
    }

    const user = UserService.findById(userId);
    const phone = user?.phone || '';

    let calculatedTotal = 0;
    const validatedItems: Array<{
      product_id: number;
      product_name: string;
      description: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const qty = Math.floor(Number(item.quantity));

      if (isNaN(productId) || productId <= 0) {
        const err = new Error('Identificador de produto inválido.');
        (err as any).statusCode = 400;
        throw err;
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        const err = new Error('A quantidade de cada item deve ser um número inteiro e positivo.');
        (err as any).statusCode = 400;
        throw err;
      }

      const product = ProductService.getProductById(productId);
      if (!product) {
        const err = new Error(`Produto #${productId} não encontrado no catálogo.`);
        (err as any).statusCode = 400;
        throw err;
      }

      const unit_price = product.price;
      const subtotal = Number((qty * unit_price).toFixed(2));
      calculatedTotal = Number((calculatedTotal + subtotal).toFixed(2));

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        description: `${product.name} (Tam: ${product.size})`,
        quantity: qty,
        unit_price,
        subtotal,
      });
    }

    const createTransaction = db.transaction(() => {
      const insertOrderStmt = db.prepare(`
        INSERT INTO orders (
          user_id, total, status,
          has_delivery_info, delivery_recipient, delivery_phone,
          delivery_zip_code, delivery_street, delivery_number, delivery_complement,
          delivery_neighborhood, delivery_city, delivery_state
        )
        VALUES (?, ?, 'recebido', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const orderResult = insertOrderStmt.run(
        userId,
        calculatedTotal,
        address.recipient,
        phone,
        address.zip_code,
        address.street,
        address.number,
        address.complement || null,
        address.neighborhood,
        address.city,
        address.state
      );
      const orderId = Number(orderResult.lastInsertRowid);

      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, description, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertItemStmt.run(
          orderId,
          item.product_id,
          item.product_name,
          item.description,
          item.quantity,
          item.unit_price,
          item.subtotal
        );
      }

      return orderId;
    });

    const newOrderId = createTransaction();
    return this.findOrderById(newOrderId)!;
  }

  static findOrderById(orderId: number, requestingUserId?: number, isEmployee = false): Order | undefined {
    // Note: Nunca selecionamos CPF do usuário aqui, atendendo à regra de negócio estrita
    const orderStmt = db.prepare(`
      SELECT o.id, o.user_id, o.total, o.status, o.created_at, o.updated_at,
             o.has_delivery_info, o.delivery_recipient, o.delivery_phone,
             o.delivery_zip_code, o.delivery_street, o.delivery_number, o.delivery_complement,
             o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `);

    const rawOrder = orderStmt.get(orderId) as any;
    if (!rawOrder) {
      return undefined;
    }

    if (!isEmployee && requestingUserId && rawOrder.user_id !== requestingUserId) {
      const err = new Error('Acesso negado ao pedido solicitado.');
      (err as any).statusCode = 403;
      throw err;
    }

    const itemsStmt = db.prepare(`
      SELECT id, order_id, product_id, product_name, description, quantity, unit_price, subtotal
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `);

    const items = itemsStmt.all(orderId) as OrderItem[];
    return {
      ...rawOrder,
      has_delivery_info: Boolean(rawOrder.has_delivery_info),
      items,
    };
  }

  static listOrdersByUser(userId: number): Order[] {
    const stmt = db.prepare(`
      SELECT o.id, o.user_id, o.total, o.status, o.created_at, o.updated_at,
             o.has_delivery_info, o.delivery_recipient, o.delivery_phone,
             o.delivery_zip_code, o.delivery_street, o.delivery_number, o.delivery_complement,
             o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY o.id DESC
    `);

    const orders = stmt.all(userId) as any[];

    const itemsStmt = db.prepare(`
      SELECT id, order_id, product_id, product_name, description, quantity, unit_price, subtotal
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `);

    return orders.map((ord) => ({
      ...ord,
      has_delivery_info: Boolean(ord.has_delivery_info),
      items: itemsStmt.all(ord.id) as OrderItem[],
    }));
  }

  static listAllOrders(): Order[] {
    const stmt = db.prepare(`
      SELECT o.id, o.user_id, o.total, o.status, o.created_at, o.updated_at,
             o.has_delivery_info, o.delivery_recipient, o.delivery_phone,
             o.delivery_zip_code, o.delivery_street, o.delivery_number, o.delivery_complement,
             o.delivery_neighborhood, o.delivery_city, o.delivery_state,
             u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
    `);

    const orders = stmt.all() as any[];

    const itemsStmt = db.prepare(`
      SELECT id, order_id, product_id, product_name, description, quantity, unit_price, subtotal
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `);

    return orders.map((ord) => ({
      ...ord,
      has_delivery_info: Boolean(ord.has_delivery_info),
      items: itemsStmt.all(ord.id) as OrderItem[],
    }));
  }

  static updateOrderStatus(orderId: number, newStatus: OrderStatus): Order {
    const validStatuses: OrderStatus[] = ['recebido', 'em preparação', 'enviado', 'cancelado'];
    if (!validStatuses.includes(newStatus)) {
      const err = new Error('Status do pedido inválido.');
      (err as any).statusCode = 400;
      throw err;
    }

    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
    if (!existing) {
      const err = new Error('Pedido não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }

    const updateStmt = db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(newStatus, orderId);

    return this.findOrderById(orderId, undefined, true)!;
  }
}
