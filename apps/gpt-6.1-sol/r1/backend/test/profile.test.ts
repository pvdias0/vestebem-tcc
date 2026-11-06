import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed.js';
import { verifyPassword } from '../src/password.js';

test('conta privada, entrega confirmada e imutável, senha atual, revogação e persistência', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vestebem-profile-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase(path); await seedDemo(db);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/`;
  const request = (route: string, cookie = '', body?: unknown, method?: string) => fetch(base + route, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const login = async (email: string, password = 'VesteBem2026!') => { const response = await request('login', '', { email, password }); assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0]; };
  const getProfile = async (cookie: string) => (await (await request('me/profile', cookie)).json()).profile;
  let orderId = 0;
  try {
    const ana = await login('ana@demo.vestebem.test'); const bruno = await login('bruno@demo.vestebem.test'); const employee = await login('carla@demo.vestebem.test');
    assert.equal((await request('me/profile')).status, 401);
    assert.equal((await request('me/profile', employee)).status, 403);
    assert.equal((await request('me/address', employee, {}, 'PUT')).status, 403);
    const brunoBefore = await getProfile(bruno);
    const personal = { name: 'Nome Fictício Atualizado', cpf: '000.000.000-00', phone: '(00) 00000-0000', userId: 2, role: 'employee' };
    assert.equal((await request('me/profile', ana, personal, 'PATCH')).status, 200);
    let profile = await getProfile(ana);
    assert.equal(profile.cpf, '00000000000'); assert.equal(profile.phone, '00000000000');
    assert.equal((await (await request('me', ana)).json()).user.name, personal.name);
    assert.equal((await (await request('me', ana)).json()).user.role, 'customer');
    assert.deepEqual(await getProfile(bruno), brunoBefore);
    assert.equal((await request('users/1/profile', employee)).status, 404);
    for (const body of [{ ...personal, name: ' ' }, { ...personal, cpf: 'abc' }, { ...personal, phone: '123' }]) assert.equal((await request('me/profile', ana, body, 'PATCH')).status, 400);
    const delivery = { recipient: 'Destinatário Fictício', postalCode: '00000-000', street: 'Rua Somente de Teste', number: 's/n', complement: 'Exemplo', district: 'Bairro Fictício', city: 'Cidade Fictícia', state: 'SP' };
    assert.equal((await request('me/address', ana, { ...delivery, state: 'XX' }, 'PUT')).status, 400);
    assert.equal((await request('me/address', ana, { ...delivery, postalCode: '123' }, 'PUT')).status, 400);
    assert.equal((await request('me/address', ana, { ...delivery, street: '' }, 'PUT')).status, 400);
    assert.equal((await request('me/address', ana, delivery, 'PUT')).status, 200);
    profile = await getProfile(ana);
    assert.equal(profile.address.postalCode, '00000000');
    const productId = Number(db.prepare('SELECT id FROM products LIMIT 1').get()!.id);
    const items = [{ productId, quantity: 1 }];
    assert.equal((await request('orders', ana, { items })).status, 409);
    assert.equal((await request('orders', ana, { items, confirmDelivery: false, deliveryVersion: profile.deliveryVersion })).status, 409);
    assert.equal((await request('orders', ana, { items, confirmDelivery: true, deliveryVersion: 'fake' })).status, 409);
    const created = await request('orders', ana, { items, confirmDelivery: true, deliveryVersion: profile.deliveryVersion, delivery: { ...delivery, recipient: 'Falso' } });
    assert.equal(created.status, 201); orderId = (await created.json()).order.id;
    const getOrder = async (cookie: string) => (await (await request(`orders/${orderId}`, cookie)).json()).order;
    const saved = (await getOrder(ana)).delivery;
    assert.equal(saved.recipient, delivery.recipient); assert.equal(saved.phone, '00000000000'); assert.ok(!('cpf' in saved));
    assert.deepEqual((await getOrder(employee)).delivery, saved);
    assert.equal((await request(`orders/${orderId}`, bruno)).status, 404);
    assert.equal((await request(`orders/${orderId}`)).status, 401);
    for (const route of ['me', 'orders', `orders/${orderId}`]) { const text = await (await request(route, employee)).text(); assert.ok(!text.includes('cpf')); assert.ok(!text.includes('password')); }
    const legacy = (await (await request('orders/1', employee)).json()).order; assert.equal(legacy.delivery, null);
    await request('me/address', ana, { ...delivery, recipient: 'Outro Destinatário', city: 'Outra Cidade' }, 'PUT');
    await request('me/profile', ana, { ...personal, name: 'Outro Nome Fictício', phone: '0000000000' }, 'PATCH');
    assert.deepEqual((await getOrder(employee)).delivery, saved);
    assert.equal((await request('orders', ana, { items, confirmDelivery: true, deliveryVersion: profile.deliveryVersion })).status, 409);
    // Missing address/phone on a fresh customer blocks finalization.
    await request('register', '', { name: 'Cliente Sem Endereço', email: 'sem@demo.test', password: 'VesteBem2026!' });
    const fresh = await login('sem@demo.test');
    assert.equal((await request('orders', fresh, { items, confirmDelivery: true })).status, 400);
    await request('me/address', fresh, { ...delivery, complement: undefined }, 'PUT');
    assert.equal((await request('orders', fresh, { items, confirmDelivery: true })).status, 400);
    assert.equal((await request('me/password', ana, { currentPassword: 'errada', newPassword: 'NovaSenha2026!' })).status, 400);
    assert.equal((await request('me/password', ana, { currentPassword: 'VesteBem2026!', newPassword: 'curta' })).status, 400);
    assert.equal((await request('me/password', ana, { currentPassword: 'VesteBem2026!', newPassword: 'VesteBem2026!' })).status, 400);
    const otherSession = await login('ana@demo.vestebem.test');
    const changed = await request('me/password', ana, { currentPassword: 'VesteBem2026!', newPassword: 'NovaSenha2026!' });
    assert.equal(changed.status, 200); assert.ok(!(await changed.text()).includes('NovaSenha2026!'));
    assert.equal((await request('me', ana)).status, 401); assert.equal((await request('me', otherSession)).status, 401);
    assert.equal((await request('login', '', { email: 'ana@demo.vestebem.test', password: 'VesteBem2026!' })).status, 401);
    const newSession = await login('ana@demo.vestebem.test', 'NovaSenha2026!'); assert.equal((await request('me', newSession)).status, 200);
    assert.equal((await request('me/password', '', { currentPassword: 'x', newPassword: '12345678' })).status, 401);
    await seedDemo(db); // Do not reset edits or credentials on repeat.
    assert.equal((await getProfile(newSession)).name, 'Outro Nome Fictício');
    assert.equal((await getProfile(newSession)).address.city, 'Outra Cidade');
    await login('ana@demo.vestebem.test', 'NovaSenha2026!');
    assert.equal(db.prepare('SELECT count(*) AS n FROM addresses').get()!.n, 3);
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); db.close(); }
  db = openDatabase(path);
  try {
    const user = db.prepare('SELECT id,name,password_hash FROM users WHERE email=?').get('ana@demo.vestebem.test')!;
    assert.equal(user.name, 'Outro Nome Fictício'); assert.ok(await verifyPassword('NovaSenha2026!', String(user.password_hash)));
    assert.equal(db.prepare('SELECT cpf FROM customer_profiles WHERE user_id=?').get(user.id)!.cpf, '00000000000');
    assert.equal(db.prepare('SELECT city FROM addresses WHERE user_id=?').get(user.id)!.city, 'Outra Cidade');
    assert.equal(db.prepare('SELECT city FROM order_deliveries WHERE order_id=?').get(orderId)!.city, 'Cidade Fictícia');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
