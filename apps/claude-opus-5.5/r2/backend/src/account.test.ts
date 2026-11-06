import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpfWithCheckDigits, isValidCpf } from './account.js';
import { createApp } from './app.js';
import { migrate, openDatabase } from './db.js';
import { seedDemo } from './seed.js';
import { startTestServer } from './testutil.js';

const ADDRESS = {
  recipient: "Maria D'Ávila",
  cep: '12345-678',
  street: 'Rua de Teste',
  number: '42',
  complement: '',
  district: 'Bairro Teste',
  city: 'Cidade Teste',
  state: 'mg',
};

test('CPF: dígitos verificadores', () => {
  assert.ok(isValidCpf(cpfWithCheckDigits('123456789')));
  assert.ok(!isValidCpf('12345678900'));
  assert.ok(!isValidCpf('11111111111'));
});

test('minha conta: dados pessoais, endereço, senha e entrega nos pedidos', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  await seedDemo(db);
  const { server, call, login } = await startTestServer(db);
  try {
    // visitante
    for (const [m, path] of [['GET', '/api/account'], ['PUT', '/api/account/profile'], ['PUT', '/api/account/address'], ['PUT', '/api/account/password']] as const)
      assert.equal((await call(m, path, m === 'GET' ? undefined : {})).status, 401, path);

    // novo cliente sem endereço
    const reg = await call('POST', '/api/auth/register', { name: 'Nova', email: 'nova@ex.com', password: 'senha12345' });
    const nova = reg.cookie;
    const acc0 = (await call('GET', '/api/account', undefined, nova)).json;
    assert.deepEqual(acc0.profile, { name: 'Nova', cpf: '', phone: '' });
    assert.equal(acc0.address, null);

    const meia = (db.prepare("SELECT id FROM products WHERE name LIKE 'Meia%'").get() as { id: number }).id;
    const items = [{ productId: meia, quantity: 1 }];
    let r = await call('POST', '/api/orders', { items, confirmShipping: true }, nova);
    assert.equal(r.status, 400);
    assert.match(r.json.error, /endereço/);

    // perfil: validações
    const cpf = cpfWithCheckDigits('390533447');
    for (const bad of [{ name: 'N', cpf: '', phone: '' }, { name: 'Nova', cpf: '12345678900', phone: '' }, { name: 'Nova', cpf: '', phone: '123' }])
      assert.equal((await call('PUT', '/api/account/profile', bad, nova)).status, 400, JSON.stringify(bad));
    const carlaCpf = cpfWithCheckDigits('123456789');
    assert.equal((await call('PUT', '/api/account/profile', { name: 'Nova', cpf: carlaCpf, phone: '' }, nova)).status, 409, 'CPF único');
    r = await call('PUT', '/api/account/profile', { name: 'Nova Silva', cpf: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, phone: '(31) 99999-0000' }, nova);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.profile, { name: 'Nova Silva', cpf, phone: '31999990000' });
    assert.equal((await call('GET', '/api/me', undefined, nova)).json.user.name, 'Nova Silva');
    assert.ok(!JSON.stringify((await call('GET', '/api/me', undefined, nova)).json).includes(cpf), '/api/me não expõe CPF');

    // endereço: validações e cadastro
    for (const patch of [{ cep: '123' }, { state: 'XX' }, { street: '' }, { number: '' }, { recipient: '' }, { district: '' }, { city: '' }])
      assert.equal((await call('PUT', '/api/account/address', { ...ADDRESS, ...patch }, nova)).status, 400, JSON.stringify(patch));
    r = await call('PUT', '/api/account/address', ADDRESS, nova);
    assert.equal(r.status, 200);
    assert.equal(r.json.address.cep, '12345678');
    assert.equal(r.json.address.state, 'MG');
    const addressUpdatedAt = r.json.address.updatedAt as string;

    // pedido exige confirmação; versão do endereço precisa bater
    assert.equal((await call('POST', '/api/orders', { items }, nova)).status, 400);
    assert.equal((await call('POST', '/api/orders', { items, confirmShipping: true, addressUpdatedAt: '2000-01-01' }, nova)).status, 409);
    r = await call('POST', '/api/orders', { items, confirmShipping: true, addressUpdatedAt }, nova);
    assert.equal(r.status, 201);
    const orderId = r.json.order.id as number;
    const expectedShipping = { ...ADDRESS, cep: '12345678', state: 'MG', phone: '31999990000' };
    assert.deepEqual(r.json.order.shipping, expectedShipping);

    // alterações posteriores na conta não mudam o pedido
    await call('PUT', '/api/account/address', { ...ADDRESS, street: 'Rua Nova', recipient: 'Outra Pessoa' }, nova);
    await call('PUT', '/api/account/profile', { name: 'Nova Silva', cpf, phone: '31888880000' }, nova);
    assert.deepEqual((await call('GET', `/api/orders/${orderId}`, undefined, nova)).json.order.shipping, expectedShipping);

    // funcionário vê dados de entrega, mas nunca o CPF
    const func = await login('funcionario@vestebem.demo');
    const asEmployee = await call('GET', `/api/orders/${orderId}`, undefined, func);
    assert.deepEqual(asEmployee.json.order.shipping, expectedShipping);
    assert.ok(!asEmployee.text.includes(cpf));
    const listEmployee = await call('GET', '/api/orders', undefined, func);
    assert.ok(!listEmployee.text.includes(cpf) && !listEmployee.text.includes(carlaCpf));
    // funcionário consulta a própria conta, não a de clientes (não há rota por id)
    assert.ok(!(await call('GET', '/api/account', undefined, func)).text.includes(cpf));

    // outro cliente não vê os dados desta conta
    const carla = await login('carla@vestebem.demo');
    const carlaAcc = await call('GET', '/api/account', undefined, carla);
    assert.equal(carlaAcc.json.profile.cpf, carlaCpf);
    assert.ok(!carlaAcc.text.includes(cpf));
    assert.equal(carlaAcc.json.address.recipient, 'Carla Cliente');

    // senha
    const outraSessao = (await call('POST', '/api/auth/login', { email: 'nova@ex.com', password: 'senha12345' })).cookie;
    assert.equal((await call('PUT', '/api/account/password', { currentPassword: 'errada', newPassword: 'novaSenha123' }, nova)).status, 400);
    assert.equal((await call('PUT', '/api/account/password', { currentPassword: 'senha12345', newPassword: 'curta' }, nova)).status, 400);
    r = await call('PUT', '/api/account/password', { currentPassword: 'senha12345', newPassword: 'novaSenha123' }, nova);
    assert.equal(r.status, 200);
    assert.ok(!/senha12345|novaSenha123|password_hash|scrypt/.test(r.text));
    assert.equal((await call('GET', '/api/me', undefined, nova)).status, 200, 'sessão atual continua');
    assert.equal((await call('GET', '/api/me', undefined, outraSessao)).status, 401, 'demais sessões encerradas');
    assert.equal((await call('POST', '/api/auth/login', { email: 'nova@ex.com', password: 'senha12345' })).status, 401, 'senha antiga rejeitada');
    assert.equal((await call('POST', '/api/auth/login', { email: 'nova@ex.com', password: 'novaSenha123' })).status, 200, 'nova senha aceita');

    // nenhuma resposta de conta contém senha/hash
    assert.ok(!/password/i.test((await call('GET', '/api/account', undefined, nova)).text));

    // pedidos demo têm entrega; seed idempotente não duplica endereços
    const demo = (await call('GET', '/api/orders', undefined, carla)).json.orders as { shipping: unknown }[];
    assert.ok(demo.every((o) => o.shipping !== null));
    await seedDemo(db);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM addresses').get() as { n: number }).n, 3);
  } finally {
    server.close();
    db.close();
  }
});

test('dados persistem ao reabrir o banco em arquivo', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'vb-'));
  const file = join(dir, 't.db');
  try {
    let db = openDatabase(file);
    migrate(db);
    await seedDemo(db);
    db.prepare("UPDATE addresses SET street = 'Rua Persistida' WHERE recipient = 'Carla Cliente'").run();
    db.close();
    db = openDatabase(file);
    migrate(db);
    const app = createApp(db);
    assert.ok(app);
    const row = db.prepare("SELECT a.street, u.cpf, u.phone FROM addresses a JOIN users u ON u.id = a.user_id WHERE u.email = 'carla@vestebem.demo'").get() as {
      street: string; cpf: string; phone: string;
    };
    assert.equal(row.street, 'Rua Persistida');
    assert.equal(row.cpf, cpfWithCheckDigits('123456789'));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
