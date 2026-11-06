export type Role = 'customer' | 'employee';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export type OrderStatus = 'recebido' | 'em_preparacao' | 'enviado' | 'cancelado';

export interface OrderSummary {
  id: number;
  customer: { id: number; name: string; email: string };
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  /** null = pedido sem informações de entrega registradas (anterior à etapa 4). */
  shipping: Shipping | null;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface Shipping {
  recipient: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export type AddressInput = Omit<Shipping, 'phone'>;
export interface Address extends AddressInput {
  updatedAt: string;
}

export interface Account {
  user: User;
  profile: { name: string; cpf: string; phone: string };
  address: Address | null;
}

export interface Order extends OrderSummary {
  items: OrderItem[];
}

export interface NewOrderItem {
  productId: number;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  size: string;
  priceCents: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Pick<Product, 'name' | 'description' | 'category' | 'size' | 'priceCents' | 'stock'>;

export interface ProductPage {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor.', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!res.ok) throw new ApiError(data.error ?? 'Erro inesperado.', res.status, data.fields);
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>('POST', '/api/auth/register', { name, email, password }),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/api/auth/login', { email, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  me: () => request<{ user: User }>('GET', '/api/me'),
  listOrders: (status?: OrderStatus) =>
    request<{ orders: OrderSummary[] }>('GET', '/api/orders' + (status ? `?status=${status}` : '')),
  getOrder: (id: string | number) => request<{ order: Order }>('GET', `/api/orders/${encodeURIComponent(id)}`),
  createOrder: (items: NewOrderItem[], addressUpdatedAt: string) =>
    request<{ order: Order }>('POST', '/api/orders', { items, confirmShipping: true, addressUpdatedAt }),
  getAccount: () => request<Account>('GET', '/api/account'),
  updateProfile: (p: { name: string; cpf: string; phone: string }) => request<Account>('PUT', '/api/account/profile', p),
  updateAddress: (a: AddressInput) => request<Account>('PUT', '/api/account/address', a),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('PUT', '/api/account/password', { currentPassword, newPassword }),
  /** query: parâmetros q, categoria, tamanho, precoMin, precoMax, ordem, pagina. */
  listProducts: (query: URLSearchParams) => request<ProductPage>('GET', `/api/products?${query.toString()}`),
  productFilters: () => request<{ categories: string[]; sizes: string[] }>('GET', '/api/products/filters'),
  getProduct: (id: string | number) => request<{ product: Product }>('GET', `/api/products/${encodeURIComponent(id)}`),
  createProduct: (p: ProductInput) => request<{ product: Product }>('POST', '/api/products', p),
  updateProduct: (id: number, p: ProductInput) => request<{ product: Product }>('PUT', `/api/products/${id}`, p),
  updateOrderStatus: (id: number, status: OrderStatus) =>
    request<{ order: Order }>('PATCH', `/api/orders/${id}/status`, { status }),
};
