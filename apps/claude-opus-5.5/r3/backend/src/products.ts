import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { PublicUser } from './app.ts';

export const PAGE_SIZE = 12;
export const PRODUCT_LIMITS = { maxPriceCents: 10_000_000, maxStock: 1_000_000 } as const;

/** Minúsculas e sem acentos: usado para pesquisa e ordenação ("agua" encontra "Água"). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Registra a função SQL fold(); deve ser chamada em toda conexão. */
export function registerSqlFunctions(db: DatabaseSync) {
  db.function('fold', { deterministic: true }, (v) => (typeof v === 'string' ? fold(v) : v));
}

export interface ProductInput {
  name: string; description: string; category: string; size: string; priceCents: number; stock: number;
}

export function validateProduct(body: unknown): { product: ProductInput } | { fields: Record<string, string> } {
  const o = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const p = {
    name: str(o.name), description: str(o.description), category: str(o.category), size: str(o.size),
    priceCents: o.priceCents as number, stock: o.stock as number,
  };
  const fields: Record<string, string> = {};
  if (p.name.length < 1 || p.name.length > 120) fields.name = 'Informe o nome (até 120 caracteres).';
  if (p.description.length > 2000) fields.description = 'A descrição pode ter até 2000 caracteres.';
  if (p.category.length < 1 || p.category.length > 60) fields.category = 'Informe a categoria (até 60 caracteres).';
  if (p.size.length < 1 || p.size.length > 20) fields.size = 'Informe o tamanho (até 20 caracteres).';
  if (typeof p.priceCents !== 'number' || !Number.isInteger(p.priceCents) || p.priceCents < 0
    || p.priceCents > PRODUCT_LIMITS.maxPriceCents)
    fields.priceCents = 'O preço não pode ser negativo (máximo R$ 100.000,00).';
  if (typeof p.stock !== 'number' || !Number.isInteger(p.stock) || p.stock < 0 || p.stock > PRODUCT_LIMITS.maxStock)
    fields.stock = 'O estoque deve ser um número inteiro igual ou maior que zero.';
  return Object.keys(fields).length ? { fields } : { product: p };
}

export function toProduct(r: Record<string, unknown>) {
  return {
    id: Number(r.id), name: String(r.name), description: String(r.description), category: String(r.category),
    size: String(r.size), priceCents: Number(r.price_cents), stock: Number(r.stock),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

/** Converte "49.90" / "49,90" em centavos. undefined = vazio; null = inválido. */
function parsePriceParam(v: unknown): number | undefined | null {
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

const one = (v: unknown) => (typeof v === 'string' ? v : undefined);

export function productsRouter(db: DatabaseSync, requireAuth: (req: Request, res: Response, next: NextFunction) => void) {
  const router = express.Router();
  const getById = db.prepare('SELECT * FROM products WHERE id = ?');

  const requireStaff = (_req: Request, res: Response, next: NextFunction) => {
    if ((res.locals.user as PublicUser).role !== 'funcionario') {
      res.status(403).json({ error: 'Somente funcionários podem cadastrar ou alterar produtos.' });
      return;
    }
    next();
  };

  // Listagem pública: pesquisa + filtros combinados (AND) + ordenação + paginação. Somente leitura.
  router.get('/', (req, res) => {
    const q = (one(req.query.q) ?? '').trim();
    const category = (one(req.query.category) ?? '').trim();
    const size = (one(req.query.size) ?? '').trim();
    const minPrice = parsePriceParam(req.query.minPrice);
    const maxPrice = parsePriceParam(req.query.maxPrice);
    const sort = one(req.query.sort) ?? 'name';
    const order = one(req.query.order) ?? 'asc';
    const pageText = one(req.query.page) ?? '1';

    const errors: string[] = [];
    if (q.length > 100) errors.push('O termo de pesquisa pode ter até 100 caracteres.');
    if (minPrice === null) errors.push('Preço mínimo inválido.');
    if (maxPrice === null) errors.push('Preço máximo inválido.');
    if (typeof minPrice === 'number' && typeof maxPrice === 'number' && minPrice > maxPrice)
      errors.push('O preço mínimo não pode ser maior que o máximo.');
    if (sort !== 'name' && sort !== 'price') errors.push('Ordenação inválida.');
    if (order !== 'asc' && order !== 'desc') errors.push('Direção de ordenação inválida.');
    if (!/^\d{1,6}$/.test(pageText) || Number(pageText) < 1) errors.push('Página inválida.');
    if (errors.length) { res.status(400).json({ error: errors[0], errors }); return; }

    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q) {
      // Termo sempre vinculado como parâmetro; % _ \ são escapados para serem literais.
      const like = `%${fold(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push("(fold(name) LIKE ? ESCAPE '\\' OR fold(description) LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    if (category) { where.push('category = ?'); params.push(category); }
    if (size) { where.push('size = ?'); params.push(size); }
    if (typeof minPrice === 'number') { where.push('price_cents >= ?'); params.push(minPrice); }
    if (typeof maxPrice === 'number') { where.push('price_cents <= ?'); params.push(maxPrice); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dir = order === 'desc' ? 'DESC' : 'ASC';
    const orderSql = sort === 'price' ? `price_cents ${dir}, fold(name) ASC, id ASC` : `fold(name) ${dir}, id ${dir}`;

    const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM products ${whereSql}`).get(...params)?.n ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Number(pageText);
    const rows = db.prepare(`SELECT * FROM products ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
      .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    res.json({ products: rows.map(toProduct), page, pageSize: PAGE_SIZE, total, totalPages });
  });

  router.get('/filters', (_req, res) => {
    const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY fold(category)').all()
      .map((r) => String(r.category));
    const sizes = db.prepare('SELECT DISTINCT size FROM products').all().map((r) => String(r.size));
    const priceRange = db.prepare('SELECT MIN(price_cents) AS min, MAX(price_cents) AS max FROM products').get();
    res.json({ categories, sizes: sortSizes(sizes), minPriceCents: priceRange?.min ?? null, maxPriceCents: priceRange?.max ?? null });
  });

  router.get('/:id', (req, res) => {
    const row = /^\d{1,15}$/.test(String(req.params.id)) ? getById.get(Number(String(req.params.id))) : undefined;
    if (!row) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    res.json({ product: toProduct(row) });
  });

  router.post('/', requireAuth, requireStaff, (req, res) => {
    const v = validateProduct(req.body);
    if ('fields' in v) { res.status(400).json({ error: 'Verifique os dados do produto.', fields: v.fields }); return; }
    const p = v.product;
    const id = Number(db.prepare(`INSERT INTO products (name, description, category, size, price_cents, stock)
      VALUES (?, ?, ?, ?, ?, ?)`).run(p.name, p.description, p.category, p.size, p.priceCents, p.stock).lastInsertRowid);
    res.status(201).json({ product: toProduct(getById.get(id)!) });
  });

  router.put('/:id', requireAuth, requireStaff, (req, res) => {
    const row = /^\d{1,15}$/.test(String(req.params.id)) ? getById.get(Number(String(req.params.id))) : undefined;
    if (!row) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    const v = validateProduct(req.body);
    if ('fields' in v) { res.status(400).json({ error: 'Verifique os dados do produto.', fields: v.fields }); return; }
    const p = v.product;
    db.prepare(`UPDATE products SET name = ?, description = ?, category = ?, size = ?, price_cents = ?, stock = ?,
      updated_at = ? WHERE id = ?`)
      .run(p.name, p.description, p.category, p.size, p.priceCents, p.stock, new Date().toISOString(), Number(row.id));
    res.json({ product: toProduct(getById.get(Number(row.id))!) });
  });

  return router;
}

const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];
/** Ordena tamanhos: letras na ordem usual, depois números, depois o resto (ex.: "Único"). */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase());
    if (i >= 0) return [0, i] as const;
    if (/^\d+$/.test(s)) return [1, Number(s)] as const;
    return [2, 0] as const;
  };
  return [...sizes].sort((a, b) => {
    const [ga, va] = rank(a); const [gb, vb] = rank(b);
    return ga - gb || va - vb || a.localeCompare(b, 'pt-BR');
  });
}
