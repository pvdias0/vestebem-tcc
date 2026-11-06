import { Request, Response } from 'express';
import { getDatabase } from '../db/index';
import { ProductRecord } from '../types';

export function listProducts(req: Request, res: Response): void {
  try {
    const db = getDatabase();

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12);
    const offset = (page - 1) * limit;

    const search = req.query.search ? String(req.query.search).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : '';
    const size = req.query.size ? String(req.query.size).trim() : '';
    const minPriceRaw = req.query.minPrice;
    const maxPriceRaw = req.query.maxPrice;
    const sortBy = String(req.query.sortBy || 'name').toLowerCase();
    const orderDirection = String(req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Busca por termo presente no nome ou na descrição
    if (search.length > 0) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filtro por categoria
    if (category.length > 0) {
      conditions.push('category = ?');
      params.push(category);
    }

    // Filtro por tamanho
    if (size.length > 0) {
      conditions.push('size = ?');
      params.push(size);
    }

    // Filtro por preço mínimo
    if (minPriceRaw !== undefined && minPriceRaw !== '') {
      const minPrice = parseFloat(String(minPriceRaw));
      if (!isNaN(minPrice)) {
        conditions.push('price >= ?');
        params.push(minPrice);
      }
    }

    // Filtro por preço máximo
    if (maxPriceRaw !== undefined && maxPriceRaw !== '') {
      const maxPrice = parseFloat(String(maxPriceRaw));
      if (!isNaN(maxPrice)) {
        conditions.push('price <= ?');
        params.push(maxPrice);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Ordenação por nome ou preço
    let orderColumn = 'name';
    if (sortBy === 'price') {
      orderColumn = 'price';
    } else if (sortBy === 'id') {
      orderColumn = 'id';
    }

    // Contagem total para paginação
    const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as unknown as { total: number };
    const totalItems = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Busca paginada
    const listSql = `
      SELECT id, name, description, category, size, price, stock_quantity, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const products = db.prepare(listSql).all(...params, limit, offset) as unknown as ProductRecord[];

    res.status(200).json({
      products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro interno ao consultar catálogo de produtos.' });
  }
}

export function getProductById(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Identificador de produto inválido.' });
      return;
    }

    const db = getDatabase();
    const product = db.prepare(`
      SELECT id, name, description, category, size, price, stock_quantity, created_at, updated_at
      FROM products
      WHERE id = ?
    `).get(id) as unknown as ProductRecord | undefined;

    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error('Erro ao buscar produto por ID:', error);
    res.status(500).json({ error: 'Erro interno ao obter dados do produto.' });
  }
}

export function getCategoriesAndSizes(_req: Request, res: Response): void {
  try {
    const db = getDatabase();
    const categoriesRows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all() as unknown as { category: string }[];
    const sizesRows = db.prepare('SELECT DISTINCT size FROM products ORDER BY size ASC').all() as unknown as { size: string }[];

    res.status(200).json({
      categories: categoriesRows.map(r => r.category),
      sizes: sizesRows.map(r => r.size)
    });
  } catch (error) {
    console.error('Erro ao obter categorias e tamanhos:', error);
    res.status(500).json({ error: 'Erro interno ao buscar filtros.' });
  }
}

export function createProduct(req: Request, res: Response): void {
  try {
    if (!req.user || req.user.role !== 'employee') {
      res.status(403).json({ error: 'Apenas funcionários podem cadastrar produtos.' });
      return;
    }

    const { name, description, category, size, price, stock_quantity } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'O nome do produto é obrigatório.' });
      return;
    }

    if (description === undefined || typeof description !== 'string') {
      res.status(400).json({ error: 'A descrição do produto é obrigatória.' });
      return;
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      res.status(400).json({ error: 'A categoria do produto é obrigatória.' });
      return;
    }

    if (!size || typeof size !== 'string' || size.trim().length === 0) {
      res.status(400).json({ error: 'O tamanho do produto é obrigatório.' });
      return;
    }

    const parsedPrice = parseFloat(String(price));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ error: 'O preço do produto não pode ser negativo.' });
      return;
    }

    const parsedStock = parseInt(String(stock_quantity !== undefined ? stock_quantity : '0'), 10);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      res.status(400).json({ error: 'O estoque deve ser um número inteiro igual ou superior a zero.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO products (name, description, category, size, price, stock_quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      description.trim(),
      category.trim(),
      size.trim().toUpperCase(),
      Number(parsedPrice.toFixed(2)),
      parsedStock
    );

    const newId = Number(result.lastInsertRowid);
    const createdProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(newId) as unknown as ProductRecord;

    res.status(201).json({
      message: 'Produto cadastrado com sucesso!',
      product: createdProduct
    });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ error: 'Erro interno ao cadastrar produto.' });
  }
}

export function updateProduct(req: Request, res: Response): void {
  try {
    if (!req.user || req.user.role !== 'employee') {
      res.status(403).json({ error: 'Apenas funcionários podem atualizar produtos.' });
      return;
    }

    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Identificador de produto inválido.' });
      return;
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as unknown as ProductRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const { name, description, category, size, price, stock_quantity } = req.body;

    const newName = name !== undefined ? String(name).trim() : existing.name;
    const newDescription = description !== undefined ? String(description).trim() : existing.description;
    const newCategory = category !== undefined ? String(category).trim() : existing.category;
    const newSize = size !== undefined ? String(size).trim().toUpperCase() : existing.size;

    if (!newName) {
      res.status(400).json({ error: 'O nome do produto não pode ser vazio.' });
      return;
    }

    if (!newCategory) {
      res.status(400).json({ error: 'A categoria do produto não pode ser vazia.' });
      return;
    }

    if (!newSize) {
      res.status(400).json({ error: 'O tamanho do produto não pode ser vazio.' });
      return;
    }

    let newPrice = existing.price;
    if (price !== undefined) {
      const parsedPrice = parseFloat(String(price));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ error: 'O preço do produto não pode ser negativo.' });
        return;
      }
      newPrice = Number(parsedPrice.toFixed(2));
    }

    let newStock = existing.stock_quantity;
    if (stock_quantity !== undefined) {
      const parsedStock = parseInt(String(stock_quantity), 10);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        res.status(400).json({ error: 'O estoque deve ser um número inteiro igual ou superior a zero.' });
        return;
      }
      newStock = parsedStock;
    }

    db.prepare(`
      UPDATE products
      SET name = ?, description = ?, category = ?, size = ?, price = ?, stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newName, newDescription, newCategory, newSize, newPrice, newStock, id);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as unknown as ProductRecord;

    res.status(200).json({
      message: 'Produto atualizado com sucesso!',
      product: updated
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar produto.' });
  }
}
