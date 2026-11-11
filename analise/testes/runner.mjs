// Executa os casos de teste dinâmicos do TCC VesteBem contra uma aplicação em execução.
// Uso: node runner.mjs <app> <baseUrl> <saida.json>
// Cada caso registra observações objetivas e uma sugestão de resultado; a classificação final é do pesquisador.
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Client, LOG, signJwtHS256 } from './http.mjs';
import { ADAPTERS } from './adapters.mjs';

const [app, base, out] = process.argv.slice(2);
const A = ADAPTERS[app];
if (!A) { console.error('adaptador desconhecido', app); process.exit(2); }
const R = {};          // resultados por caso
const ok = s => s >= 200 && s < 300;
const deny = s => s === 401 || s === 403 || s === 404;
const uniq = () => Math.random().toString(36).slice(2, 8);
const CPF_A = '52998224725';                 // CPF sintético válido (dígitos verificadores corretos), não pertence a pessoa real
const XSS = '<img src=x onerror=alert(1)>';
function rec(id, sugestao, obs, extra = {}) { R[id] = { sugestao, obs, ...extra }; console.log(id.padEnd(5), sugestao.padEnd(15), obs.slice(0, 160)); }
function hashKind(h) {
  if (typeof h !== 'string') return 'desconhecido';
  if (/^\$2[aby]\$\d\d\$/.test(h)) return 'bcrypt';
  if (/^\$argon2/.test(h)) return 'argon2';
  if (/^scrypt\$/.test(h) || /^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(h)) return 'scrypt';
  if (/^[0-9a-f]{32}$/i.test(h)) return 'md5?'; if (/^[0-9a-f]{40}$/i.test(h)) return 'sha1?'; if (/^[0-9a-f]{64}$/i.test(h)) return 'sha256?';
  return 'outro';
}
function dbUser(email) {
  const file = process.env.VT_DB; if (!file) return null;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    for (const { name: t } of db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
      const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
      const passCol = cols.find(c => /pass|senha/i.test(c));
      if (!cols.includes('email') || !passCol) continue;
      const row = db.prepare(`SELECT * FROM "${t}" WHERE lower(email) = lower(?)`).get(email);
      if (row) return { table: t, passCol, hash: row[passCol], id: row.id };
    }
    return null;
  } finally { db.close(); }
}
async function loginAs(email, pw, label) { const c = new Client(base, label); const r = await A.login(c, email, pw); return { c, r }; }

try {
  // ---------- preparação ----------
  const { c: E, r: rE } = await loginAs(A.creds.emp, A.creds.empPw, 'funcionario');
  const { c: CA, r: rA } = await loginAs(A.creds.a, A.creds.aPw, 'clienteA');
  const { c: CB, r: rB } = await loginAs(A.creds.b, A.creds.bPw, 'clienteB');
  if (!ok(rE.status) || !ok(rA.status) || !ok(rB.status)) throw new Error(`login de preparação falhou: E=${rE.status} A=${rA.status} B=${rB.status}`);
  const meA = await A.me(CA), meB = await A.me(CB), meE = await A.me(E);
  const idA = A.userId(meA, rA) ?? dbUser(A.creds.a)?.id, idB = A.userId(meB, rB) ?? dbUser(A.creds.b)?.id, idE = A.userId(meE, rE) ?? dbUser(A.creds.emp)?.id;
  // CPF conhecido para A (dados do próprio cliente) — usado no CT22
  const pA = await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: CPF_A, phone: '11988887777' });
  const prods = A.products(await A.listProducts(new Client(base, 'visitante'), {}));
  const prod = prods.find(p => (p.stock ?? 1) > 0) ?? prods[0];
  let ordersB = A.orderIds(await A.listOrders(CB));
  if (!ordersB.length) { await A.createOrder(CB, [{ productId: prod.id, quantity: 1 }]); ordersB = A.orderIds(await A.listOrders(CB)); }
  let ordersA = A.orderIds(await A.listOrders(CA));
  if (!ordersA.length) { await A.createOrder(CA, [{ productId: prod.id, quantity: 1 }]); ordersA = A.orderIds(await A.listOrders(CA)); }
  console.log('prep', { idA, idB, idE, prod: prod?.id, ordersA, ordersB, perfilA: pA.status });

  // ---------- CT01 hash ----------
  const uA = dbUser(A.creds.a);
  rec('CT01', ['bcrypt', 'scrypt', 'argon2'].includes(hashKind(uA?.hash)) ? 'Não vulnerável' : 'Vulnerável', `tabela ${uA?.table}, coluna ${uA?.passCol}; formato ${hashKind(uA?.hash)}; prefixo ${String(uA?.hash).slice(0, 12)}…`);

  // ---------- CT04 sem autenticação ----------
  const V = new Client(base, 'visitante');
  const g = new Client(base, 'token-invalido'); for (const k of A.cookieNames) g.cookies[k] = 'abc123invalido'; g.bearer = 'abc.def.ghi';
  const v1 = await A.me(V), v2 = await A.me(g);
  rec('CT04', deny(v1.status) && deny(v2.status) ? 'Não vulnerável' : 'Vulnerável', `sem cookie → ${v1.status}; token inválido → ${v2.status}`);

  // ---------- CT03 logout ----------
  const { c: S } = await loginAs(A.creds.a, A.creds.aPw, 'clienteA-sessao-logout');
  const before = await A.me(S); const saved = S.clone('clienteA-token-copiado');
  await A.logout(S); const after = await A.me(saved);
  rec('CT03', !ok(before.status) ? 'Não testável' : ok(after.status) ? 'Vulnerável' : 'Não vulnerável', `antes do logout ${before.status}; mesmo token após logout ${after.status}`);

  // ---------- CT05 segredo (falsificação de JWT, quando aplicável) ----------
  if (A.jwt) {
    const F = new Client(base, 'token-forjado'); const tok = signJwtHS256(A.jwt.payload(idE, A.creds.emp), A.jwt.secret);
    F.cookies[A.jwt.cookie] = tok; const fm = await A.me(F); const fr = A.role(fm);
    rec('CT05', ok(fm.status) && fr === 'employee' ? 'Vulnerável' : 'Não vulnerável', `token assinado com o segredo padrão do código para o funcionário → ${fm.status}, perfil ${fr}`);
  } else rec('CT05', 'Ver revisão', 'Sessão não usa JWT; segredo verificado na revisão de código');

  // ---------- CT07 senha fraca ----------
  const w1 = await A.register(new Client(base, 'cadastro'), { name: 'Senha Fraca', email: `fraca1_${uniq()}@teste.local`, password: '1' });
  const w2 = await A.register(new Client(base, 'cadastro'), { name: 'Senha Fraca', email: `fraca3_${uniq()}@teste.local`, password: '123' });
  rec('CT07', ok(w1.status) || ok(w2.status) ? 'Vulnerável' : 'Não vulnerável', `senha "1" → ${w1.status}; senha "123" → ${w2.status}`);

  // ---------- CT08 elevação de perfil ----------
  const roleObs = [];
  let escalated = false;
  for (const val of ['funcionario', 'employee']) {
    const email = `perfil_${val}_${uniq()}@teste.local`;
    const reg = await A.register(new Client(base, 'cadastro-perfil'), { name: 'Perfil Teste', email, password: 'SenhaForte123' },
      { role: val, perfil: val, tipo: val, profile: val, user_role: val, isAdmin: true, is_employee: true });
    const { c, r } = await loginAs(email, 'SenhaForte123', 'novo-usuario');
    const role = ok(r.status) ? A.role(await A.me(c), r) : null;
    roleObs.push(`cadastro com papel "${val}" → ${reg.status}, login ${r.status}, papel ${role}`);
    if (role === 'employee') escalated = true;
  }
  await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: CPF_A, phone: '11988887777' }, { role: 'funcionario', perfil: 'funcionario', tipo: 'funcionario' });
  const roleA = A.role(await A.me(CA), rA);
  roleObs.push(`cliente altera o próprio perfil enviando papel → papel ${roleA}`);
  if (roleA === 'employee') escalated = true;
  rec('CT08', escalated ? 'Vulnerável' : 'Não vulnerável', roleObs.join('; '));

  // ---------- CT09 pedido de outro cliente ----------
  const o9 = await A.getOrder(CA, ordersB[0]);
  rec('CT09', deny(o9.status) ? 'Não vulnerável' : ok(o9.status) ? 'Vulnerável' : 'Verificar', `cliente A pede pedido ${ordersB[0]} (de B) → ${o9.status}`);

  // ---------- CT10 listagens ----------
  const l1 = A.orderIds(await A.listOrders(CA, `?clienteId=${idB}&customerId=${idB}&customer_id=${idB}&userId=${idB}&user_id=${idB}`));
  const leak = l1.filter(x => ordersB.includes(x));
  const vl = await A.listOrders(V), vd = await A.getOrder(V, ordersA[0]);
  const ea = A.employeeListPath ? await CA.get(A.employeeListPath) : null;
  rec('CT10', leak.length || ok(vl.status) || ok(vd.status) || (ea && ok(ea.status)) ? 'Vulnerável' : 'Não vulnerável',
    `listagem do cliente A com filtro de B: ${leak.length} pedido(s) de B; visitante lista → ${vl.status}, detalhe → ${vd.status}` + (ea ? `; cliente A na listagem do painel → ${ea.status}` : ''));

  // ---------- CT11 cliente altera status ----------
  const s1 = await A.setStatus(CA, ordersA[0]), s2 = await A.setStatus(CA, ordersB[0]);
  rec('CT11', ok(s1.status) || ok(s2.status) ? 'Vulnerável' : 'Não vulnerável', `cliente A altera status do próprio pedido → ${s1.status}; do pedido de B → ${s2.status}`);

  // ---------- CT12 dono do pedido ----------
  const nBbefore = A.orderIds(await A.listOrders(CB)).length;
  const c12 = await A.createOrder(CA, [{ productId: prod.id, quantity: 1 }], { customer_id: idB, customerId: idB, clienteId: idB, userId: idB, user_id: idB, usuarioId: idB });
  const nBafter = A.orderIds(await A.listOrders(CB)).length;
  rec('CT12', !ok(c12.status) ? 'Não testável' : nBafter > nBbefore ? 'Vulnerável' : 'Não vulnerável', `pedido criado por A com id de B no corpo → ${c12.status}; pedidos de B antes ${nBbefore}, depois ${nBafter}`);

  // ---------- CT13 validação de itens ----------
  const ctrl13 = await A.createOrder(CA, [{ productId: prod.id, quantity: 1 }]);
  const nA0 = A.orderIds(await A.listOrders(CA)).length; const st13 = [`controle válido → ${ctrl13.status}`];
  for (const q of [0, -1, 1.5, 'abc']) st13.push(`qtd ${JSON.stringify(q)} → ${(await A.createOrder(CA, [{ productId: prod.id, quantity: q }])).status}`);
  st13.push(`sem itens → ${(await A.createOrder(CA, [])).status}`);
  const nA1 = A.orderIds(await A.listOrders(CA)).length;
  rec('CT13', !ok(ctrl13.status) ? 'Não testável' : nA1 > nA0 ? 'Vulnerável' : 'Não vulnerável', st13.join('; ') + `; pedidos de A antes ${nA0}, depois ${nA1}`);

  // ---------- CT14 total/preço manipulados ----------
  const c14 = await A.createOrder(CA, [{ productId: prod.id, quantity: 2, price: 0.01, unit_price: 0.01, unitPrice: 0.01, priceCents: 1, preco: 0.01, precoCentavos: 1 }], { total: 0.01, totalCents: 1, total_cents: 1, totalCentavos: 1 });
  const id14 = A.createdOrderId(c14) ?? A.orderIds(await A.listOrders(CA))[0];
  const t14 = A.orderTotalCents(await A.getOrder(CA, id14));
  const exp14 = A.priceCents(prod) * 2;
  rec('CT14', !ok(c14.status) ? 'Não testável' : t14 === exp14 ? 'Não vulnerável' : 'Vulnerável', `pedido com total/preço manipulados → ${c14.status}; total gravado ${t14} centavos; esperado ${exp14}`);

  // ---------- CT15 pesquisa ----------
  const all = A.products(await A.listProducts(V, {})).length; const o15 = [];
  let bad15 = false;
  for (const q of ["D'Água", "' OR '1'='1", "%' OR 1=1 --", "') UNION SELECT name,sql,1,1,1,1,1,1,1 FROM sqlite_master --"]) {
    const r = await A.listProducts(V, { q }); const n = A.products(r).length;
    const leaked = /CREATE TABLE|sqlite_master/i.test(r.text);
    if (r.status >= 500 || leaked || (q !== "D'Água" && n > 0 && n >= all)) bad15 = true;
    o15.push(`${JSON.stringify(q)} → ${r.status}, ${n} produto(s)${leaked ? ', estrutura do banco exposta' : ''}`);
  }
  rec('CT15', bad15 ? 'Vulnerável' : 'Não vulnerável', `catálogo sem filtro: ${all} na 1ª página; ` + o15.join('; '));

  // ---------- CT16 ordenação/filtros ----------
  const o16 = []; let bad16 = false;
  for (const qs of A.injectionQueries) {
    const r = await V.get(A.productsPath + '?' + qs); const leaked = /CREATE TABLE|sqlite_master|SQLITE_ERROR|syntax error/i.test(r.text);
    if (r.status >= 500 || leaked) bad16 = true; o16.push(`${qs} → ${r.status}${leaked ? ' (erro de SQL exposto)' : ''}`);
  }
  rec('CT16', bad16 ? 'Verificar' : 'Não vulnerável', o16.join('; '));

  // ---------- CT18 produtos sem permissão ----------
  const pb = A.productBody({ name: `Produto Teste ${uniq()}`, description: 'teste', category: 'Teste', size: 'M', price: 10, stock: 1 });
  const p1 = await A.createProduct(V, pb), p2 = await A.createProduct(CA, pb);
  const p3 = await A.updateProduct(CA, prod.id, A.productBody({ name: 'Alterado por cliente', description: 'x', category: 'Teste', size: 'M', price: 1, stock: 1 }));
  rec('CT18', ok(p1.status) || ok(p2.status) || ok(p3.status) ? 'Vulnerável' : 'Não vulnerável', `visitante cria → ${p1.status}; cliente cria → ${p2.status}; cliente altera → ${p3.status}`);

  // ---------- CT17 XSS em produto (armazenamento; renderização avaliada na revisão do frontend) ----------
  const px = await A.createProduct(E, A.productBody({ name: XSS, description: '<script>alert(1)</script>', category: 'Teste', size: 'M', price: 10, stock: 5 }));
  rec('CT17', 'Ver revisão', `funcionário cadastra produto com HTML no nome → ${px.status}; a API devolve o texto bruto, e a execução depende da renderização (React escapa por padrão; nenhum dangerouslySetInnerHTML no frontend)`, { produtoXss: A.productId(px) });

  // ---------- CT19 validação de produto ----------
  const ctrl19 = await A.createProduct(E, A.productBody({ name: `Válido ${uniq()}`, description: 'controle', category: 'Teste', size: 'M', price: 10, stock: 1 }));
  const o19 = [`controle válido → ${ctrl19.status}`]; let bad19 = false;
  for (const [k, v] of [['price', -1], ['stock', -1], ['stock', 2.5], ['stock', 'abc'], ['price', 'abc']]) {
    const body = A.productBody({ name: `Inválido ${uniq()}`, description: 'x', category: 'Teste', size: 'M', price: 10, stock: 1, [k]: v });
    const r = await A.createProduct(E, body); if (ok(r.status)) bad19 = true; o19.push(`${k}=${JSON.stringify(v)} → ${r.status}`);
  }
  rec('CT19', !ok(ctrl19.status) ? 'Não testável' : bad19 ? 'Vulnerável' : 'Não vulnerável', o19.join('; '));

  // ---------- CT20 produto inexistente ----------
  const o20 = []; let bad20 = false;
  for (const pid of [999999, null, 'abc']) { const r = await A.createOrder(CA, [{ productId: pid, quantity: 1 }]); if (ok(r.status) || r.status >= 500) bad20 = true; o20.push(`produto ${JSON.stringify(pid)} → ${r.status}`); }
  rec('CT20', !ok(ctrl13.status) ? 'Não testável' : bad20 ? 'Vulnerável' : 'Não vulnerável', o20.join('; '));

  // ---------- CT21 dados de outro cliente ----------
  const bBefore = JSON.stringify((await A.account(CB)).json);
  await A.updateProfile(CA, { name: 'Invasor', cpf: CPF_A, phone: '11911112222' }, { id: idB, userId: idB, user_id: idB, usuarioId: idB, clienteId: idB, customerId: idB });
  await A.updateAddress(CA, { recipient: 'Invasor', cep: '01001000', street: 'Rua Invasora', number: '1', complement: '', district: 'Centro', city: 'São Paulo', state: 'SP' }, { id: idB, userId: idB, user_id: idB, usuarioId: idB });
  const bAfter = JSON.stringify((await A.account(CB)).json);
  const q21 = await A.accountQuery(CA, idB);
  const leak21 = q21 && JSON.stringify(q21.json ?? '').includes(A.creds.b);
  rec('CT21', bAfter !== bBefore || leak21 ? 'Vulnerável' : 'Não vulnerável', `dados de B alterados: ${bAfter !== bBefore ? 'sim' : 'não'}; consulta com id de B devolve dados de B: ${leak21 ? 'sim' : 'não'}`);
  await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: CPF_A, phone: '11988887777' });

  // ---------- CT27 XSS em endereço (armazenamento) ----------
  await A.updateAddress(CA, { recipient: XSS, cep: '01001000', street: 'Rua Teste', number: '10', complement: XSS, district: 'Centro', city: 'São Paulo', state: 'SP' });
  const c27 = await A.createOrder(CA, [{ productId: prod.id, quantity: 1 }]);
  rec('CT27', 'Ver revisão', `endereço com HTML usado em pedido → ${c27.status}; renderização avaliada no frontend`, { pedidoXss: A.createdOrderId(c27) });
  await A.updateAddress(CA, { recipient: 'Cliente A Teste', cep: '01001000', street: 'Rua Teste', number: '10', complement: '', district: 'Centro', city: 'São Paulo', state: 'SP' });

  // ---------- CT22 CPF para funcionário ----------
  const empTexts = [(await A.employeeListOrders(E)).text];
  for (const id of A.orderIds(await A.listOrders(CA)).slice(0, 5)) empTexts.push((await A.getOrder(E, id)).text);
  const fmt = CPF_A.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const cpfLeak = empTexts.some(t => t.includes(CPF_A) || t.includes(fmt));
  rec('CT22', cpfLeak ? 'Vulnerável' : 'Não vulnerável', `CPF de A (${fmt}) nas respostas da listagem e de ${empTexts.length - 1} detalhes vistos pelo funcionário: ${cpfLeak ? 'presente' : 'ausente'}`);

  // ---------- CT28 validação de dados pessoais ----------
  const ctrlP = await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: CPF_A, phone: '11988887777' });
  const ctrlE = await A.updateAddress(CA, { recipient: 'Cliente A Teste', cep: '01001000', street: 'Rua Teste', number: '10', complement: '', district: 'Centro', city: 'São Paulo', state: 'SP' });
  const o28 = [`controles válidos → perfil ${ctrlP.status}, endereço ${ctrlE.status}`]; let bad28 = false;
  const r28a = await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: 'abc', phone: '11988887777' }); o28.push(`CPF "abc" → ${r28a.status}`); if (ok(r28a.status)) bad28 = true;
  const r28b = await A.updateAddress(CA, { recipient: 'A', cep: '123', street: 'Rua', number: '1', complement: '', district: 'B', city: 'C', state: 'SP' }); o28.push(`CEP "123" → ${r28b.status}`); if (ok(r28b.status)) bad28 = true;
  const r28c = await A.updateAddress(CA, { recipient: 'A', cep: '01001000', street: 'Rua', number: '1', complement: '', district: 'B', city: 'C', state: 'X'.repeat(50) }); o28.push(`estado com 50 caracteres → ${r28c.status}`); if (ok(r28c.status)) bad28 = true;
  rec('CT28', !ok(ctrlP.status) || !ok(ctrlE.status) ? 'Verificar' : bad28 ? 'Vulnerável' : 'Não vulnerável', o28.join('; '));
  await A.updateProfile(CA, { name: 'Cliente A Teste', cpf: CPF_A, phone: '11988887777' });
  await A.updateAddress(CA, { recipient: 'Cliente A Teste', cep: '01001000', street: 'Rua Teste', number: '10', complement: '', district: 'Centro', city: 'São Paulo', state: 'SP' });

  // ---------- CT23 troca de senha sem a senha atual ----------
  const o23 = [];
  for (const cur of ['senha-errada-123', '', undefined]) o23.push(`atual=${JSON.stringify(cur)} → ${(await A.changePassword(CA, cur, 'NovaSenhaTeste123')).status}`);
  const still = (await loginAs(A.creds.a, A.creds.aPw, 'clienteA-confere')).r.status;
  rec('CT23', ok(still) ? 'Não vulnerável' : 'Vulnerável', o23.join('; ') + `; senha original ainda funciona → ${still}`);

  // ---------- CT25 / CT24 / CT26 troca de senha ----------
  const { c: S1 } = await loginAs(A.creds.a, A.creds.aPw, 'clienteA-sessao1');
  const { c: S2 } = await loginAs(A.creds.a, A.creds.aPw, 'clienteA-sessao2');
  const NEW = 'NovaSenhaTeste123';
  const ch = await A.changePassword(S1, A.creds.aPw, NEW);
  const s2me = await A.me(S2);
  rec('CT25', !ok(ch.status) ? 'Não testável' : ok(s2me.status) ? 'Vulnerável' : 'Não vulnerável', `troca de senha na sessão 1 → ${ch.status}; sessão 2 depois da troca → ${s2me.status}`);
  const lo = (await loginAs(A.creds.a, A.creds.aPw, 'login-senha-antiga')).r.status;
  const ln = (await loginAs(A.creds.a, NEW, 'login-senha-nova')).r.status;
  rec('CT24', !ok(ch.status) ? 'Não testável' : ok(lo) || !ok(ln) ? 'Vulnerável' : 'Não vulnerável', `login com a senha antiga → ${lo}; com a nova → ${ln}`);
  const uA2 = dbUser(A.creds.a);
  rec('CT26', !ok(ch.status) ? 'Não testável' : ['bcrypt', 'scrypt', 'argon2'].includes(hashKind(uA2?.hash)) && uA2?.hash !== uA?.hash ? 'Não vulnerável' : 'Vulnerável', `formato após a troca ${hashKind(uA2?.hash)}; hash mudou: ${uA2?.hash !== uA?.hash}`);

  // ---------- CT02 senha/hash nas respostas (todas as respostas coletadas até aqui) ----------
  const hashes = [uA?.hash, uA2?.hash].filter(Boolean);
  const plain = [A.creds.aPw, A.creds.bPw, A.creds.empPw, 'NovaSenhaTeste123', 'SenhaForte123'].filter(Boolean);
  const hit = LOG.filter(l => /"(password_hash|senha_hash|passwordHash|senhaHash|hashed_password)"\s*:/i.test(l.response)
    || /\$2[aby]\$\d\d\$|scrypt\$[A-Za-z0-9+/=]{8,}|\b[0-9a-f]{32}:[0-9a-f]{128}\b/.test(l.response)
    || hashes.some(h => l.response.includes(h)) || plain.some(pw => l.response.includes(`"${pw}"`)));
  rec('CT02', hit.length ? 'Vulnerável' : 'Não vulnerável', `${LOG.length} respostas inspecionadas; com campo de senha/hash: ${hit.length}` + (hit[0] ? ` (ex.: ${hit[0].method} ${hit[0].path})` : ''));

  // ---------- CT06 tentativas de login (por último, pois aciona limitadores) ----------
  const tries = []; for (let i = 0; i < 30; i++) tries.push((await A.login(new Client(base, 'forca-bruta'), A.creds.b, 'errada' + i)).status);
  const blocked = tries.filter(s => s === 429 || s === 423 || s === 403).length;
  rec('CT06', blocked ? 'Não vulnerável' : 'Vulnerável', `30 tentativas com senha errada: ${tries.filter(s => s === 401 || s === 400).length} recusadas normalmente, ${blocked} bloqueadas (429/423/403)`);
} catch (e) {
  console.error('ERRO', e.stack); R._erro = String(e.stack);
}
writeFileSync(out, JSON.stringify({ app, base, executadoEm: new Date().toISOString(), node: process.version, resultados: R, requisicoes: LOG }, null, 1));
console.log('salvo', out, Object.keys(R).length, 'casos');
