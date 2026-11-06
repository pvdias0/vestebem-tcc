import type { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.js';
import { DEFAULT_DB_PATH, migrate, openDatabase } from './db.js';
import { insertOrder, type OrderStatus, type Role, type Shipping } from './orders.js';
import { cpfWithCheckDigits, upsertAddress, type AddressInput } from './account.js';
import { insertProduct, type ProductInput } from './products.js';

export const DEMO_PRODUCTS: ProductInput[] = [
  { name: 'Camiseta básica branca', description: 'Camiseta 100% algodão, gola careca, corte reto.', category: 'Camisetas', size: 'P', priceCents: 4990, stock: 40 },
  { name: 'Camiseta básica branca', description: 'Camiseta 100% algodão, gola careca, corte reto.', category: 'Camisetas', size: 'M', priceCents: 4990, stock: 35 },
  { name: 'Camiseta básica preta', description: 'Camiseta 100% algodão, gola careca, corte reto.', category: 'Camisetas', size: 'G', priceCents: 4990, stock: 25 },
  { name: 'Camiseta estampada Coleção D\'Água', description: 'Estampa de ondas da Coleção D\'Água. Malha leve.', category: 'Camisetas', size: 'M', priceCents: 6990, stock: 18 },
  { name: 'Calça jeans reta', description: 'Jeans azul médio com elastano, cintura média.', category: 'Calças', size: '40', priceCents: 15990, stock: 12 },
  { name: 'Calça jeans reta', description: 'Jeans azul médio com elastano, cintura média.', category: 'Calças', size: '42', priceCents: 15990, stock: 10 },
  { name: 'Calça de alfaiataria', description: 'Tecido de viscose com caimento fluido e bolsos faca.', category: 'Calças', size: '38', priceCents: 18990, stock: 7 },
  { name: 'Bermuda de sarja', description: 'Bermuda em sarja cáqui, comprimento no joelho.', category: 'Bermudas', size: '42', priceCents: 8990, stock: 20 },
  { name: 'Bermuda de moletom', description: 'Moletom leve com cordão e bolsos laterais.', category: 'Bermudas', size: 'G', priceCents: 7490, stock: 0 },
  { name: 'Vestido midi floral', description: 'Vestido midi em viscose com estampa floral e alças finas.', category: 'Vestidos', size: 'P', priceCents: 18900, stock: 9 },
  { name: 'Vestido longo Coleção D\'Água', description: 'Vestido longo azul-marinho da Coleção D\'Água, tecido leve.', category: 'Vestidos', size: 'M', priceCents: 24900, stock: 5 },
  { name: 'Jaqueta corta-vento', description: 'Jaqueta impermeável com capuz embutido.', category: 'Casacos', size: 'G', priceCents: 22950, stock: 8 },
  { name: 'Jaqueta jeans', description: 'Jaqueta jeans clássica com botões metálicos.', category: 'Casacos', size: 'M', priceCents: 27900, stock: 6 },
  { name: 'Moletom com capuz', description: 'Moletom flanelado com capuz e bolso canguru.', category: 'Casacos', size: 'GG', priceCents: 19990, stock: 14 },
  { name: 'Meia esportiva (par)', description: 'Meia cano médio com reforço no calcanhar.', category: 'Acessórios', size: 'ÚNICO', priceCents: 1500, stock: 100 },
  { name: 'Boné de algodão', description: 'Boné com aba curva e regulagem traseira.', category: 'Acessórios', size: 'ÚNICO', priceCents: 5990, stock: 30 },
  { name: 'Cinto de couro', description: 'Cinto de couro legítimo com fivela prateada.', category: 'Acessórios', size: 'M', priceCents: 8990, stock: 15 },
  { name: 'Saia plissada', description: 'Saia midi plissada com cós elástico.', category: 'Saias', size: 'P', priceCents: 12990, stock: 11 },
];

interface DemoOrder {
  daysAgo: number;
  status: OrderStatus;
  /** Índices em DEMO_PRODUCTS + quantidade. */
  items: { product: number; quantity: number }[];
}
interface DemoUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  /** 9 dígitos-base; os verificadores são calculados. CPFs gerados, fictícios. */
  cpfBase?: string;
  phone?: string;
  address?: AddressInput;
  orders: DemoOrder[];
}

export const DEMO_USERS: DemoUser[] = [
  { name: 'Funcionária Demo', email: 'funcionario@vestebem.demo', password: 'demo1234', role: 'employee', orders: [] },
  {
    name: 'Carla Cliente',
    email: 'carla@vestebem.demo',
    password: 'demo1234',
    role: 'customer',
    cpfBase: '123456789',
    phone: '11990000001',
    address: {
      recipient: 'Carla Cliente',
      cep: '01000000',
      street: 'Rua Fictícia das Flores',
      number: '100',
      complement: 'Apto 12',
      district: 'Bairro Exemplo',
      city: 'São Paulo',
      state: 'SP',
    },
    orders: [
      { daysAgo: 6, status: 'enviado', items: [{ product: 1, quantity: 2 }, { product: 4, quantity: 1 }] },
      { daysAgo: 1, status: 'recebido', items: [{ product: 9, quantity: 1 }] },
    ],
  },
  {
    name: 'Bruno Cliente',
    email: 'bruno@vestebem.demo',
    password: 'demo1234',
    role: 'customer',
    cpfBase: '987654321',
    phone: '2130000002',
    address: {
      recipient: 'Bruno Cliente',
      cep: '20000000',
      street: 'Avenida Imaginária',
      number: 'S/N',
      complement: '',
      district: 'Centro Demo',
      city: 'Rio de Janeiro',
      state: 'RJ',
    },
    orders: [
      { daysAgo: 3, status: 'em_preparacao', items: [{ product: 11, quantity: 1 }, { product: 14, quantity: 3 }] },
      { daysAgo: 2, status: 'cancelado', items: [{ product: 7, quantity: 1 }] },
    ],
  },
];

/**
 * Prepara os dados de demonstração sem duplicar nada:
 * - produtos demo são identificados por nome + tamanho e só são inseridos se não existirem
 *   (edições feitas por funcionários são preservadas);
 * - contas demo são identificadas pelo e-mail (nome, perfil, senha, CPF, telefone e endereço
 *   são restaurados; o endereço é único por usuário, então não duplica);
 * - pedidos demo só são criados para clientes demo que ainda não têm pedidos.
 */
export async function seedDemo(db: DatabaseSync): Promise<{ users: number; products: number; orders: number }> {
  let createdProducts = 0;
  const productIds: number[] = [];
  for (const p of DEMO_PRODUCTS) {
    const found = db.prepare('SELECT id FROM products WHERE name = ? AND size = ? ORDER BY id LIMIT 1').get(p.name, p.size) as
      | { id: number }
      | undefined;
    if (found) productIds.push(found.id);
    else {
      productIds.push(insertProduct(db, p));
      createdProducts++;
    }
  }

  let createdOrders = 0;
  for (const u of DEMO_USERS) {
    const hash = await hashPassword(u.password);
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, role = excluded.role`,
    ).run(u.name, u.email, hash, u.role);
    const { id } = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as { id: number };
    db.prepare('UPDATE users SET cpf = ?, phone = ? WHERE id = ?').run(
      u.cpfBase ? cpfWithCheckDigits(u.cpfBase) : null,
      u.phone ?? null,
      id,
    );
    if (u.address) upsertAddress(db, id, u.address);
    const shipping: Shipping | null = u.address && u.phone ? { ...u.address, phone: u.phone } : null;
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?').get(id) as { n: number };
    if (n > 0 || u.orders.length === 0) continue;
    for (const o of u.orders) {
      const items = o.items.map(({ product, quantity }) => {
        const row = db.prepare('SELECT id, name, price_cents FROM products WHERE id = ?').get(productIds[product]!) as {
          id: number;
          name: string;
          price_cents: number;
        };
        return { productId: row.id, description: row.name, quantity, unitPriceCents: row.price_cents };
      });
      const createdAt = new Date(Date.now() - o.daysAgo * 86_400_000).toISOString();
      const orderId = insertOrder(db, id, items, shipping, createdAt);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(o.status, orderId);
      createdOrders++;
    }
  }
  return { users: DEMO_USERS.length, products: createdProducts, orders: createdOrders };
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  const db = openDatabase();
  migrate(db);
  const r = await seedDemo(db);
  db.close();
  console.log(
    `Dados de demonstração prontos (${r.users} contas; ${r.products} produtos novos; ${r.orders} pedidos novos).`,
  );
  console.log(`Banco: ${DEFAULT_DB_PATH}`);
}
