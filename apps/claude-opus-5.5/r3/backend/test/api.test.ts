import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { migrate, openDatabase } from '../src/db.ts';

const db = openDatabase(':memory:');
migrate(db, path.resolve(import.meta.dirname, '..', 'migrations'));
const server = createApp({ db, sessionDays: 7, cookieSecure: false }).listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;

async function call(method: string, url: string, body?: unknown, cookie?: string) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const setCookie = res.headers.get('set-cookie')?.split(';')[0];
  return { status: res.status, text, json: text ? JSON.parse(text) : null, cookie: setCookie };
}

test('fluxo completo de conta', async (t) => {
  t.after(() => server.close());
  const reg = await call('POST', '/auth/register', { name: 'Ana Souza', email: 'Ana@Ex.com', password: 'segredo123' });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.email, 'ana@ex.com');
  assert.ok(!reg.text.includes('segredo123') && !reg.text.includes('password'));

  const dup = await call('POST', '/auth/register', { name: 'Outra', email: 'ANA@ex.com', password: 'outrasenha1' });
  assert.equal(dup.status, 409);

  const invalid = await call('POST', '/auth/register', { name: '', email: 'x', password: '1' });
  assert.equal(invalid.status, 400);

  // Campo "role" enviado pelo cliente é ignorado: o cadastro sempre cria cliente.
  await call('POST', '/auth/register', { name: 'Bob', email: 'bob@ex.com', password: 'senhaBob1', role: 'admin' });
  assert.equal(db.prepare("SELECT role FROM users WHERE email='bob@ex.com'").get()?.role, 'cliente');

  assert.equal((await call('GET', '/account')).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'ana@ex.com', password: 'errada123' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'ninguem@ex.com', password: 'segredo123' })).status, 401);

  const login = await call('POST', '/auth/login', { email: 'ana@ex.com', password: 'segredo123' });
  assert.equal(login.status, 200);
  assert.ok(login.cookie);

  const acc = await call('GET', '/account', undefined, login.cookie);
  assert.equal(acc.status, 200);
  assert.deepEqual(acc.json.user, { id: reg.json.user.id, name: 'Ana Souza', email: 'ana@ex.com', role: 'cliente', cpf: null, phone: null });
  assert.equal(acc.json.address, null);
  assert.ok(!acc.text.includes('password') && !acc.text.includes('scrypt'));

  // Bob não vê dados de Ana: a conta retornada é sempre a da sessão.
  const bob = await call('POST', '/auth/login', { email: 'bob@ex.com', password: 'senhaBob1' });
  assert.equal((await call('GET', '/account', undefined, bob.cookie)).json.user.email, 'bob@ex.com');

  assert.equal((await call('POST', '/auth/logout', undefined, login.cookie)).status, 204);
  // O token encerrado não vale mais, mesmo se reenviado.
  assert.equal((await call('GET', '/account', undefined, login.cookie)).status, 401);
});
