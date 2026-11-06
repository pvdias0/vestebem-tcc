export type UserRole = 'customer' | 'employee';

export interface Address {
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  cpf?: string | null;
  phone?: string | null;
  address?: Address | null;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileInput {
  name: string;
  cpf?: string | null;
  phone?: string | null;
}

export interface UpdateAddressInput {
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export type OrderStatus = 'recebido' | 'em preparação' | 'enviado' | 'cancelado';

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

export interface CreateProductInput {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock_quantity: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  size?: string;
  price?: number;
  stock_quantity?: number;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ActiveView = 
  | 'catalog'
  | 'product-details'
  | 'login' 
  | 'register' 
  | 'account' 
  | 'new-order' 
  | 'my-orders' 
  | 'order-details' 
  | 'employee-orders'
  | 'employee-products';
