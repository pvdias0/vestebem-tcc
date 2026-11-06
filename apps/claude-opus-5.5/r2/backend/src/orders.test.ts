import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, migrate, openDatabase } from './db.js';
import { seedDemo } from './seed.js';
import { startTestServer } from './testutil.js';

const productId = (db: ReturnType<typeof openDatabase>, name: string, size: string) =>
  (db.prepare('SELECT id FROM products WHERE name = ? AND size = ?').get(name, size) as { id: number }).id;

test('pedidos: permissões, validações, preços do catálogo e snapshot', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  await seedDemo(db);
  const { server, call, login } = await startTestServer(db);
  try {
    const carla = await login('carla@vestebem.demo');
    const bruno = await login('bruno@vestebem.demo');
    const func = await login('funcionario@vestebem.demo');
    const camiseta = productId(db, 'Camiseta básica branca', 'M'); // R$ 49,90, estoque 35
    const meia = productId(db, 'Meia esportiva (par)', 'ÚNICO'); // R$ 15,00
    const esgotado = productId(db, 'Bermuda de moletom', 'G'); // estoque 0

    // visitante
    assert.equal((await call('GET', '/api/orders')).status, 401);
    assert.equal((await call('GET', '/api/orders/1')).status, 401);
    assert.equal((await call('POST', '/api/orders', { items: [] })).status, 401);

    // validações
    const bad = [
      [],
      [{ productId: camiseta, quantity: 0 }],
      [{ productId: camiseta, quantity: 1.5 }],
      [{ productId: camiseta, quantity: '2' }],
      [{ productId: camiseta, quantity: -1 }],
      [{ productId: 99999, quantity: 1 }],
      [{ productId: 'abc', quantity: 1 }],
      [{ description: 'Peça manual', quantity: 1, unitPriceCents: 1 }],
      [{ productId: esgotado, quantity: 1 }],
      [{ productId: camiseta, quantity: 36 }],
    ];
    for (const items of bad) assert.equal((await call('POST', '/api/orders', { items }, carla)).status, 400, JSON.stringify(items));

    // criação: preço vem do catálogo; total/cliente/status/preço enviados são ignorados
    const created = await call(
      'POST',
      '/api/orders',
      {
        confirmShipping: true,
        totalCents: 1,
        customerId: 999,
        status: 'enviado',
        items: [
          { productId: camiseta, quantity: 2, unitPriceCents: 1 },
          { productId: meia, quantity: 3 },
          { productId: camiseta, quantity: 1 },
        ],
      },
      carla,
    );
    assert.equal(created.status, 201);
    const order = created.json.order;
    assert.equal(order.totalCents, 3 * 4990 + 3 * 1500);
    assert.equal(order.status, 'recebido');
    assert.equal(order.customer.email, 'carla@vestebem.demo');
    assert.equal(order.items.length, 2, 'itens do mesmo produto são somados');
    assert.deepEqual(
      { ...order.items[0], id: 0 },
      { id: 0, productId: camiseta, description: 'Camiseta básica branca', quantity: 3, unitPriceCents: 4990, subtotalCents: 14970 },
    );

    // alteração posterior do produto não muda o pedido
    const upd = await call('PUT', `/api/products/${camiseta}`, {
      name: 'Camiseta renomeada', description: '', category: 'Camisetas', size: 'M', priceCents: 9999, stock: 1,
    }, func);
    assert.equal(upd.status, 200);
    const again = (await call('GET', `/api/orders/${order.id}`, undefined, carla)).json.order;
    assert.equal(again.items[0].description, 'Camiseta básica branca');
    assert.equal(again.items[0].unitPriceCents, 4990);
    assert.equal(again.totalCents, order.totalCents);

    // estoque não é baixado
    assert.equal((db.prepare('SELECT stock FROM products WHERE id = ?').get(meia) as { stock: number }).stock, 100);

    // funcionário não cria pedido
    assert.equal((await call('POST', '/api/orders', { items: [{ productId: meia, quantity: 1 }] }, func)).status, 403);

    // listagens
    const carlaList = (await call('GET', '/api/orders', undefined, carla)).json.orders as { customer: { email: string } }[];
    assert.equal(carlaList.length, 3);
    assert.ok(carlaList.every((o) => o.customer.email === 'carla@vestebem.demo'));
    assert.equal((await call('GET', '/api/orders', undefined, func)).json.orders.length, 5);
    assert.equal((await call('GET', '/api/orders?status=cancelado', undefined, func)).json.orders.length, 1);

    // consulta por id
    assert.equal((await call('GET', `/api/orders/${order.id}`, undefined, func)).json.order.items.length, 2);
    assert.equal((await call('GET', `/api/orders/${order.id}`, undefined, bruno)).status, 404);
    assert.equal((await call('GET', '/api/orders/abc', undefined, carla)).status, 404);

    // status
    assert.equal((await call('PATCH', `/api/orders/${order.id}/status`, { status: 'enviado' }, carla)).status, 403);
    assert.equal((await call('PATCH', `/api/orders/${order.id}/status`, { status: 'perdido' }, func)).status, 400);
    const st = await call('PATCH', `/api/orders/${order.id}/status`, { status: 'em_preparacao' }, func);
    assert.equal(st.json.order.status, 'em_preparacao');

    // cadastro público não cria funcionário
    const reg = await call('POST', '/api/auth/register', { name: 'Zé', email: 'ze@ex.com', password: 'segredo123', role: 'employee' });
    assert.equal(reg.json.user.role, 'customer');

    // seed idempotente
    const r = await seedDemo(db);
    assert.deepEqual({ products: r.products, orders: r.orders }, { products: 1, orders: 0 }, 'só recria a camiseta renomeada');
    await seedDemo(db);
    const counts = db
      .prepare('SELECT (SELECT COUNT(*) FROM users) AS u, (SELECT COUNT(*) FROM orders) AS o, (SELECT COUNT(*) FROM products) AS p')
      .get() as { u: number; o: number; p: number };
    assert.deepEqual({ ...counts }, { u: 4, o: 5, p: 19 });
  } finally {
    server.close();
    db.close();
  }
});

test('migrations 002 e 003 preservam usuários, sessões e pedidos antigos', async () => {
  const db = openDatabase(':memory:');
  db.exec(`CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT 'x')`);
  db.exec(readFileSync(join(MIGRATIONS_DIR, '001_initial.sql'), 'utf8'));
  db.exec("INSERT INTO schema_migrations (version) VALUES ('001_initial.sql')");
  db.exec("INSERT INTO users (name, email, password_hash) VALUES ('Antiga', 'antiga@ex.com', 'h')");
  db.exec("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('t', 1, '2999-01-01')");
  assert.deepEqual(migrate(db).slice(0, 1), ['002_roles_and_orders.sql']);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n, 1);
  assert.equal((db.prepare('SELECT role FROM users').get() as { role: string }).role, 'customer');
  assert.throws(() => db.exec("UPDATE users SET role = 'admin'"));
  db.close();

  // Banco na etapa 2 com pedido manual → aplica 003 → pedido continua igual e consultável.
  const db2 = openDatabase(':memory:');
  db2.exec(`CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT 'x')`);
  for (const f of ['001_initial.sql', '002_roles_and_orders.sql']) {
    db2.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    db2.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(f);
  }
  db2.exec("INSERT INTO users (name, email, password_hash) VALUES ('Cli', 'cli@ex.com', 'h')");
  db2.exec("INSERT INTO orders (customer_id, total_cents) VALUES (1, 2500)");
  db2.exec("INSERT INTO order_items (order_id, description, quantity, unit_price_cents) VALUES (1, 'Peça antiga manual', 2, 1250)");
  assert.deepEqual(migrate(db2), ['003_products.sql', '004_account_and_shipping.sql']);
  db2.exec("UPDATE users SET role = 'employee'");
  db2.exec("INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'o@ex.com', 'h')");
  const { server, call } = await startTestServer(db2);
  try {
    // cria sessão diretamente para o funcionário
    const { hashToken } = await import('./auth.js');
    db2.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, 1, ?)').run(hashToken('tok'), '2999-01-01T00:00:00Z');
    const r = await call('GET', '/api/orders/1', undefined, 'vb_session=tok');
    assert.equal(r.status, 200);
    assert.equal(r.json.order.totalCents, 2500);
    assert.deepEqual(
      { ...r.json.order.items[0], id: 0 },
      { id: 0, productId: null, description: 'Peça antiga manual', quantity: 2, unitPriceCents: 1250, subtotalCents: 2500 },
    );
    assert.equal(r.json.order.shipping, null, 'pedido antigo sem informações de entrega');
  } finally {
    server.close();
    db2.close();
  }
});
