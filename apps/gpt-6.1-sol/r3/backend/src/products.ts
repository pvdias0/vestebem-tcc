import { Router, type RequestHandler } from 'express';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
const fields = 'id,name,description,category,size,price_cents AS priceCents,stock';
export function productsRouter(db: DatabaseSync, authenticate: RequestHandler) {
 const router = Router();
 router.get('/options', (_req, res) => res.json({ categories: db.prepare('SELECT DISTINCT category FROM products ORDER BY category COLLATE NOCASE').all().map(row => row.category), sizes: db.prepare('SELECT DISTINCT size FROM products ORDER BY size COLLATE NOCASE').all().map(row => row.size) }));
 router.get('/', (req, res) => {
  const { q = '', category = '', size = '', minPriceCents = '', maxPriceCents = '', page = '1', sort = 'name_asc' } = req.query;
  if (![q,category,size,minPriceCents,maxPriceCents,page,sort].every(value => typeof value === 'string') || String(q).length > 200 || String(category).length > 80 || String(size).length > 30) { res.status(400).json({ message: 'Parâmetros de pesquisa inválidos.' }); return; }
  const integer = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
  if (!integer(page) || Number(page) < 1 || Number(page) > 100000000 || [minPriceCents,maxPriceCents].some(value => value !== '' && (!integer(value) || Number(value) > 100000000)) || (minPriceCents !== '' && maxPriceCents !== '' && Number(minPriceCents) > Number(maxPriceCents))) { res.status(400).json({ message: 'Confira a página e os limites de preço.' }); return; }
  const sorts: Record<string, string> = { name_asc: 'name COLLATE NOCASE ASC,id ASC', name_desc: 'name COLLATE NOCASE DESC,id DESC', price_asc: 'price_cents ASC,id ASC', price_desc: 'price_cents DESC,id DESC' };
  const order = Object.hasOwn(sorts, String(sort)) ? sorts[String(sort)] : undefined;
  if (!order) { res.status(400).json({ message: 'Ordenação inválida.' }); return; }
  const clauses: string[] = []; const params: SQLInputValue[] = [];
  if (String(q).trim()) { clauses.push('(instr(search_fold(name),search_fold(?))>0 OR instr(search_fold(description),search_fold(?))>0)'); params.push(String(q).trim(),String(q).trim()); }
  if (category) { clauses.push('category=?'); params.push(String(category)); }
  if (size) { clauses.push('size=?'); params.push(String(size)); }
  if (minPriceCents !== '') { clauses.push('price_cents>=?'); params.push(Number(minPriceCents)); }
  if (maxPriceCents !== '') { clauses.push('price_cents<=?'); params.push(Number(maxPriceCents)); }
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const total = Number(db.prepare('SELECT count(*) AS total FROM products' + where).get(...params)!.total);
  const items = db.prepare('SELECT '+fields+' FROM products'+where+' ORDER BY '+order+' LIMIT 12 OFFSET ?').all(...params,(Number(page)-1)*12);
  res.json({ items, page: Number(page), pageSize: 12, total, totalPages: Math.ceil(total/12) });
 });
 router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = Number.isSafeInteger(id) && id > 0 ? db.prepare('SELECT '+fields+' FROM products WHERE id=?').get(id) : undefined;
  if (!product) { res.status(404).json({ message: 'Produto não encontrado.' }); return; }
  res.json(product);
 });
 router.use(authenticate, (_req, res, next) => { if (res.locals.user.role !== 'employee') { res.status(403).json({ message: 'Somente funcionários podem cadastrar ou atualizar produtos.' }); return; } next(); });
 const save: RequestHandler = (req, res) => {
  const { name, description, category, size, priceCents, stock } = req.body ?? {};
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= max;
  if (!text(name,200) || !text(description,5000) || !text(category,80) || !text(size,30) || !Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000 || !Number.isInteger(stock) || stock < 0 || stock > 1000000000) { res.status(400).json({ message: 'Preencha os textos obrigatórios, preço de zero a R$ 1.000.000,00 e estoque inteiro de zero a 1 bilhão.' }); return; }
  const values = [name.trim(),description.trim(),category.trim(),size.trim(),priceCents,stock];
  if (req.method === 'POST') { const result = db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES (?,?,?,?,?,?)').run(...values); res.status(201).json({ id: Number(result.lastInsertRowid), message: 'Produto cadastrado com sucesso.' }); }
  else {
   const id = Number(req.params.id);
   if (!Number.isSafeInteger(id) || id < 1 || db.prepare('UPDATE products SET name=?,description=?,category=?,size=?,price_cents=?,stock=? WHERE id=?').run(...values,id).changes === 0) { res.status(404).json({ message: 'Produto não encontrado.' }); return; }
   res.json({ id, message: 'Produto atualizado com sucesso.' });
  }
 };
 router.post('/', save); router.put('/:id', save);
 return router;
}
