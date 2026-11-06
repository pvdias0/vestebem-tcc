import type { Express, NextFunction, Request, Response } from 'express';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { SessionUser } from './orders.js';

export const PAGE_SIZE = 12;
const MAX_PRICE_CENTS = 100_000_000;
const MAX_STOCK = 1_000_000;

/** Minúsculas e sem acentos: "Coleção D'Água" → "colecao d'agua". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  size: string;
  priceCents: number;
  stock: number;
}

interface ProductRow {
  id: number;
  name: string;
  description: string;
  category: string;
  size: string;
  price_cents: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

export const toProduct = (r: ProductRow) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: r.category,
  size: r.size,
  priceCents: r.price_cents,
  stock: r.stock,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const PRODUCT_COLS = 'id, name, description, category, size, price_cents, stock, created_at, updated_at';

export function getProduct(db: DatabaseSync, id: number): ProductRow | undefined {
  return db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).get(id) as unknown as ProductRow | undefined;
}

/** Valida os dados de cadastro/edição. Retorna os dados normalizados ou erros por campo. */
export function validateProduct(raw: unknown): { data: ProductInput } | { fields: Record<string, string> } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = text(r.name);
  const description = typeof r.description === 'string' ? r.description.replace(/\r\n/g, '\n').trim() : '';
  const category = text(r.category).replace(/\s+/g, ' ');
  const size = text(r.size).replace(/\s+/g, ' ').toUpperCase();
  const fields: Record<string, string> = {};
  if (name.length < 1 || name.length > 120) fields.name = 'Informe o nome (até 120 caracteres).';
  if (description.length > 2000) fields.description = 'A descrição pode ter até 2000 caracteres.';
  if (category.length < 1 || category.length > 60) fields.category = 'Informe a categoria (até 60 caracteres).';
  if (size.length < 1 || size.length > 20) fields.size = 'Informe o tamanho (até 20 caracteres).';
  const price = r.priceCents;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > MAX_PRICE_CENTS)
    fields.priceCents = 'O preço deve ser um valor válido e não negativo.';
  const stock = r.stock;
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK)
    fields.stock = 'O estoque deve ser um número inteiro igual ou maior que zero.';
  if (Object.keys(fields).length) return { fields };
  return { data: { name, description, category, size, priceCents: price as number, stock: stock as number } };
}

export function insertProduct(db: DatabaseSync, p: ProductInput): number {
  const res = db
    .prepare(
      `INSERT INTO products (name, description, category, size, price_cents, stock, search_text, sort_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(p.name, p.description, p.category, p.size, p.priceCents, p.stock, normalize(`${p.name} ${p.description}`), normalize(p.name));
  return Number(res.lastInsertRowid);
}

function updateProduct(db: DatabaseSync, id: number, p: ProductInput): boolean {
  const res = db
    .prepare(
      `UPDATE products SET name = ?, description = ?, category = ?, size = ?, price_cents = ?, stock = ?,
         search_text = ?, sort_name = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      p.name, p.description, p.category, p.size, p.priceCents, p.stock,
      normalize(`${p.name} ${p.description}`), normalize(p.name), new Date().toISOString(), id,
    );
  return Number(res.changes) > 0;
}

const SORTS = {
  nome_asc: 'sort_name ASC, id ASC',
  nome_desc: 'sort_name DESC, id DESC',
  preco_asc: 'price_cents ASC, sort_name ASC, id ASC',
  preco_desc: 'price_cents DESC, sort_name ASC, id ASC',
} as const;
type SortKey = keyof typeof SORTS;

/** Converte "49,90" / "49.90" / "1.234,56" em centavos. */
export function parseMoney(input: string): number | null {
  let s = input.trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export interface ProductQuery {
  q: string;
  category: string;
  size: string;
  minCents: number | null;
  maxCents: number | null;
  sort: SortKey;
  page: number;
  pageSize: number;
}

/** Lê e valida os parâmetros da listagem. Parâmetros vazios são ignorados. */
export function parseProductQuery(query: Request['query']): { query: ProductQuery } | { error: string } {
  const get = (k: string) => {
    const v = query[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const q = get('q');
  if (q.length > 100) return { error: 'O termo de pesquisa pode ter até 100 caracteres.' };
  const min = get('precoMin');
  const max = get('precoMax');
  const minCents = min ? parseMoney(min) : null;
  const maxCents = max ? parseMoney(max) : null;
  if (min && minCents === null) return { error: 'Preço mínimo inválido.' };
  if (max && maxCents === null) return { error: 'Preço máximo inválido.' };
  if (minCents !== null && maxCents !== null && minCents > maxCents)
    return { error: 'O preço mínimo não pode ser maior que o preço máximo.' };
  const sortRaw = get('ordem') || 'nome_asc';
  if (!(sortRaw in SORTS)) return { error: 'Ordenação inválida.' };
  const pageRaw = get('pagina') || '1';
  if (!/^\d{1,6}$/.test(pageRaw) || Number(pageRaw) < 1) return { error: 'Página inválida.' };
  return {
    query: {
      q,
      category: get('categoria'),
      size: get('tamanho').toUpperCase(),
      minCents,
      maxCents,
      sort: sortRaw as SortKey,
      page: Number(pageRaw),
      pageSize: PAGE_SIZE,
    },
  };
}

/** Busca paginada somente-leitura; todos os critérios são combinados com AND. */
export function searchProducts(db: DatabaseSync, pq: ProductQuery) {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  if (pq.q) {
    // Cada palavra deve aparecer no nome ou na descrição. Valor sempre via parâmetro;
    // curingas do LIKE (% _ \) são escapados para serem tratados como texto comum.
    for (const word of normalize(pq.q).split(' ').filter(Boolean)) {
      where.push("search_text LIKE ? ESCAPE '\\'");
      params.push(`%${word.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
    }
  }
  if (pq.category) {
    where.push('category = ? COLLATE NOCASE');
    params.push(pq.category);
  }
  if (pq.size) {
    where.push('size = ? COLLATE NOCASE');
    params.push(pq.size);
  }
  if (pq.minCents !== null) {
    where.push('price_cents >= ?');
    params.push(pq.minCents);
  }
  if (pq.maxCents !== null) {
    where.push('price_cents <= ?');
    params.push(pq.maxCents);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM products ${whereSql}`).get(...params) as { n: number };
  const totalPages = Math.max(1, Math.ceil(total / pq.pageSize));
  const rows = db
    .prepare(`SELECT ${PRODUCT_COLS} FROM products ${whereSql} ORDER BY ${SORTS[pq.sort]} LIMIT ? OFFSET ?`)
    .all(...params, pq.pageSize, (pq.page - 1) * pq.pageSize) as unknown as ProductRow[];
  return { products: rows.map(toProduct), page: pq.page, pageSize: pq.pageSize, total, totalPages };
}

const user = (res: Response) => (res.locals as { user?: SessionUser }).user;

export function registerProductRoutes(app: Express, db: DatabaseSync) {
  const requireEmployee = (_req: Request, res: Response, next: NextFunction) => {
    const u = user(res);
    if (!u) {
      res.status(401).json({ error: 'Você precisa entrar para acessar esta página.' });
      return;
    }
    if (u.role !== 'employee') {
      res.status(403).json({ error: 'Somente funcionários podem cadastrar ou atualizar produtos.' });
      return;
    }
    next();
  };
  const parseId = (v: unknown) => (typeof v === 'string' && /^\d{1,12}$/.test(v) && Number(v) > 0 ? Number(v) : null);

  app.get('/api/products', (req, res) => {
    const parsed = parseProductQuery(req.query);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    res.json(searchProducts(db, parsed.query));
  });

  // Valores existentes para montar os filtros da interface.
  app.get('/api/products/filters', (_req, res) => {
    const categories = (db.prepare('SELECT DISTINCT category FROM products ORDER BY category COLLATE NOCASE').all() as unknown as { category: string }[]).map((r) => r.category);
    const sizes = (db.prepare('SELECT DISTINCT size FROM products ORDER BY size').all() as unknown as { size: string }[]).map((r) => r.size);
    res.json({ categories, sizes });
  });

  app.get('/api/products/:id', (req, res) => {
    const id = parseId(req.params.id);
    const row = id ? getProduct(db, id) : undefined;
    if (!row) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    res.json({ product: toProduct(row) });
  });

  app.post('/api/products', requireEmployee, (req, res) => {
    const v = validateProduct(req.body);
    if ('fields' in v) {
      res.status(400).json({ error: 'Verifique os campos informados.', fields: v.fields });
      return;
    }
    const id = insertProduct(db, v.data);
    res.status(201).json({ product: toProduct(getProduct(db, id)!) });
  });

  app.put('/api/products/:id', requireEmployee, (req, res) => {
    const id = parseId(req.params.id);
    const v = validateProduct(req.body);
    if ('fields' in v) {
      res.status(400).json({ error: 'Verifique os campos informados.', fields: v.fields });
      return;
    }
    if (!id || !updateProduct(db, id, v.data)) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    res.json({ product: toProduct(getProduct(db, id)!) });
  });
}
