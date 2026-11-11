// Cliente HTTP mínimo com cookie jar e registro de evidências (Node >= 22, sem dependências).
import { createHmac } from 'node:crypto';
export const LOG = [];
export class Client {
  constructor(base, label) { this.base = base; this.label = label; this.cookies = {}; this.bearer = null; }
  clone(label) { const c = new Client(this.base, label); c.cookies = { ...this.cookies }; c.bearer = this.bearer; return c; }
  cookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const ck = this.cookieHeader(); if (ck) headers['Cookie'] = ck;
    if (this.bearer) headers['Authorization'] = `Bearer ${this.bearer}`;
    let status = 0, text = '', json = null;
    try {
      const r = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
      status = r.status;
      for (const sc of r.headers.getSetCookie?.() ?? []) {
        const [pair, ...attrs] = sc.split(';'); const i = pair.indexOf('='); const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
        const expired = attrs.some(a => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
        if (!v || expired) delete this.cookies[k]; else this.cookies[k] = v;
      }
      text = await r.text(); try { json = JSON.parse(text); } catch { json = null; }
    } catch (e) { text = 'ERRO_DE_REDE: ' + e.message; }
    LOG.push({ who: this.label, method, path, body, status, response: text.length > 4000 ? text.slice(0, 4000) + '…' : text });
    return { status, json, text };
  }
  get(p, h) { return this.req('GET', p, undefined, h); }
  post(p, b, h) { return this.req('POST', p, b ?? {}, h); }
  put(p, b) { return this.req('PUT', p, b ?? {}); }
  patch(p, b) { return this.req('PATCH', p, b ?? {}); }
}
export function signJwtHS256(payload, secret) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...payload });
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
