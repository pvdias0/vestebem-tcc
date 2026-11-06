export type Role = "cliente" | "funcionario";
export interface User { id: number; name: string; email: string; role: Role }

export type OrderStatus = "recebido" | "em_preparacao" | "enviado" | "cancelado";
export const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: "Recebido", em_preparacao: "Em preparação", enviado: "Enviado", cancelado: "Cancelado",
};
export const ORDER_STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

export interface OrderSummary {
  id: number; status: OrderStatus; totalCents: number; createdAt: string; updatedAt: string;
  itemCount: number; customer: { id: number; name: string; email: string };
}
export interface OrderItem { productId: number | null; description: string; quantity: number; unitPriceCents: number; subtotalCents: number }
export interface Address {
  recipient: string; cep: string; street: string; number: string; complement: string | null;
  district: string; city: string; state: string;
}
export interface Shipping extends Address { phone: string }
export interface Order extends OrderSummary { items: OrderItem[]; shipping: Shipping | null }
export interface AccountUser extends User { cpf: string | null; phone: string | null }
export interface Account { user: AccountUser; address: Address | null }
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
export interface NewItem { productId: number; quantity: number }

export interface Product {
  id: number; name: string; description: string; category: string; size: string;
  priceCents: number; stock: number; createdAt: string; updatedAt: string;
}
export type ProductInput = Pick<Product, "name" | "description" | "category" | "size" | "priceCents" | "stock">;
export interface ProductPage { products: Product[]; page: number; pageSize: number; total: number; totalPages: number }
export interface ProductFilters { categories: string[]; sizes: string[] }

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  errors: string[];
  constructor(status: number, message: string, fields: Record<string, string> = {}, errors: string[] = []) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.errors = errors;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro inesperado.', data.fields, data.errors);
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>('POST', '/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    request<{ user: User }>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  account: () => request<Account>("GET", "/account"),
  updateProfile: (p: { name: string; cpf: string; phone: string }) => request<Account>("PUT", "/account/profile", p),
  updateAddress: (a: Address) => request<Account>("PUT", "/account/address", a),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("PUT", "/account/password", { currentPassword, newPassword }),
  listOrders: () => request<{ orders: OrderSummary[] }>("GET", "/orders"),
  getOrder: (id: string) => request<{ order: Order }>("GET", `/orders/${encodeURIComponent(id)}`),
  createOrder: (items: NewItem[], confirmShipping: boolean) =>
    request<{ order: Order }>("POST", "/orders", { items, confirmShipping }),
  listProducts: (params: URLSearchParams) => request<ProductPage>("GET", `/products?${params.toString()}`),
  productFilters: () => request<ProductFilters>("GET", "/products/filters"),
  getProduct: (id: string) => request<{ product: Product }>("GET", `/products/${encodeURIComponent(id)}`),
  createProduct: (p: ProductInput) => request<{ product: Product }>("POST", "/products", p),
  updateProduct: (id: number, p: ProductInput) => request<{ product: Product }>("PUT", `/products/${id}`, p),
  setStatus: (id: number, status: OrderStatus) =>
    request<{ order: Order }>("PATCH", `/orders/${id}/status`, { status }),
};
