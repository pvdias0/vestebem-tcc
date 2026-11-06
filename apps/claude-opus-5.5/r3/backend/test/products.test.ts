import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/seed.ts';
import { startTestServer } from './helpers.ts';

type Prod = { id: number; name: string; description: string; category: string; size: string; priceCents: number; stock: number };

test('catálogo: permissões, validação, pesquisa, filtros, ordenação e paginação', async (t) => {
  const { db, call, register, staff, close } = await startTestServer();
  t.after(close);
  await seed(db, () => {});
  const nProducts = Number(db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n);
  assert.ok(nProducts >= 15);

  // Seed idempotente
  await seed(db, () => {});
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n), nProducts);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM users').get()?.n), 5);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM orders').get()?.n), 4);

  // Permissões
  const valid = { name: 'Teste', description: 'Desc', category: 'Camisetas', size: 'M', priceCents: 1000, stock: 1 };
  const cliente = await register('Cli', 'cli@ex.com');
  assert.equal((await call('POST', '/products', valid)).status, 401);
  assert.equal((await call('POST', '/products', valid, cliente)).status, 403);
  assert.equal((await call('PUT', '/products/1', valid, cliente)).status, 403);

  // Validação
  for (const patch of [{ priceCents: -1 }, { stock: -1 }, { stock: 1.5 }, { stock: '3' }, { priceCents: 10.5 }, { name: '' }, { category: ' ' }, { size: '' }]) {
    const r = await call('POST', '/products', { ...valid, ...patch }, staff);
    assert.equal(r.status, 400, JSON.stringify(patch));
  }
  assert.equal((await call('PUT', '/products/99999', valid, staff)).status, 404);

  // Cadastro e atualização; HTML é guardado como texto
  const html = await call('POST', '/products', { ...valid, name: '<b>Negrito</b>', description: '<script>x</script>', stock: 0, priceCents: 0 }, staff);
  assert.equal(html.status, 201);
  assert.equal(html.json.product.name, '<b>Negrito</b>');
  const upd = await call('PUT', `/products/${html.json.product.id}`, { ...valid, name: 'Atualizado', stock: 7 }, staff);
  assert.equal(upd.json.product.name, 'Atualizado');
  assert.equal(upd.json.product.stock, 7);

  const list = async (qs: string) => {
    const r = await call('GET', `/products?${qs}`);
    assert.equal(r.status, 200, qs);
    return r.json as { products: Prod[]; total: number; totalPages: number; page: number };
  };

  // Paginação de 12
  const total = nProducts + 1;
  const p1 = await list('');
  assert.equal(p1.products.length, 12);
  assert.equal(p1.total, total);
  const p2 = await list('page=2');
  assert.equal(p2.products.length, total - 12);
  assert.equal(new Set([...p1.products, ...p2.products].map((p) => p.id)).size, total);
  assert.equal((await list('page=99')).products.length, 0);

  // Pesquisa com apóstrofo, sem acento e sem diferenciar maiúsculas; também na descrição
  const apos = await list(`q=${encodeURIComponent("Coleção D'Água")}`);
  assert.ok(apos.total >= 1 && apos.products.every((p) => p.name.includes("D'Água")));
  assert.equal((await list(`q=${encodeURIComponent("colecao d'agua")}`)).total, apos.total);
  const desc = await list('q=elastano');
  assert.ok(desc.total >= 1 && desc.products.every((p) => p.description.toLowerCase().includes('elastano')));
  assert.equal((await list(`q=${encodeURIComponent("' OR 1=1 --")}`)).total, 0);
  assert.equal((await list('q=%25')).total, 0); // "%" literal, não curinga

  // Filtros combinados
  const combo = await list('category=Camisetas&size=M&minPrice=40&maxPrice=60');
  assert.ok(combo.total >= 1);
  for (const p of combo.products) {
    assert.equal(p.category, 'Camisetas'); assert.equal(p.size, 'M');
    assert.ok(p.priceCents >= 4000 && p.priceCents <= 6000);
  }
  const expected = db.prepare("SELECT COUNT(*) AS n FROM products WHERE category='Camisetas' AND size='M' AND price_cents BETWEEN 4000 AND 6000").get()?.n;
  assert.equal(combo.total, expected);
  const qAndCat = await list('q=jeans&category=Calças&size=42');
  assert.equal(qAndCat.total, 1);

  // Ordenação
  const byPriceAsc = (await list('sort=price&order=asc')).products.map((p) => p.priceCents);
  assert.deepEqual(byPriceAsc, [...byPriceAsc].sort((a, b) => a - b));
  const byPriceDesc = (await list('sort=price&order=desc')).products.map((p) => p.priceCents);
  assert.deepEqual(byPriceDesc, [...byPriceDesc].sort((a, b) => b - a));
  const names = (await list('sort=name&order=desc&category=Acessórios')).products.map((p) => p.name);
  assert.deepEqual(names, [...names].sort((a, b) => b.localeCompare(a, 'pt-BR')));

  // Parâmetros inválidos
  for (const qs of ['minPrice=-1', 'maxPrice=abc', 'minPrice=50&maxPrice=10', 'sort=stock', 'order=up', 'page=0']) {
    assert.equal((await call('GET', `/products?${qs}`)).status, 400, qs);
  }

  // Detalhe público e filtros disponíveis
  const one = await call('GET', `/products/${p1.products[0]!.id}`);
  assert.equal(one.status, 200);
  assert.equal((await call('GET', '/products/abc')).status, 404);
  const filters = (await call('GET', '/products/filters')).json;
  assert.ok(filters.categories.includes('Camisetas') && filters.sizes.indexOf('P') < filters.sizes.indexOf('G'));

  // Consultas não modificam registros
  const snapshot = JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all());
  await list(`q=${encodeURIComponent("D'Água")}&sort=price&order=desc`);
  await call('GET', `/products/${p1.products[0]!.id}`);
  await call('GET', '/products/filters');
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all()), snapshot);
});
