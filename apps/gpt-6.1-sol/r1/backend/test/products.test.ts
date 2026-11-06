import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { backendRoot } from '../src/database.js';
import { deliveryFor, deliveryVersion } from '../src/profile.js';

test('migração de pedidos anteriores ao catálogo preserva itens, valores, contas e sessões', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vestebem-catalog-migration-'));
  const path = join(directory, 'legacy.sqlite');
  let db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON; CREATE TABLE migrations(name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    for (const name of ['001_initial.sql', '002_orders_and_roles.sql']) { db.exec(readFileSync(resolve(backendRoot, 'migrations', name), 'utf8')); db.prepare('INSERT INTO migrations(name) VALUES (?)').run(name); }
    db.exec("INSERT INTO users(id,name,email,password_hash) VALUES (1,'Cliente Anterior','anterior@test.com','hash'); INSERT INTO sessions VALUES ('token',1,9999999999999); INSERT INTO orders(id,customer_id,total_cents) VALUES (1,1,3210); INSERT INTO order_items(order_id,description,quantity,unit_price_cents) VALUES (1,'Peça antiga',3,1070)");
    const original = db.prepare('SELECT * FROM order_items').all();
    db.close(); db = openDatabase(path);
    assert.deepEqual(db.prepare('SELECT id,order_id,description,quantity,unit_price_cents FROM order_items').all(), original);
    assert.equal(db.prepare('SELECT product_id FROM order_items').get()!.product_id, null);
    assert.equal(db.prepare('SELECT total_cents FROM orders').get()!.total_cents, 3210);
    assert.equal(db.prepare('SELECT password_hash FROM users').get()!.password_hash, 'hash');
    assert.equal(db.prepare('SELECT token_hash FROM sessions').get()!.token_hash, 'token');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('catálogo público: paginação, consulta literal, filtros simultâneos, ordenação, permissões e snapshots', async () => {
  const db = openDatabase(':memory:');
  await seedDemo(db); await seedDemo(db);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get()!.n, 16);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const request = (path: string, body?: unknown, cookie = '', method?: string) => fetch(`http://127.0.0.1:${address.port}/api/${path}`, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const query = async (params: Record<string, string> = {}) => { const response = await request(`products?${new URLSearchParams(params)}`); assert.equal(response.status, 200); return response.json(); };
  const login = async (email: string) => { const response = await request('login', { email, password: 'VesteBem2026!' }); assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0]; };
  try {
    const first = await query(); const second = await query({ page: '2' });
    assert.equal(first.products.length, 12); assert.equal(second.products.length, 4); assert.equal(first.total, 16); assert.equal(first.pageSize, 12);
    assert.equal(new Set([...first.products, ...second.products].map(p => p.id)).size, 16);
    assert.equal((await query({ page: '3' })).products.length, 0);
    const before = db.prepare('SELECT * FROM products ORDER BY id').all();
    const apostrophe = await query({ q: "Coleção D'Água" }); assert.equal(apostrophe.products.length, 1);
    assert.equal((await query({ q: "colecao d'agua" })).products[0].id, apostrophe.products[0].id);
    assert.equal((await query({ q: "' OR 1=1 --" })).total, 0);
    assert.equal((await query({ q: '%' })).total, 0);
    assert.equal((await query({ q: 'confortável' })).total, 16);
    const combined = await query({ q: 'algodão', category: 'Camisetas', size: 'P', minPriceCents: '1990', maxPriceCents: '1990' });
    assert.equal(combined.total, 1); assert.equal(combined.products[0].name, 'Camiseta de algodão');
    assert.equal((await query({ q: 'algodão', category: 'Vestidos', size: 'P', minPriceCents: '0', maxPriceCents: '1990' })).total, 0);
    for (const sort of ['name_asc', 'name_desc', 'price_asc', 'price_desc']) {
      const rows = [...(await query({ sort })).products, ...(await query({ sort, page: '2' })).products];
      const values = rows.map(row => sort.startsWith('price') ? row.priceCents : row.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
      for (let i = 1; i < values.length; i++) assert.ok(sort.endsWith('asc') ? values[i - 1] <= values[i] : values[i - 1] >= values[i]);
    }
    assert.equal((await request(`products/${apostrophe.products[0].id}`)).status, 200);
    assert.equal((await request('products/999999')).status, 404);
    assert.equal((await request('products/filters')).status, 200);
    assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(), before, 'Consultas não alteram registros');
    for (const params of [{ minPriceCents: '-1' }, { minPriceCents: '100', maxPriceCents: '10' }, { page: '0' }, { sort: 'name; DROP TABLE products' }, { maxPriceCents: '1.5' }]) assert.equal((await request(`products?${new URLSearchParams(params)}`)).status, 400);
    const customer = await login('ana@demo.vestebem.test');
    const employee = await login('carla@demo.vestebem.test');
    const product = { name: "Coleção D'Água <script>alert('x')</script>", description: '<img src=x onerror=alert(1)> Peça de teste', category: 'Especial', size: 'Único', priceCents: 1234, stock: 0 };
    for (const cookie of ['', customer]) {
      assert.equal((await request('products', product, cookie)).status, cookie ? 403 : 401);
      assert.equal((await request('products/1', product, cookie, 'PUT')).status, cookie ? 403 : 401);
    }
    for (const body of [{ ...product, priceCents: -1 }, { ...product, priceCents: 1.5 }, { ...product, stock: -1 }, { ...product, stock: 1.5 }, { ...product, stock: '1' }, { ...product, name: ' ' }]) assert.equal((await request('products', body, employee)).status, 400);
    const response = await request('products', product, employee); assert.equal(response.status, 201); const created = (await response.json()).product;
    assert.equal(created.name, product.name); assert.equal(created.description, product.description);
    const originalStock = db.prepare('SELECT stock FROM products WHERE id = ?').get(created.id)!.stock;
    const customerId = Number(db.prepare('SELECT id FROM users WHERE email=?').get('ana@demo.vestebem.test')!.id);
    const bought = await request('orders', { items: [{ productId: created.id, quantity: 2, unitPriceCents: 0, description: 'Falso' }], totalCents: 0, confirmDelivery: true, deliveryVersion: deliveryVersion(deliveryFor(db, customerId)) }, customer);
    assert.equal(bought.status, 201); const orderId = (await bought.json()).order.id;
    assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(created.id)!.stock, originalStock);
    const getOrder = async () => (await (await request(`orders/${orderId}`, undefined, customer)).json()).order;
    const snapshot = await getOrder(); assert.equal(snapshot.totalCents, 2468); assert.equal(snapshot.items[0].description, product.name); assert.equal(snapshot.items[0].productId, created.id);
    assert.equal((await request(`products/${created.id}`, { ...product, name: 'Nome novo', priceCents: 9999, stock: 10 }, employee, 'PUT')).status, 200);
    assert.deepEqual(await getOrder(), snapshot);
    assert.equal(originalStock, 0); // Stock zero does not prevent orders: no reservation or deduction.
    const legacyId = db.prepare('SELECT id FROM orders WHERE demo_key = ?').get('demo-order-1')!.id;
    const legacy = (await (await request(`orders/${legacyId}`, undefined, customer)).json()).order;
    assert.equal(legacy.items[0].productId, null); assert.equal(legacy.items[0].unitPriceCents, 5990); assert.equal(legacy.totalCents, 13970);
    assert.throws(() => db.prepare('UPDATE products SET stock = -1 WHERE id = ?').run(created.id));
    assert.throws(() => db.prepare('UPDATE products SET price_cents = -1 WHERE id = ?').run(created.id));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); db.close(); }
});
