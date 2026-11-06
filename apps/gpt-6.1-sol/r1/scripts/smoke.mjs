for (const [url, expected] of [
  ['http://127.0.0.1:3001/minha-conta', 200],
  ['http://127.0.0.1:5173/login', 200],
  ['http://127.0.0.1:3001/api/me', 401],
  ['http://127.0.0.1:5173/api/me', 401],
  ['http://127.0.0.1:3001/meus-pedidos', 200],
  ['http://127.0.0.1:3001/pedidos/1', 200],
  ['http://127.0.0.1:3001/funcionario', 200],
  ['http://127.0.0.1:3001/api/orders', 401],
  ['http://127.0.0.1:3001/api/orders/1', 401],
  ['http://127.0.0.1:3001/produtos', 200],
  ['http://127.0.0.1:3001/api/products', 200],
  ['http://127.0.0.1:5173/api/products', 200],
]) {
  const response = await fetch(url);
  if (response.status !== expected) throw new Error(`${url}: ${response.status}, esperado ${expected}`);
  console.log(`${url}: HTTP ${response.status}`);
}

const productionUrl = process.argv[2];
if (productionUrl) {
  const page = await fetch(`${productionUrl}/produtos`);
  if (page.status !== 200 || !(await page.text()).includes('/assets/')) throw new Error('Frontend de produção não encontrado');
  const response = await fetch(`${productionUrl}/api/products`);
  const data = await response.json();
  if (response.status !== 200 || data.pageSize !== 12 || data.products.length !== 12 || data.total < 15) throw new Error('Catálogo de produção inválido');
  const detail = await fetch(`${productionUrl}/api/products/${data.products[0].id}`);
  if (detail.status !== 200) throw new Error('Detalhe público inválido');
  console.log(`Build de produção e catálogo real em ${productionUrl}: OK (${data.total} produtos)`);
  for (const email of ['ana@demo.vestebem.test', 'carla@demo.vestebem.test']) {
    const login = await fetch(`${productionUrl}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'VesteBem2026!' }) });
    if (login.status !== 200) throw new Error('Falha no login de produção');
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const profileResponse = await fetch(`${productionUrl}/api/me/profile`, { headers: { cookie } });
    if (email.startsWith('ana')) {
      const { profile } = await profileResponse.json();
      if (profileResponse.status !== 200 || !profile.address || !profile.phone || !profile.deliveryVersion || !profile.cpf) throw new Error('Perfil fictício de produção incompleto');
      console.log('Perfil e endereço persistidos disponíveis ao próprio cliente: OK');
    } else {
      if (profileResponse.status !== 403) throw new Error('Funcionário acessou dados pessoais de cliente');
      console.log('Funcionário sem acesso ao perfil privado: OK');
    }
    await fetch(`${productionUrl}/api/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' });
  }
}

// Requires npm run db:demo. Only logs in and reads existing demonstration data.
for (const [email, role] of [['ana@demo.vestebem.test', 'customer'], ['bruno@demo.vestebem.test', 'customer'], ['carla@demo.vestebem.test', 'employee']]) {
  const login = await fetch('http://localhost:3001/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001' }, body: JSON.stringify({ email, password: 'VesteBem2026!' }) });
  if (login.status !== 200) throw new Error(`Login de demonstração: ${login.status}`);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const user = (await login.json()).user;
  if (user.role !== role) throw new Error('Perfil inesperado');
  const response = await fetch('http://localhost:3001/api/orders', { headers: { cookie } });
  const { orders } = await response.json();
  if (response.status !== 200 || orders.length === 0 || (role === 'customer' && orders.some(order => order.customerId !== user.id))) throw new Error('Listagem de demonstração inválida');
  for (const order of orders) {
    const detail = await fetch(`http://localhost:3001/api/orders/${order.id}`, { headers: { cookie } });
    if (detail.status !== 200 || !(await detail.json()).order.items.length) throw new Error('Detalhes de demonstração inválidos');
  }
  await fetch('http://localhost:3001/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' });
  console.log(`Login e pedidos reais: ${role}, ${email}, ${orders.length} pedido(s)`);
}
