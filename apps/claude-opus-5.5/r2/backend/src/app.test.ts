import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { migrate, openDatabase } from './db.js';

test('fluxo completo de autenticação', async () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown, cookie?: string) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const setCookie = res.headers.get('set-cookie') ?? '';
    return { status: res.status, text, json: text ? JSON.parse(text) : null, cookie: setCookie.split(';')[0] ?? '' };
  };

  try {
    const reg = await call('POST', '/api/auth/register', { name: 'Ana', email: 'Ana@Ex.com', password: 'segredo123', role: 'admin' });
    assert.equal(reg.status, 201);
    assert.ok(!reg.text.includes('segredo') && !reg.text.includes('password'));
    const row = db.prepare('SELECT role FROM users').get() as { role: string };
    assert.equal(row.role, 'customer');

    const dup = await call('POST', '/api/auth/register', { name: 'Outra', email: 'ana@ex.com', password: 'segredo123' });
    assert.equal(dup.status, 409);
    assert.equal((await call('POST', '/api/auth/register', { name: 'A', email: 'x', password: '1' })).status, 400);

    assert.equal((await call('POST', '/api/auth/login', { email: 'ana@ex.com', password: 'errada123' })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { email: 'x@ex.com', password: 'segredo123' })).status, 401);
    assert.equal((await call('GET', '/api/me')).status, 401);

    const login = await call('POST', '/api/auth/login', { email: 'ANA@ex.com', password: 'segredo123' });
    assert.equal(login.status, 200);
    const me = await call('GET', '/api/me', undefined, login.cookie);
    assert.deepEqual(me.json.user, { id: 1, name: 'Ana', email: 'ana@ex.com', role: 'customer' });
    assert.ok(!me.text.includes('password'));

    assert.equal((await call('POST', '/api/auth/logout', undefined, login.cookie)).status, 204);
    assert.equal((await call('GET', '/api/me', undefined, login.cookie)).status, 401, 'token antigo não vale após sair');
  } finally {
    server.close();
    db.close();
  }
});
