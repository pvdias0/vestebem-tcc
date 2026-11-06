import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, openDatabase } from './db.js';
import { seedDemo } from './seed.js';
import { startTestServer } from './testutil.js';

interface P {
  id: number;
  name: string;
  description: string;
  category: string;
  size: string;
  priceCents: number;
  stock: number;
}

test('catálogo: paginação, pesquisa, filtros, ordenação e somente leitura', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  await seedDemo(db);
  const { server, call } = await startTestServer(db);
  const list = async (qs: string) => {
    const r = await call('GET', `/api/products?${qs}`);
    assert.equal(r.status, 200, qs + ' ' + r.text);
    return r.json as { products: P[]; total: number; totalPages: number; page: number };
  };
  try {
    const snapshot = () => JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all());
    const before = snapshot();

    // paginação: 18 produtos → 12 + 6
    const p1 = await list('');
    assert.equal(p1.total, 18);
    assert.equal(p1.products.length, 12);
    assert.equal(p1.totalPages, 2);
    const p2 = await list('pagina=2');
    assert.equal(p2.products.length, 6);
    assert.equal(new Set([...p1.products, ...p2.products].map((p) => p.id)).size, 18);
    assert.equal((await list('pagina=5')).products.length, 0);

    // pesquisa com apóstrofo, com e sem acento, em nome ou descrição
    for (const q of ["Coleção D'Água", "colecao d'agua", "D'ÁGUA"]) {
      const r = await list(`q=${encodeURIComponent(q)}`);
      assert.equal(r.total, 2, q);
      assert.ok(r.products.every((p) => p.name.includes("Coleção D'Água")));
    }
    assert.equal((await list('q=' + encodeURIComponent('impermeável'))).products[0]?.name, 'Jaqueta corta-vento');
    assert.equal((await list('q=' + encodeURIComponent("'; DROP TABLE products; --"))).total, 0);
    const pct = await list('q=100%25');
    assert.ok(pct.total === 3 && pct.products.every((p) => p.description.includes('100%')), '% é texto comum');
    assert.equal((await list('q=%25%25')).total, 0, '% não funciona como curinga');
    assert.equal((await list('q=_')).total, 0, '_ é tratado como texto comum');

    // filtros combinados
    const comb = await list('categoria=Camisetas&tamanho=M&precoMin=50&precoMax=100');
    assert.deepEqual(comb.products.map((p) => p.name), ["Camiseta estampada Coleção D'Água"]);
    const acc = await list('categoria=Acess%C3%B3rios&precoMax=59,90');
    assert.ok(acc.products.length === 2 && acc.products.every((p) => p.category === 'Acessórios' && p.priceCents <= 5990));
    const all = (await list('q=camiseta&tamanho=m')).products;
    assert.ok(all.length === 2 && all.every((p) => p.size === 'M' && /camiseta/i.test(p.name)));

    // ordenação
    const asc = (await list('ordem=preco_asc')).products.map((p) => p.priceCents);
    assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
    const desc = (await list('ordem=preco_desc')).products.map((p) => p.priceCents);
    assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
    const names = (await list('ordem=nome_desc&categoria=Casacos')).products.map((p) => p.name);
    assert.deepEqual(names, ['Moletom com capuz', 'Jaqueta jeans', 'Jaqueta corta-vento']);

    // parâmetros inválidos
    for (const qs of ['ordem=x', 'pagina=0', 'pagina=abc', 'precoMin=-1', 'precoMin=10&precoMax=5'])
      assert.equal((await call('GET', `/api/products?${qs}`)).status, 400, qs);

    // detalhes e filtros
    const d = await call('GET', `/api/products/${p1.products[0]!.id}`);
    assert.equal(d.status, 200);
    assert.equal((await call('GET', '/api/products/99999')).status, 404);
    const f = (await call('GET', '/api/products/filters')).json;
    assert.ok(f.categories.includes('Vestidos') && f.sizes.includes('ÚNICO'));

    assert.equal(snapshot(), before, 'consultas não modificam registros');
  } finally {
    server.close();
    db.close();
  }
});

test('cadastro e atualização de produtos: permissões e validações', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  await seedDemo(db);
  const { server, call, login } = await startTestServer(db);
  try {
    const func = await login('funcionario@vestebem.demo');
    const carla = await login('carla@vestebem.demo');
    const valid = {
      name: "Regata Coleção D'Água",
      description: '<script>alert(1)</script> texto simples',
      category: 'Camisetas',
      size: 'gg',
      priceCents: 3990,
      stock: 0,
    };
    assert.equal((await call('POST', '/api/products', valid)).status, 401);
    assert.equal((await call('POST', '/api/products', valid, carla)).status, 403);
    assert.equal((await call('PUT', '/api/products/1', valid, carla)).status, 403);

    for (const patch of [{ priceCents: -1 }, { priceCents: 10.5 }, { stock: -1 }, { stock: 1.5 }, { stock: '3' }, { name: '' }, { category: ' ' }, { size: '' }]) {
      const r = await call('POST', '/api/products', { ...valid, ...patch }, func);
      assert.equal(r.status, 400, JSON.stringify(patch));
    }

    const created = await call('POST', '/api/products', valid, func);
    assert.equal(created.status, 201);
    assert.equal(created.json.product.description, valid.description, 'texto guardado como recebido');
    assert.equal(created.json.product.size, 'GG');
    const id = created.json.product.id as number;

    const upd = await call('PUT', `/api/products/${id}`, { ...valid, priceCents: 0, stock: 7, name: 'Regata nova' }, func);
    assert.equal(upd.status, 200);
    assert.equal(upd.json.product.priceCents, 0);
    assert.equal(upd.json.product.stock, 7);
    assert.equal((await call('GET', '/api/products?q=regata%20nova')).json.total, 1, 'índice de pesquisa atualizado');
    assert.equal((await call('PUT', '/api/products/99999', valid, func)).status, 404);
    assert.equal((await call('PUT', `/api/products/${id}`, { ...valid, stock: -2 }, func)).status, 400);
  } finally {
    server.close();
    db.close();
  }
});
