import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, openDatabase } from '../src/db.ts';
import { migrationsDir, startTestServer } from './helpers.ts';

const ADDRESS = { recipient: 'Ana Destinatária', cep: '01000-000', street: 'Rua Fictícia', number: '10',
  complement: null, district: 'Bairro', city: 'Cidade', state: 'SP' };

function dbWithMigrations(upTo: string[]) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-'));
  const dir = path.join(tmp, 'mig');
  fs.mkdirSync(dir);
  for (const f of upTo) fs.copyFileSync(path.join(migrationsDir, f), path.join(dir, f));
  const db = openDatabase(path.join(tmp, 'db.sqlite'));
  migrate(db, dir);
  return { db, cleanup: () => { db.close(); fs.rmSync(tmp, { recursive: true, force: true }); } };
}

test('migration 002 preserva usuários e sessões de um banco da etapa 1', () => {
  const { db, cleanup } = dbWithMigrations(['001_init.sql']);
  db.exec("INSERT INTO users (name, email, password_hash) VALUES ('Antigo', 'antigo@ex.com', 'x')");
  db.exec("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('t', 1, '2999-01-01')");
  assert.deepEqual(migrate(db, migrationsDir), ['002_roles_and_orders.sql', '003_products.sql', '004_profile_address_shipping.sql']);
  assert.equal(db.prepare('SELECT email FROM users').get()?.email, 'antigo@ex.com');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n, 1);
  assert.throws(() => db.exec("INSERT INTO users (name, email, password_hash, role) VALUES ('X', 'x@ex.com', 'x', 'admin')"));
  cleanup();
});

test('migration 003 preserva pedidos da etapa 2 (itens sem produto)', () => {
  const { db, cleanup } = dbWithMigrations(['001_init.sql', '002_roles_and_orders.sql']);
  db.exec("INSERT INTO users (name, email, password_hash) VALUES ('Antigo', 'antigo@ex.com', 'x')");
  db.exec("INSERT INTO orders (customer_id, total_cents) VALUES (1, 9980)");
  db.exec("INSERT INTO order_items (order_id, position, description, quantity, unit_price_cents) VALUES (1, 1, 'Peça antiga', 2, 4990)");
  assert.deepEqual(migrate(db, migrationsDir), ['003_products.sql', '004_profile_address_shipping.sql']);
  assert.equal(db.prepare('SELECT ship_recipient FROM orders').get()?.ship_recipient, null);
  const item = db.prepare('SELECT description, quantity, unit_price_cents, product_id FROM order_items').get();
  assert.deepEqual({ ...item }, { description: 'Peça antiga', quantity: 2, unit_price_cents: 4990, product_id: null });
  assert.equal(db.prepare('SELECT total_cents FROM orders').get()?.total_cents, 9980);
  cleanup();
});

test('pedidos: criação a partir do catálogo, visibilidade e status', async (t) => {
  const { db, call, register, staff: func, close } = await startTestServer();
  t.after(close);
  const prod = async (name: string, priceCents: number, stock: number) =>
    (await call('POST', '/products', { name, description: '', category: 'Teste', size: 'M', priceCents, stock }, func)).json.product.id as number;
  const camiseta = await prod('Camiseta', 4990, 10);
  const brinde = await prod('Brinde', 0, 5);
  const esgotado = await prod('Esgotado', 1000, 0);

  const ana = await register('Ana', 'ana@ex.com');
  const bia = await register('Bia', 'bia@ex.com');
  assert.equal((await call('GET', '/account', undefined, ana)).json.user.role, 'cliente');

  // Sem endereço/telefone o pedido não é finalizado.
  const one = [{ productId: camiseta, quantity: 1 }];
  let r = await call('POST', '/orders', { items: one, confirmShipping: true }, ana);
  assert.equal(r.status, 400); assert.match(r.json.error, /endereço/);
  await call('PUT', '/account/address', ADDRESS, ana);
  r = await call('POST', '/orders', { items: one, confirmShipping: true }, ana);
  assert.equal(r.status, 400); assert.match(r.json.error, /telefone/);
  await call('PUT', '/account/profile', { name: 'Ana', cpf: '12345678909', phone: '11900000001' }, ana);
  // Sem confirmação explícita também não.
  assert.equal((await call('POST', '/orders', { items: one }, ana)).status, 400);
  assert.equal((await call('POST', '/orders', { items: one, confirmShipping: 'sim' }, ana)).status, 400);

  // Visitante
  assert.equal((await call('GET', '/orders')).status, 401);
  assert.equal((await call('POST', '/orders', { items: [{ productId: camiseta, quantity: 1 }] })).status, 401);
  assert.equal((await call('GET', '/orders/1')).status, 401);

  // Validações
  const bad = async (items: unknown) => (await call('POST', '/orders', { items, confirmShipping: true }, ana)).status;
  assert.equal(await bad([]), 400);
  assert.equal(await bad(undefined), 400);
  assert.equal(await bad([{ productId: camiseta, quantity: 0 }]), 400);
  assert.equal(await bad([{ productId: camiseta, quantity: 1.5 }]), 400);
  assert.equal(await bad([{ productId: camiseta, quantity: '2' }]), 400);
  assert.equal(await bad([{ productId: 9999, quantity: 1 }]), 400);
  assert.equal(await bad([{ description: 'Manual', quantity: 1, unitPriceCents: 1 }]), 400);
  assert.equal(await bad([{ productId: esgotado, quantity: 1 }]), 400);
  assert.equal(await bad([{ productId: camiseta, quantity: 11 }]), 400);

  // Preço vem do catálogo; total/preço/cliente enviados são ignorados; produto repetido é somado.
  const created = await call('POST', '/orders', {
    totalCents: 1, customerId: 999, confirmShipping: true,
    items: [{ productId: camiseta, quantity: 2, unitPriceCents: 1 }, { productId: brinde, quantity: 1 }, { productId: camiseta, quantity: 1 }],
  }, ana);
  assert.equal(created.status, 201);
  const order = created.json.order;
  assert.equal(order.totalCents, 14970);
  assert.equal(order.status, 'recebido');
  assert.equal(order.customer.email, 'ana@ex.com');
  assert.deepEqual(order.items.map((i: { productId: number; description: string; quantity: number; unitPriceCents: number }) =>
    [i.productId, i.description, i.quantity, i.unitPriceCents]), [[camiseta, 'Camiseta', 3, 4990], [brinde, 'Brinde', 1, 0]]);
  // Sem baixa de estoque nesta etapa.
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(camiseta)?.stock, 10);

  // Alterar o produto não altera o pedido já feito.
  await call('PUT', `/products/${camiseta}`, { name: 'Camiseta Nova', description: '', category: 'Teste', size: 'M', priceCents: 9999, stock: 10 }, func);
  const again = (await call('GET', `/orders/${order.id}`, undefined, ana)).json.order;
  assert.equal(again.items[0].description, 'Camiseta');
  assert.equal(again.items[0].unitPriceCents, 4990);
  assert.equal(again.totalCents, 14970);

  // Entrega copiada no pedido; alterar a conta depois não muda o pedido; CPF nunca aparece.
  assert.deepEqual(again.shipping, { ...ADDRESS, cep: '01000000', phone: '11900000001' });
  await call('PUT', '/account/address', { ...ADDRESS, street: 'Outra Rua', recipient: 'Outro' }, ana);
  await call('PUT', '/account/profile', { name: 'Ana Nova', cpf: '12345678909', phone: '11911111111' }, ana);
  const later = (await call('GET', `/orders/${order.id}`, undefined, func));
  assert.equal(later.json.order.shipping.street, 'Rua Fictícia');
  assert.equal(later.json.order.shipping.recipient, 'Ana Destinatária');
  assert.equal(later.json.order.shipping.phone, '11900000001');
  for (const url of [`/orders/${order.id}`, '/orders']) {
    const raw = JSON.stringify((await call('GET', url, undefined, func)).json);
    assert.ok(!raw.includes('12345678909') && !raw.toLowerCase().includes('cpf'), url);
  }

  // Funcionário não cria pedidos
  assert.equal((await call('POST', '/orders', { items: [{ productId: camiseta, quantity: 1 }] }, func)).status, 403);

  // Visibilidade
  assert.equal((await call('GET', '/orders', undefined, ana)).json.orders.length, 1);
  assert.equal((await call('GET', '/orders', undefined, bia)).json.orders.length, 0);
  assert.equal((await call('GET', `/orders/${order.id}`, undefined, bia)).status, 404);
  assert.equal((await call('GET', '/orders', undefined, func)).json.orders.length, 1);
  assert.equal((await call('GET', `/orders/${order.id}`, undefined, func)).status, 200);
  assert.equal((await call('GET', '/orders/abc', undefined, func)).status, 404);

  // Status
  assert.equal((await call('PATCH', `/orders/${order.id}/status`, { status: 'enviado' }, ana)).status, 403);
  assert.equal((await call('PATCH', `/orders/${order.id}/status`, { status: 'perdido' }, func)).status, 400);
  assert.equal((await call('PATCH', '/orders/9999/status', { status: 'enviado' }, func)).status, 404);
  assert.equal((await call('PATCH', `/orders/${order.id}/status`, { status: 'em_preparacao' }, func)).status, 200);
  assert.equal((await call('GET', `/orders/${order.id}`, undefined, ana)).json.order.status, 'em_preparacao');
});
