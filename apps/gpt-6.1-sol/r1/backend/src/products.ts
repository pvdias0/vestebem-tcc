import { Router, type Request } from 'express';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

export const productSelect = 'SELECT id, name, description, category, size, price_cents AS priceCents, stock FROM products';
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
export function productsRouter(db: DatabaseSync, account: (req: Request) => { role: string } | undefined) {
  db.function('search_text', { deterministic: true }, value => fold(String(value ?? '')));
  const router = Router();
  router.get('/', (req, res) => {
    const params = req.query;
    const allowed = ['q', 'category', 'size', 'minPriceCents', 'maxPriceCents', 'sort', 'page'];
    if (Object.entries(params).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string' || value.length > 200)) { res.status(400).json({ message: 'Parâmetros de consulta inválidos.' }); return; }
    const text = (key: string) => (params[key] as string | undefined)?.trim() ?? '';
    const integer = (key: string, fallback: number) => text(key) === '' ? fallback : /^\d+$/.test(text(key)) ? Number(text(key)) : NaN;
    const page = integer('page', 1);
    const min = integer('minPriceCents', 0);
    const max = integer('maxPriceCents', 100000000);
    const sort = text('sort') || 'name_asc';
    const ordering: Record<string, string> = { name_asc: 'search_text(name) ASC, id ASC', name_desc: 'search_text(name) DESC, id DESC', price_asc: 'price_cents ASC, id ASC', price_desc: 'price_cents DESC, id DESC' };
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100000000 || min > max || !Object.hasOwn(ordering, sort)) { res.status(400).json({ message: 'Página, ordenação ou intervalo de preços inválido.' }); return; }
    const clauses = ['price_cents >= ?', 'price_cents <= ?'];
    const values: SQLInputValue[] = [min, max];
    if (text('q')) { clauses.push('(instr(search_text(name), ?) > 0 OR instr(search_text(description), ?) > 0)'); values.push(fold(text('q')), fold(text('q'))); }
    for (const field of ['category', 'size']) if (text(field)) { clauses.push(`${field} = ?`); values.push(text(field)); }
    const where = ` WHERE ${clauses.join(' AND ')}`;
    const total = Number(db.prepare(`SELECT count(*) AS total FROM products${where}`).get(...values)!.total);
    const products = db.prepare(`${productSelect}${where} ORDER BY ${ordering[sort]} LIMIT 12 OFFSET ?`).all(...values, (page - 1) * 12);
    res.json({ products, total, page, pageSize: 12, totalPages: Math.ceil(total / 12) });
  });
  router.get('/filters', (_req, res) => {
    res.json({ categories: db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map(row => row.category), sizes: db.prepare('SELECT DISTINCT size FROM products ORDER BY size').all().map(row => row.size) });
  });
  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    const product = Number.isSafeInteger(id) && id > 0 ? db.prepare(`${productSelect} WHERE id = ?`).get(id) : undefined;
    if (!product) { res.status(404).json({ message: 'Produto não encontrado.' }); return; }
    res.json({ product });
  });
  router.use((req, res, next) => {
    const user = account(req);
    if (!user) { res.status(401).json({ message: 'Entre na sua conta para continuar.' }); return; }
    if (user.role !== 'employee') { res.status(403).json({ message: 'Somente funcionários podem cadastrar e atualizar produtos.' }); return; }
    next();
  });
  router.post('/', (req, res) => {
    const product = validateProduct(req.body);
    if (!product) { res.status(400).json({ message: 'Preencha nome, descrição, categoria, tamanho, preço válido e estoque inteiro não negativo.' }); return; }
    const result = db.prepare('INSERT INTO products(name, description, category, size, price_cents, stock) VALUES (?,?,?,?,?,?)').run(...product);
    res.status(201).json({ product: db.prepare(`${productSelect} WHERE id = ?`).get(result.lastInsertRowid) });
  });
  router.put('/:id', (req, res) => {
    const product = validateProduct(req.body);
    if (!product) { res.status(400).json({ message: 'Preencha nome, descrição, categoria, tamanho, preço válido e estoque inteiro não negativo.' }); return; }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('UPDATE products SET name=?, description=?, category=?, size=?, price_cents=?, stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(...product, id).changes) { res.status(404).json({ message: 'Produto não encontrado.' }); return; }
    res.json({ product: db.prepare(`${productSelect} WHERE id = ?`).get(id), message: 'Produto atualizado com sucesso.' });
  });
  return router;
}
function validateProduct(value: unknown): SQLInputValue[] | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const limits = { name: 200, description: 4000, category: 80, size: 30 };
  const fields: string[] = [];
  for (const [key, limit] of Object.entries(limits)) {
    const field = row[key];
    if (typeof field !== 'string' || !field.trim() || field.trim().length > limit) return null;
    fields.push(field.trim());
  }
  if (typeof row.priceCents !== 'number' || !Number.isInteger(row.priceCents) || row.priceCents < 0 || row.priceCents > 100000000 || typeof row.stock !== 'number' || !Number.isInteger(row.stock) || row.stock < 0 || row.stock > 100000000) return null;
  return [...fields, row.priceCents, row.stock];
}
