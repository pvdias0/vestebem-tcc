import { db } from '../db/connection.js';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductQueryParams,
  PaginatedProducts,
} from '../types/product.js';

export class ProductService {
  static getProductById(id: number): Product | undefined {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    return stmt.get(id) as Product | undefined;
  }

  static listProducts(params: ProductQueryParams): PaginatedProducts {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 12);
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const sqlParams: any[] = [];

    // Busca textual no nome ou descrição com suporte a apóstrofos e caracteres especiais
    if (params.search && params.search.trim()) {
      whereClauses.push('(name LIKE ? OR description LIKE ?)');
      const searchTerm = `%${params.search.trim()}%`;
      sqlParams.push(searchTerm, searchTerm);
    }

    // Filtro de categoria
    if (params.category && params.category.trim()) {
      whereClauses.push('category = ?');
      sqlParams.push(params.category.trim());
    }

    // Filtro de tamanho
    if (params.size && params.size.trim()) {
      whereClauses.push('size = ?');
      sqlParams.push(params.size.trim());
    }

    // Filtro de preço mínimo
    if (params.minPrice !== undefined && !isNaN(params.minPrice)) {
      whereClauses.push('price >= ?');
      sqlParams.push(Number(params.minPrice));
    }

    // Filtro de preço máximo
    if (params.maxPrice !== undefined && !isNaN(params.maxPrice)) {
      whereClauses.push('price <= ?');
      sqlParams.push(Number(params.maxPrice));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Ordenação
    let sortColumn = 'id';
    if (params.sortBy === 'name') {
      sortColumn = 'name';
    } else if (params.sortBy === 'price') {
      sortColumn = 'price';
    }

    const sortDirection = params.sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Contagem total
    const countSql = `SELECT COUNT(*) as total FROM products ${whereSql}`;
    const totalRow = db.prepare(countSql).get(...sqlParams) as { total: number };
    const total = totalRow.total;

    // Busca paginada
    const selectSql = `
      SELECT * FROM products
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const products = db.prepare(selectSql).all(...sqlParams, limit, offset) as Product[];

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static getFilterOptions(): { categories: string[]; sizes: string[] } {
    const categoriesRows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all() as Array<{ category: string }>;
    const sizesRows = db.prepare('SELECT DISTINCT size FROM products ORDER BY size ASC').all() as Array<{ size: string }>;

    return {
      categories: categoriesRows.map((r) => r.category),
      sizes: sizesRows.map((r) => r.size),
    };
  }

  static createProduct(input: CreateProductInput): Product {
    const name = input.name.trim();
    const description = input.description.trim();
    const category = input.category.trim();
    const size = input.size.trim();
    const price = Number(input.price);
    const stock_quantity = Math.floor(Number(input.stock_quantity));

    if (!name) {
      const err = new Error('O nome do produto é obrigatório.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!description) {
      const err = new Error('A descrição do produto é obrigatória.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!category) {
      const err = new Error('A categoria do produto é obrigatória.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!size) {
      const err = new Error('O tamanho do produto é obrigatório.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (isNaN(price) || price < 0) {
      const err = new Error('O preço não pode ser negativo.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      const err = new Error('O estoque deve ser um número inteiro igual ou superior a zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const stmt = db.prepare(`
      INSERT INTO products (name, description, category, size, price, stock_quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, description, category, size, price, stock_quantity);
    return this.getProductById(Number(result.lastInsertRowid))!;
  }

  static updateProduct(id: number, input: UpdateProductInput): Product {
    const existing = this.getProductById(id);
    if (!existing) {
      const err = new Error('Produto não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const description = input.description !== undefined ? input.description.trim() : existing.description;
    const category = input.category !== undefined ? input.category.trim() : existing.category;
    const size = input.size !== undefined ? input.size.trim() : existing.size;
    const price = input.price !== undefined ? Number(input.price) : existing.price;
    const stock_quantity = input.stock_quantity !== undefined ? Math.floor(Number(input.stock_quantity)) : existing.stock_quantity;

    if (!name) {
      const err = new Error('O nome do produto não pode ficar vazio.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!description) {
      const err = new Error('A descrição do produto não pode ficar vazia.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!category) {
      const err = new Error('A categoria não pode ficar vazia.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!size) {
      const err = new Error('O tamanho não pode ficar vazio.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (isNaN(price) || price < 0) {
      const err = new Error('O preço não pode ser negativo.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      const err = new Error('O estoque deve ser um número inteiro igual ou superior a zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const stmt = db.prepare(`
      UPDATE products
      SET name = ?, description = ?, category = ?, size = ?, price = ?, stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name, description, category, size, price, stock_quantity, id);
    return this.getProductById(id)!;
  }
}
