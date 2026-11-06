import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { isValidCpf } from '../src/account.ts';
import { migrate, openDatabase } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { migrationsDir } from './helpers.ts';

const ADDRESS = { recipient: 'Ana Dest', cep: '01000-000', street: 'Rua Fictícia', number: '10', complement: 'Casa 2',
  district: 'Bairro', city: 'Cidade', state: 'sp' };

/** Servidor sobre um arquivo real, para testar persistência após "reiniciar". */
function start(file: string) {
  const db = openDatabase(file);
  migrate(db, migrationsDir);
  const server = createApp({ db, sessionDays: 7, cookieSecure: false }).listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  async function call(method: string, url: string, body?: unknown, cookie?: string) {
    const res = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = text ? JSON.parse(text) : null;
    return { status: res.status, json, text, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const stop = () => new Promise<void>((r) => {
    server.close(() => { db.close(); r(); });
    server.closeAllConnections(); // conexões keep-alive do fetch impediriam o close
  });
  return { db, call, stop };
}

test('CPF: dígitos verificadores', () => {
  assert.ok(isValidCpf('12345678909'));
  assert.ok(!isValidCpf('12345678900'));
  assert.ok(!isValidCpf('11111111111'));
  assert.ok(!isValidCpf('1234567890'));
});

test('minha conta: dados pessoais, endereço, senha e persistência', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-acc-'));
  const file = path.join(tmp, 'db.sqlite');
  let s = start(file);
  const reg = await s.call('POST', '/auth/register', { name: 'Ana', email: 'ana@ex.com', password: 'senha1234' });
  const ana = reg.cookie!;
  const bob = (await s.call('POST', '/auth/register', { name: 'Bob', email: 'bob@ex.com', password: 'senha1234' })).cookie!;

  // Visitante não acessa
  for (const [m, u] of [['GET', '/account'], ['PUT', '/account/profile'], ['PUT', '/account/address'], ['PUT', '/account/password']] as const)
    assert.equal((await s.call(m, u, m === 'GET' ? undefined : {})).status, 401, u);

  // Dados pessoais: validação
  const prof = (body: object) => s.call('PUT', '/account/profile', body, ana);
  assert.equal((await prof({ name: 'Ana', cpf: '123.456.789-00' })).status, 400);
  assert.equal((await prof({ name: 'Ana', phone: '123' })).status, 400);
  assert.equal((await prof({ name: '' })).status, 400);
  // Campos extras (role, email) são ignorados
  const ok = await prof({ name: 'Ana Maria', cpf: '123.456.789-09', phone: '(11) 90000-0001', role: 'funcionario', email: 'x@x.com' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.user, { id: reg.json.user.id, name: 'Ana Maria', email: 'ana@ex.com', role: 'cliente', cpf: '12345678909', phone: '11900000001' });
  // CPF único entre contas
  assert.equal((await s.call('PUT', '/account/profile', { name: 'Bob', cpf: '12345678909' }, bob)).status, 400);

  // Endereço: validação e cadastro/atualização
  const addr = (body: object, c = ana) => s.call('PUT', '/account/address', body, c);
  assert.equal((await addr({ ...ADDRESS, cep: '123' })).status, 400);
  assert.equal((await addr({ ...ADDRESS, state: 'XX' })).status, 400);
  assert.equal((await addr({ ...ADDRESS, street: '' })).status, 400);
  assert.equal((await addr({ ...ADDRESS, complement: '' })).json.address.complement, null);
  const upd = await addr({ ...ADDRESS, number: '99' });
  assert.equal(upd.json.address.number, '99');
  assert.equal(upd.json.address.cep, '01000000');
  assert.equal(upd.json.address.state, 'SP');
  assert.equal(Number(s.db.prepare('SELECT COUNT(*) AS n FROM addresses').get()?.n), 1);

  // Isolamento: Bob só vê os próprios dados
  const bobAcc = await s.call('GET', '/account', undefined, bob);
  assert.equal(bobAcc.json.user.email, 'bob@ex.com');
  assert.equal(bobAcc.json.user.cpf, null);
  assert.equal(bobAcc.json.address, null);
  assert.ok(!bobAcc.text.includes('12345678909'));

  // Senha
  const other = (await s.call('POST', '/auth/login', { email: 'ana@ex.com', password: 'senha1234' })).cookie!;
  const pw = (body: object) => s.call('PUT', '/account/password', body, ana);
  assert.equal((await pw({ currentPassword: 'errada123', newPassword: 'novaSenha99' })).status, 400);
  assert.equal((await pw({ currentPassword: 'senha1234', newPassword: 'curta' })).status, 400);
  assert.equal((await pw({ currentPassword: 'senha1234', newPassword: 'senha1234' })).status, 400);
  const changed = await pw({ currentPassword: 'senha1234', newPassword: 'novaSenha99' });
  assert.equal(changed.status, 204);
  assert.equal(changed.text, '');
  assert.equal((await s.call('GET', '/account', undefined, ana)).status, 200, 'sessão atual continua');
  assert.equal((await s.call('GET', '/account', undefined, other)).status, 401, 'outras sessões encerradas');
  assert.equal((await s.call('POST', '/auth/login', { email: 'ana@ex.com', password: 'senha1234' })).status, 401);
  assert.equal((await s.call('POST', '/auth/login', { email: 'ana@ex.com', password: 'novaSenha99' })).status, 200);
  const acc = await s.call('GET', '/account', undefined, ana);
  assert.ok(!acc.text.includes('password') && !acc.text.includes('scrypt'));

  // Reiniciar: dados persistem
  await s.stop();
  s = start(file);
  const after = await s.call('POST', '/auth/login', { email: 'ana@ex.com', password: 'novaSenha99' });
  assert.equal(after.status, 200);
  const persisted = (await s.call('GET', '/account', undefined, after.cookie)).json;
  assert.equal(persisted.user.cpf, '12345678909');
  assert.equal(persisted.user.phone, '11900000001');
  assert.equal(persisted.address.number, '99');
  await s.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('seed: dados de entrega fictícios, idempotente e sem sobrescrever alterações', async () => {
  const db = openDatabase(':memory:');
  migrate(db, migrationsDir);
  await seed(db, () => {});
  const count = () => db.prepare(`SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM addresses) a,
    (SELECT COUNT(*) FROM orders) o, (SELECT COUNT(*) FROM products) p`).get();
  const first = { ...count() };
  assert.equal(first.a, 2);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE ship_recipient IS NOT NULL').get()?.n), 4);
  db.exec("UPDATE addresses SET street = 'Alterada pelo usuário' WHERE user_id = 1");
  await seed(db, () => {});
  assert.deepEqual({ ...count() }, first);
  assert.equal(db.prepare('SELECT street FROM addresses WHERE user_id = 1').get()?.street, 'Alterada pelo usuário');
  // Cliente sem endereço para experimentar o bloqueio do pedido
  const dani = db.prepare("SELECT u.cpf, u.phone, a.user_id AS addr FROM users u LEFT JOIN addresses a ON a.user_id = u.id WHERE email = 'daniela@demo.vestebem'").get();
  assert.deepEqual({ ...dani }, { cpf: null, phone: null, addr: null });
});
