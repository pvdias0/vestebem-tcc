import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { createApp } from './app.js';

/** Sobe a API numa porta livre e devolve helpers de chamada HTTP (usado só pelos testes). */
export async function startTestServer(db: DatabaseSync) {
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
    return {
      status: res.status,
      text,
      json: (text ? JSON.parse(text) : null) as any,
      cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '',
    };
  };
  const login = async (email: string, password = 'demo1234') =>
    (await call('POST', '/api/auth/login', { email, password })).cookie;
  return { server, call, login };
}
