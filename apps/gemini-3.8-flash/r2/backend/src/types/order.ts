export type OrderStatus = 'recebido' | 'em preparação' | 'enviado' | 'cancelado';

export interface OrderDeliveryAddress {
  recipient: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  product_name?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  user_id: number;
  customer_name?: string;
  customer_email?: string;
  // Dados de entrega (apenas visíveis nos detalhes do pedido, sem expor CPF)
  has_delivery_info: boolean;
  delivery_recipient?: string | null;
  delivery_phone?: string | null;
  delivery_zip_code?: string | null;
  delivery_street?: string | null;
  delivery_number?: string | null;
  delivery_complement?: string | null;
  delivery_neighborhood?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface CreateOrderItemInput {
  product_id: number;
  quantity: number;
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[];
  confirmDelivery: boolean;
}
