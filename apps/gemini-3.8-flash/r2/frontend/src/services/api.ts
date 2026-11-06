import {
  User,
  Address,
  UpdateProfileInput,
  UpdateAddressInput,
  ChangePasswordInput,
  Order,
  OrderStatus,
  CreateOrderItemInput,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductQueryParams,
  PaginatedProducts,
} from '../types';

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  };

  const response = await fetch(endpoint, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || 'Ocorreu um erro na requisição.';
    throw new ApiError(errorMsg, response.status);
  }

  return data as T;
}

export const api = {
  // Auth & Profile
  async register(name: string, email: string, password: string): Promise<{ message: string; user: User }> {
    return request<{ message: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login(email: string, password: string): Promise<{ message: string; user: User }> {
    return request<{ message: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me', {
      method: 'GET',
    });
  },

  async updateProfile(data: UpdateProfileInput): Promise<{ message: string; user: User }> {
    return request<{ message: string; user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateAddress(data: UpdateAddressInput): Promise<{ message: string; address: Address }> {
    return request<{ message: string; address: Address }>('/api/auth/address', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: ChangePasswordInput): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Products
  async getProducts(params: ProductQueryParams = {}): Promise<PaginatedProducts> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.category) searchParams.append('category', params.category);
    if (params.size) searchParams.append('size', params.size);
    if (params.minPrice !== undefined && params.minPrice !== null) searchParams.append('minPrice', params.minPrice.toString());
    if (params.maxPrice !== undefined && params.maxPrice !== null) searchParams.append('maxPrice', params.maxPrice.toString());
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    const endpoint = `/api/products${query ? `?${query}` : ''}`;
    return request<PaginatedProducts>(endpoint, { method: 'GET' });
  },

  async getProductById(id: number): Promise<{ product: Product }> {
    return request<{ product: Product }>(`/api/products/${id}`, {
      method: 'GET',
    });
  },

  async getProductFilters(): Promise<{ categories: string[]; sizes: string[] }> {
    return request<{ categories: string[]; sizes: string[] }>('/api/products/filters', {
      method: 'GET',
    });
  },

  async createProduct(data: CreateProductInput): Promise<{ message: string; product: Product }> {
    return request<{ message: string; product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProduct(id: number, data: UpdateProductInput): Promise<{ message: string; product: Product }> {
    return request<{ message: string; product: Product }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Orders
  async createOrder(items: CreateOrderItemInput[], confirmDelivery: boolean): Promise<{ message: string; order: Order }> {
    return request<{ message: string; order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, confirmDelivery }),
    });
  },

  async getMyOrders(): Promise<{ orders: Order[] }> {
    return request<{ orders: Order[] }>('/api/orders/my', {
      method: 'GET',
    });
  },

  async getAllOrders(): Promise<{ orders: Order[] }> {
    return request<{ orders: Order[] }>('/api/orders/all', {
      method: 'GET',
    });
  },

  async getOrderById(orderId: number): Promise<{ order: Order }> {
    return request<{ order: Order }>(`/api/orders/${orderId}`, {
      method: 'GET',
    });
  },

  async updateOrderStatus(orderId: number, status: OrderStatus): Promise<{ message: string; order: Order }> {
    return request<{ message: string; order: Order }>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
