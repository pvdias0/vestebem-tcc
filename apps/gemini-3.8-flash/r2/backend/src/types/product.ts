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
