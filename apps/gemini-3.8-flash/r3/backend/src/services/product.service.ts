import crypto from 'node:crypto';
import { db } from '../db/index.js';

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

export interface CreateProductInput {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  size?: string;
  price?: number;
  stock?: number;
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

interface ProductRow {
  id: string;
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    size: row.size,
    price: row.price,
    stock: row.stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProduct(input: CreateProductInput): Product {
  const name = (input.name || '').trim();
  const description = (input.description || '').trim();
  const category = (input.category || '').trim();
  const size = (input.size || '').trim();
  const price = Number(input.price);
  const stock = Number(input.stock);

  if (!name) {
    const error: any = new Error('O nome do produto é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (!description) {
    const error: any = new Error('A descrição do produto é obrigatória.');
    error.status = 400;
    throw error;
  }
  if (!category) {
    const error: any = new Error('A categoria do produto é obrigatória.');
    error.status = 400;
    throw error;
  }
  if (!size) {
    const error: any = new Error('O tamanho do produto é obrigatório.');
    error.status = 400;
    throw error;
  }
  if (isNaN(price) || price < 0) {
    const error: any = new Error('O preço não pode ser negativo.');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    const error: any = new Error('O estoque deve ser um número inteiro igual ou superior a zero.');
    error.status = 400;
    throw error;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO products (id, name, description, category, size, price, stock, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description, category, size, price, stock, now, now);

  return {
    id,
    name,
    description,
    category,
    size,
    price,
    stock,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProduct(id: string, input: UpdateProductInput): Product {
  const existingRow = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!existingRow) {
    const error: any = new Error('Produto não encontrado.');
    error.status = 404;
    throw error;
  }

  const name = input.name !== undefined ? input.name.trim() : existingRow.name;
  const description = input.description !== undefined ? input.description.trim() : existingRow.description;
  const category = input.category !== undefined ? input.category.trim() : existingRow.category;
  const size = input.size !== undefined ? input.size.trim() : existingRow.size;
  const price = input.price !== undefined ? Number(input.price) : existingRow.price;
  const stock = input.stock !== undefined ? Number(input.stock) : existingRow.stock;

  if (!name) {
    const error: any = new Error('O nome do produto não pode ser vazio.');
    error.status = 400;
    throw error;
  }
  if (!description) {
    const error: any = new Error('A descrição do produto não pode ser vazia.');
    error.status = 400;
    throw error;
  }
  if (!category) {
    const error: any = new Error('A categoria do produto não pode ser vazia.');
    error.status = 400;
    throw error;
  }
  if (!size) {
    const error: any = new Error('O tamanho do produto não pode ser vazio.');
    error.status = 400;
    throw error;
  }
  if (isNaN(price) || price < 0) {
    const error: any = new Error('O preço não pode ser negativo.');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    const error: any = new Error('O estoque deve ser um número inteiro igual ou superior a zero.');
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products
    SET name = ?, description = ?, category = ?, size = ?, price = ?, stock = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, category, size, price, stock, now, id);

  return {
    id,
    name,
    description,
    category,
    size,
    price,
    stock,
    createdAt: existingRow.created_at,
    updatedAt: now,
  };
}

export function getProductById(id: string): Product | null {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) {
    return null;
  }
  return rowToProduct(row);
}

export function listProducts(params: ProductFilterParams): PaginatedProducts {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 12);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const queryParams: any[] = [];

  // Search filter (text in name or description)
  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    whereClauses.push('(name LIKE ? OR description LIKE ?)');
    queryParams.push(term, term);
  }

  // Category filter
  if (params.category && params.category.trim()) {
    whereClauses.push('category = ?');
    queryParams.push(params.category.trim());
  }

  // Size filter
  if (params.size && params.size.trim()) {
    whereClauses.push('size = ?');
    queryParams.push(params.size.trim());
  }

  // Min price
  if (params.minPrice !== undefined && !isNaN(Number(params.minPrice))) {
    whereClauses.push('price >= ?');
    queryParams.push(Number(params.minPrice));
  }

  // Max price
  if (params.maxPrice !== undefined && !isNaN(Number(params.maxPrice))) {
    whereClauses.push('price <= ?');
    queryParams.push(Number(params.maxPrice));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total matching
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM products ${whereSql}`).get(...queryParams) as { count: number };
  const total = countRow ? countRow.count : 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Sorting
  let sortField = 'name';
  if (params.sortBy === 'price') {
    sortField = 'price';
  } else if (params.sortBy === 'createdAt') {
    sortField = 'created_at';
  }

  const sortOrder = params.sortOrder === 'desc' ? 'DESC' : 'ASC';

  // Fetch paginated products
  const selectSql = `
    SELECT * FROM products
    ${whereSql}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `;
  const productRows = db.prepare(selectSql).all(...queryParams, limit, offset) as unknown as ProductRow[];

  // Fetch available distinct categories and sizes for filter options
  const catRows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all() as unknown as { category: string }[];
  const sizeRows = db.prepare('SELECT DISTINCT size FROM products ORDER BY size ASC').all() as unknown as { size: string }[];

  return {
    products: productRows.map(rowToProduct),
    total,
    page,
    totalPages,
    limit,
    categories: catRows.map(c => c.category),
    sizes: sizeRows.map(s => s.size),
  };
}
