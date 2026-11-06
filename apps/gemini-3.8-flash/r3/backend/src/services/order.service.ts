import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { getProductById } from './product.service.js';

export type OrderStatus = 'recebido' | 'em preparação' | 'enviado' | 'cancelado';

export const VALID_ORDER_STATUSES: OrderStatus[] = [
  'recebido',
  'em preparação',
  'enviado',
  'cancelado',
];

export interface CreateOrderItemInput {
  productId?: string;
  description?: string;
  quantity: number;
}

export interface ShippingAddressSnapshot {
  recipientName: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  productName?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  shipping: ShippingAddressSnapshot | null;
  items: OrderItem[];
}

interface OrderRow {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  total_amount: number;
  status: OrderStatus;
  shipping_recipient?: string | null;
  shipping_phone?: string | null;
  shipping_cep?: string | null;
  shipping_street?: string | null;
  shipping_number?: string | null;
  shipping_complement?: string | null;
  shipping_neighborhood?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

interface UserAddressRow {
  id: string;
  name: string;
  phone?: string | null;
  recipient_name?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

function extractShippingFromRow(row: OrderRow): ShippingAddressSnapshot | null {
  if (row.shipping_recipient && row.shipping_cep && row.shipping_street && row.shipping_number && row.shipping_city && row.shipping_state) {
    return {
      recipientName: row.shipping_recipient,
      phone: row.shipping_phone || '',
      cep: row.shipping_cep,
      street: row.shipping_street,
      number: row.shipping_number,
      complement: row.shipping_complement || '',
      neighborhood: row.shipping_neighborhood || '',
      city: row.shipping_city,
      state: row.shipping_state,
    };
  }
  return null;
}

export function createOrder(
  customerId: string,
  itemsInput: CreateOrderItemInput[],
  confirmShipping = true
): Order {
  if (!itemsInput || !Array.isArray(itemsInput) || itemsInput.length === 0) {
    const error: any = new Error('O pedido deve conter pelo menos um item.');
    error.status = 400;
    throw error;
  }

  if (!confirmShipping) {
    const error: any = new Error('É necessário confirmar a utilização do endereço de entrega cadastrado.');
    error.status = 400;
    throw error;
  }

  // Obter endereço cadastrado do cliente
  const user = db.prepare(`
    SELECT id, name, phone, recipient_name, cep, street, number, complement, neighborhood, city, state
    FROM users
    WHERE id = ?
  `).get(customerId) as UserAddressRow | undefined;

  if (!user) {
    const error: any = new Error('Cliente não encontrado.');
    error.status = 404;
    throw error;
  }

  if (
    !user.recipient_name ||
    !user.cep ||
    !user.street ||
    !user.number ||
    !user.neighborhood ||
    !user.city ||
    !user.state
  ) {
    const error: any = new Error('Para finalizar um novo pedido, você deve ter um endereço de entrega cadastrado na página Minha Conta.');
    error.status = 400;
    throw error;
  }

  const shippingSnapshot: ShippingAddressSnapshot = {
    recipientName: user.recipient_name,
    phone: user.phone || '',
    cep: user.cep,
    street: user.street,
    number: user.number,
    complement: user.complement || '',
    neighborhood: user.neighborhood,
    city: user.city,
    state: user.state,
  };

  // Validar itens e calcular total a partir dos produtos
  const processedItems: {
    productId: string;
    productName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];

  let calculatedTotal = 0;

  for (let i = 0; i < itemsInput.length; i++) {
    const item = itemsInput[i];
    const productId = item.productId;

    if (!productId) {
      const error: any = new Error(`Item ${i + 1}: o produto selecionado é obrigatório.`);
      error.status = 400;
      throw error;
    }

    const product = getProductById(productId);
    if (!product) {
      const error: any = new Error(`Item ${i + 1}: produto selecionado não foi encontrado no catálogo.`);
      error.status = 404;
      throw error;
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      const error: any = new Error(`Item ${i + 1} ("${product.name}"): a quantidade deve ser um número inteiro e positivo.`);
      error.status = 400;
      throw error;
    }

    const unitPrice = product.price;
    const subtotal = Math.round(qty * unitPrice * 100) / 100;
    calculatedTotal += subtotal;

    const description = item.description && item.description.trim() ? item.description.trim() : product.name;

    processedItems.push({
      productId: product.id,
      productName: product.name,
      description,
      quantity: qty,
      unitPrice,
      subtotal,
    });
  }

  calculatedTotal = Math.round(calculatedTotal * 100) / 100;

  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStatus: OrderStatus = 'recebido';

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO orders (
        id, customer_id, total_amount, status,
        shipping_recipient, shipping_phone, shipping_cep, shipping_street,
        shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      customerId,
      calculatedTotal,
      initialStatus,
      shippingSnapshot.recipientName,
      shippingSnapshot.phone,
      shippingSnapshot.cep,
      shippingSnapshot.street,
      shippingSnapshot.number,
      shippingSnapshot.complement || '',
      shippingSnapshot.neighborhood,
      shippingSnapshot.city,
      shippingSnapshot.state,
      now,
      now
    );

    const createdItems: OrderItem[] = [];

    for (const pItem of processedItems) {
      const itemId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, description, quantity, unit_price, subtotal, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        orderId,
        pItem.productId,
        pItem.productName,
        pItem.description,
        pItem.quantity,
        pItem.unitPrice,
        pItem.subtotal,
        now
      );

      createdItems.push({
        id: itemId,
        orderId,
        productId: pItem.productId,
        productName: pItem.productName,
        description: pItem.description,
        quantity: pItem.quantity,
        unitPrice: pItem.unitPrice,
        subtotal: pItem.subtotal,
        createdAt: now,
      });
    }

    db.exec('COMMIT;');

    return {
      id: orderId,
      customerId,
      totalAmount: calculatedTotal,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
      shipping: shippingSnapshot,
      items: createdItems,
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function listOrdersByCustomer(customerId: string): Order[] {
  const orderRows = db.prepare(`
    SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.updated_at,
           o.shipping_recipient, o.shipping_phone, o.shipping_cep, o.shipping_street,
           o.shipping_number, o.shipping_complement, o.shipping_neighborhood, o.shipping_city, o.shipping_state,
           u.name as customer_name, u.email as customer_email
    FROM orders o
    JOIN users u ON u.id = o.customer_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(customerId) as unknown as OrderRow[];

  return attachItemsToOrders(orderRows);
}

export function listAllOrders(): Order[] {
  const orderRows = db.prepare(`
    SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.updated_at,
           o.shipping_recipient, o.shipping_phone, o.shipping_cep, o.shipping_street,
           o.shipping_number, o.shipping_complement, o.shipping_neighborhood, o.shipping_city, o.shipping_state,
           u.name as customer_name, u.email as customer_email
    FROM orders o
    JOIN users u ON u.id = o.customer_id
    ORDER BY o.created_at DESC
  `).all() as unknown as OrderRow[];

  return attachItemsToOrders(orderRows);
}

export function getOrderById(orderId: string, user: { id: string; role: string }): Order | null {
  const orderRow = db.prepare(`
    SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.updated_at,
           o.shipping_recipient, o.shipping_phone, o.shipping_cep, o.shipping_street,
           o.shipping_number, o.shipping_complement, o.shipping_neighborhood, o.shipping_city, o.shipping_state,
           u.name as customer_name, u.email as customer_email
    FROM orders o
    JOIN users u ON u.id = o.customer_id
    WHERE o.id = ?
  `).get(orderId) as unknown as OrderRow | undefined;

  if (!orderRow) {
    return null;
  }

  // Controle de acesso: cliente vê apenas o próprio pedido
  if (user.role === 'customer' && orderRow.customer_id !== user.id) {
    const error: any = new Error('Você não tem permissão para visualizar este pedido.');
    error.status = 403;
    throw error;
  }

  const items = getOrderItems(orderId);
  const shipping = extractShippingFromRow(orderRow);

  return {
    id: orderRow.id,
    customerId: orderRow.customer_id,
    customerName: orderRow.customer_name,
    customerEmail: orderRow.customer_email,
    totalAmount: orderRow.total_amount,
    status: orderRow.status,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
    shipping,
    items,
  };
}

export function updateOrderStatus(orderId: string, newStatus: string): Order {
  if (!VALID_ORDER_STATUSES.includes(newStatus as OrderStatus)) {
    const error: any = new Error(`Status inválido. Permitidos: ${VALID_ORDER_STATUSES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
  if (!existing) {
    const error: any = new Error('Pedido não encontrado.');
    error.status = 404;
    throw error;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, orderId);

  const updatedOrder = getOrderById(orderId, { id: '', role: 'employee' });
  if (!updatedOrder) {
    throw new Error('Falha ao obter pedido atualizado.');
  }

  return updatedOrder;
}

function getOrderItems(orderId: string): OrderItem[] {
  const itemRows = db.prepare(`
    SELECT id, order_id, product_id, product_name, description, quantity, unit_price, subtotal, created_at
    FROM order_items
    WHERE order_id = ?
    ORDER BY created_at ASC
  `).all(orderId) as unknown as OrderItemRow[];

  return itemRows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id || null,
    productName: row.product_name || null,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    subtotal: row.subtotal,
    createdAt: row.created_at,
  }));
}

function attachItemsToOrders(orderRows: OrderRow[]): Order[] {
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const allItemRows = db.prepare(`
    SELECT id, order_id, product_id, product_name, description, quantity, unit_price, subtotal, created_at
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...orderIds) as unknown as OrderItemRow[];

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of allItemRows) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id || null,
      productName: item.product_name || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
      createdAt: item.created_at,
    });
    itemsByOrder.set(item.order_id, list);
  }

  return orderRows.map((o) => ({
    id: o.id,
    customerId: o.customer_id,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    totalAmount: o.total_amount,
    status: o.status,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    shipping: extractShippingFromRow(o),
    items: itemsByOrder.get(o.id) || [],
  }));
}
