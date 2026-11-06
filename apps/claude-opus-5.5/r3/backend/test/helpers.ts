import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { migrate, openDatabase } from '../src/db.ts';
import { hashPassword } from '../src/security.ts';

export const migrationsDir = path.resolve(import.meta.dirname, '..', 'migrations');

/** Sobe a API num banco em memória com um funcionário (func@ex.com / func12345). */
export async function startTestServer() {
  const db = openDatabase(':memory:');
  migrate(db, migrationsDir);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Func', 'func@ex.com', ?, 'funcionario')")
    .run(await hashPassword('func12345'));
  const server = createApp({ db, sessionDays: 7, cookieSecure: false }).listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;

  async function call(method: string, url: string, body?: unknown, cookie?: string) {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = text ? JSON.parse(text) : null;
    return { status: res.status, json, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const register = async (name: string, email: string) =>
    (await call('POST', '/auth/register', { name, email, password: 'senha1234' })).cookie;
  const staff = (await call('POST', '/auth/login', { email: 'func@ex.com', password: 'func12345' })).cookie;

  return { db, server, call, register, staff, close: () => server.close() };
}
