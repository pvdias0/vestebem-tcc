export type UserRole = 'customer' | 'employee';
export type OrderStatus = 'recebido' | 'em preparação' | 'enviado' | 'cancelado';

export interface UserAddress {
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cpf: string | null;
  phone: string | null;
  address: UserAddress | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
  error?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilterParams {
  search?: string;
  category?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  categories: string[];
  sizes: string[];
}

export interface CreateProductPayload {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock: number;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  category?: string;
  size?: string;
  price?: number;
  stock?: number;
}

export interface CreateOrderItemPayload {
  productId: string;
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

export interface UpdateProfilePayload {
  name?: string;
  cpf?: string;
  phone?: string;
}

export interface UpdateAddressPayload {
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('vestebem_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Ocorreu um erro na requisição.');
  }

  return data;
}

export const api = {
  // Auth & Profile
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (res.token) {
      localStorage.setItem('vestebem_token', res.token);
    }
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      localStorage.setItem('vestebem_token', res.token);
    }
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me', {
      method: 'GET',
    });
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<{ user: User; message: string }> {
    return request<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateAddress(payload: UpdateAddressPayload): Promise<{ user: User; message: string }> {
    return request<{ user: User; message: string }>('/api/auth/address', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      localStorage.removeItem('vestebem_token');
    }
  },

  // Produtos
  async getProducts(params?: ProductFilterParams): Promise<PaginatedProducts> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.set('search', params.search);
      if (params.category) query.set('category', params.category);
      if (params.size) query.set('size', params.size);
      if (params.minPrice !== undefined) query.set('minPrice', String(params.minPrice));
      if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice));
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.page !== undefined) query.set('page', String(params.page));
      if (params.limit !== undefined) query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    const endpoint = `/api/products${qs ? `?${qs}` : ''}`;
    return request<PaginatedProducts>(endpoint, { method: 'GET' });
  },

  async getProductById(id: string): Promise<{ product: Product }> {
    return request<{ product: Product }>(`/api/products/${id}`, { method: 'GET' });
  },

  async createProduct(payload: CreateProductPayload): Promise<{ product: Product; message: string }> {
    return request<{ product: Product; message: string }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<{ product: Product; message: string }> {
    return request<{ product: Product; message: string }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Pedidos
  async createOrder(items: CreateOrderItemPayload[], confirmShipping = true): Promise<{ order: Order; message: string }> {
    return request<{ order: Order; message: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, confirmShipping }),
    });
  },

  async getMyOrders(): Promise<{ orders: Order[] }> {
    return request<{ orders: Order[] }>('/api/orders/my', {
      method: 'GET',
    });
  },

  async getAllOrders(): Promise<{ orders: Order[] }> {
    return request<{ orders: Order[] }>('/api/orders', {
      method: 'GET',
    });
  },

  async getOrderById(orderId: string): Promise<{ order: Order }> {
    return request<{ order: Order }>(`/api/orders/${orderId}`, {
      method: 'GET',
    });
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<{ order: Order; message: string }> {
    return request<{ order: Order; message: string }>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
