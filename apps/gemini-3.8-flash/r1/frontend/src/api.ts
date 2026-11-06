import { Order, OrderStatus, Product, ProductsResponse, ProductFiltersMeta, User } from './types';

const API_AUTH = '/api/auth';
const API_ORDERS = '/api/orders';
const API_PRODUCTS = '/api/products';

export async function apiRegister(name: string, email: string, password: string) {
  const res = await fetch(`${API_AUTH}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao realizar cadastro.');
  }
  return data;
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_AUTH}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao realizar login.');
  }
  return data;
}

export async function apiLogout() {
  const res = await fetch(`${API_AUTH}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao encerrar sessão.');
  }
  return data;
}

export async function apiGetProfile(): Promise<User | null> {
  const res = await fetch(`${API_AUTH}/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });

  if (res.status === 401) {
    return null;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao carregar perfil.');
  }
  return data.user;
}

export async function apiUpdatePersonalInfo(personalData: { name: string; cpf?: string; phone?: string }): Promise<User> {
  const res = await fetch(`${API_AUTH}/profile/personal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(personalData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao atualizar dados pessoais.');
  }
  return data.user;
}

export async function apiUpdateAddress(addressData: {
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}): Promise<User> {
  const res = await fetch(`${API_AUTH}/profile/address`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(addressData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao atualizar endereço de entrega.');
  }
  return data.user;
}

export async function apiChangePassword(passwordData: { currentPassword: string; newPassword: string }): Promise<void> {
  const res = await fetch(`${API_AUTH}/profile/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(passwordData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao alterar senha.');
  }
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  size?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  sortBy?: 'name' | 'price' | 'id';
  order?: 'asc' | 'desc';
}

export async function apiGetProducts(params: ProductQueryParams = {}): Promise<ProductsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.size) query.set('size', params.size);
  if (params.minPrice !== undefined && params.minPrice !== '') query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined && params.maxPrice !== '') query.set('maxPrice', String(params.maxPrice));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.order) query.set('order', params.order);

  const res = await fetch(`${API_PRODUCTS}?${query.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao buscar catálogo de produtos.');
  }
  return data;
}

export async function apiGetProductById(id: number): Promise<Product> {
  const res = await fetch(`${API_PRODUCTS}/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao carregar detalhes do produto.');
  }
  return data.product;
}

export async function apiGetProductFilters(): Promise<ProductFiltersMeta> {
  const res = await fetch(`${API_PRODUCTS}/meta/filters`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao carregar opções de filtros.');
  }
  return data;
}

export async function apiCreateProduct(productData: {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock_quantity: number;
}): Promise<Product> {
  const res = await fetch(API_PRODUCTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(productData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao cadastrar produto.');
  }
  return data.product;
}

export async function apiUpdateProduct(id: number, productData: {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock_quantity: number;
}): Promise<Product> {
  const res = await fetch(`${API_PRODUCTS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(productData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao atualizar produto.');
  }
  return data.product;
}

export async function apiCreateOrder(
  items: { product_id: number; quantity: number }[],
  confirm_address: boolean
): Promise<Order> {
  const res = await fetch(API_ORDERS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ items, confirm_address })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar pedido.');
  }
  return data.order;
}

export async function apiGetOrders(): Promise<Order[]> {
  const res = await fetch(API_ORDERS, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao listar pedidos.');
  }
  return data.orders || [];
}

export async function apiGetOrderById(id: number): Promise<Order> {
  const res = await fetch(`${API_ORDERS}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao buscar detalhes do pedido.');
  }
  return data.order;
}

export async function apiUpdateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
  const res = await fetch(`${API_ORDERS}/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ status })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao atualizar status do pedido.');
  }
  return data.order;
}
