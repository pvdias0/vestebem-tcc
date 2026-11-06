export type UserRole = 'customer' | 'employee';

export type OrderStatus = 'recebido' | 'em preparação' | 'enviado' | 'cancelado';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  cpf?: string | null;
  phone?: string | null;
  recipient_name?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
}

export interface AuthResponse {
  message?: string;
  user: User;
  token?: string;
  error?: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductsResponse {
  products: Product[];
  pagination: PaginationMeta;
}

export interface ProductFiltersMeta {
  categories: string[];
  sizes: string[];
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount: number;
  status: OrderStatus;
  // Snapshot de entrega
  delivery_recipient_name?: string | null;
  delivery_phone?: string | null;
  delivery_cep?: string | null;
  delivery_street?: string | null;
  delivery_number?: string | null;
  delivery_complement?: string | null;
  delivery_neighborhood?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}
