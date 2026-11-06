import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/app.js';
import { backendRoot, openDatabase } from '../src/database.js';
import { seedDemo } from '../src/seed.js';
import { deliveryFor, deliveryVersion } from '../src/profile.js';

test('migração da etapa 1 preserva contas, hashes e sessões', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vestebem-migration-'));
  const path = join(directory, 'legacy.sqlite');
  let db = new DatabaseSync(path);
  try {
    db.exec(readFileSync(resolve(backendRoot, 'migrations/001_initial.sql'), 'utf8'));
    db.exec("CREATE TABLE migrations(name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO migrations(name) VALUES ('001_initial.sql')");
    db.prepare('INSERT INTO users(id,name,email,password_hash) VALUES (42,?,?,?)').run('Conta Existente', 'anterior@example.com', 'hash-preservado');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('sessao-preservada', 42, Date.now() + 100000);
    const original = db.prepare('SELECT * FROM users').get();
    db.close();
    db = openDatabase(path);
    assert.deepEqual(db.prepare('SELECT * FROM users').get(), original);
    assert.equal(db.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').get('sessao-preservada')?.user_id, 42);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.throws(() => db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run('Inválido', 'x@y.z', 'hash', 'admin'));
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('pedidos: permissões, validações, total, status, demonstração e persistência', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vestebem-orders-'));
  const path = join(directory, 'orders.sqlite');
  const db = openDatabase(path);
  await seedDemo(db);
  const before = { users: db.prepare('SELECT count(*) AS n FROM users').get()!.n, orders: db.prepare('SELECT count(*) AS n FROM orders').get()!.n, items: db.prepare('SELECT count(*) AS n FROM order_items').get()!.n };
  await seedDemo(db);
  assert.deepEqual({ users: db.prepare('SELECT count(*) AS n FROM users').get()!.n, orders: db.prepare('SELECT count(*) AS n FROM orders').get()!.n, items: db.prepare('SELECT count(*) AS n FROM order_items').get()!.n }, before);
  assert.equal(before.users, 3); assert.equal(before.orders, 2);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/`;
  const request = (route: string, cookie = '', body?: unknown, method?: string) => {
    const id = db.prepare('SELECT id FROM users WHERE email=?').get('ana@demo.vestebem.test')!.id;
    const payload = route === 'orders' && body && typeof body === 'object' ? { ...body, confirmDelivery: true, deliveryVersion: deliveryVersion(deliveryFor(db, Number(id))) } : body;
    return fetch(base + route, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', cookie }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  };
  const login = async (email: string) => {
    const response = await request('login', '', { email, password: 'VesteBem2026!' });
    assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0];
  };
  let createdId = 0;
  try {
    const ana = await login('ana@demo.vestebem.test');
    const bruno = await login('bruno@demo.vestebem.test');
    const employee = await login('carla@demo.vestebem.test');
    assert.equal((await (await request('me', employee)).json()).user.role, 'employee');
    const productId = Number(db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES (?,?,?,?,?,?)').run('Camiseta', 'Algodão', 'Teste', 'M', 1999, 10).lastInsertRowid);
    const giftId = Number(db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES (?,?,?,?,?,?)').run('Brinde', 'Brinde', 'Teste', 'M', 0, 0).lastInsertRowid);
    const failureId = Number(db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES (?,?,?,?,?,?)').run('Falha', 'Falha', 'Teste', 'M', 100, 1).lastInsertRowid);
    const valid = { items: [{ productId, quantity: 3 }, { productId: giftId, quantity: 1 }] };
    for (const [route, body, method] of [['orders', undefined, 'GET'], ['orders/1', undefined, 'GET'], ['orders', valid, 'POST'], ['orders/1/status', { status: 'shipped' }, 'PATCH']] as const) assert.equal((await request(route, '', body, method)).status, 401);
    assert.equal((await request('orders', employee, valid)).status, 403);
    const anaOrders = (await (await request('orders', ana)).json()).orders;
    const brunoOrders = (await (await request('orders', bruno)).json()).orders;
    assert.equal(anaOrders.length, 1); assert.equal(brunoOrders.length, 1);
    assert.notEqual(anaOrders[0].customerId, brunoOrders[0].customerId);
    assert.equal((await request(`orders/${brunoOrders[0].id}`, ana)).status, 404);
    assert.equal((await request(`orders/${anaOrders[0].id}`, bruno)).status, 404);
    assert.equal((await request(`orders/${brunoOrders[0].id}`, employee)).status, 200);
    assert.equal((await request(`orders/${anaOrders[0].id}/status`, ana, { status: 'shipped' }, 'PATCH')).status, 403);
    assert.equal((await request('me', ana, { role: 'employee' }, 'PATCH')).status, 404);
    assert.equal((await request('register', '', { name: 'Cliente Novo', email: 'novo@example.com', password: '12345678', role: 'employee' })).status, 201);
    assert.equal(db.prepare('SELECT role FROM users WHERE email = ?').get('novo@example.com')!.role, 'customer');
    const expensiveId = Number(db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES (?,?,?,?,?,?)').run('Caro', 'Caro', 'Teste', 'M', 100000000, 0).lastInsertRowid);
    const invalidItems = [undefined, [], [null], [{}], [{ description: 'Manual', quantity: 1, unitPriceCents: 1 }], ...[0, -1, 1.5, '2', 10001].map(quantity => [{ productId, quantity }]), ...[0, -1, 1.5, '1', 999999].map(productId => [{ productId, quantity: 1 }]), Array.from({ length: 51 }, () => valid.items[0]), [valid.items[0], valid.items[0]], [{ productId: expensiveId, quantity: 10000 }]];
    const count = db.prepare('SELECT count(*) AS n FROM orders').get()!.n;
    for (const items of invalidItems) assert.equal((await request('orders', ana, { items })).status, 400, JSON.stringify(items));
    assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get()!.n, count);
    const created = await request('orders', ana, { ...valid, customerId: brunoOrders[0].customerId, status: 'shipped', totalCents: 1 });
    assert.equal(created.status, 201);
    const order = (await created.json()).order; createdId = order.id;
    assert.equal(order.customerId, anaOrders[0].customerId); assert.equal(order.status, 'received'); assert.equal(order.totalCents, 5997);
    assert.ok(!Number.isNaN(Date.parse(order.createdAt)));
    const detail = (await (await request(`orders/${order.id}`, ana)).json()).order;
    assert.equal(detail.items.length, 2); assert.equal(detail.items[0].description, 'Camiseta');
    assert.ok(!JSON.stringify(detail).includes('password'));
    assert.equal((await (await request('orders', employee)).json()).orders.length, 3);
    for (const status of ['preparing', 'shipped', 'cancelled', 'received']) {
      assert.equal((await request(`orders/${order.id}/status`, employee, { status }, 'PATCH')).status, 200);
      assert.equal((await (await request(`orders/${order.id}`, ana)).json()).order.status, status);
    }
    assert.equal((await request(`orders/${order.id}/status`, employee, { status: 'invalid' }, 'PATCH')).status, 400);
    assert.equal((await request('orders/999999/status', employee, { status: 'shipped' }, 'PATCH')).status, 404);
    assert.equal((await request('orders/abc', ana)).status, 404);
    // Verify the DB constraints and that a failed multi-item write rolls back entirely.
    assert.throws(() => db.prepare('UPDATE order_items SET quantity = 0 WHERE order_id = ?').run(order.id));
    assert.throws(() => db.prepare('UPDATE order_items SET unit_price_cents = -1 WHERE order_id = ?').run(order.id));
    assert.throws(() => db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('invalid', order.id));
    db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON order_items WHEN NEW.description = 'Falha' BEGIN SELECT RAISE(ABORT, 'forced failure'); END;");
    const originalError = console.error; console.error = () => {};
    try { assert.equal((await request('orders', ana, { items: [valid.items[0], { productId: failureId, quantity: 1 }] })).status, 500); }
    finally { console.error = originalError; }
    assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get()!.n, Number(count) + 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    await request('logout', ana, {});
    assert.equal((await request('orders', ana)).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); db.close();
    const reopened = openDatabase(path);
    try { assert.equal(reopened.prepare('SELECT total_cents FROM orders WHERE id = ?').get(createdId)?.total_cents, 5997); }
    finally { reopened.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});
