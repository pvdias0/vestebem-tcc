// Prepara dados fictícios de demonstração. Idempotente: pode ser executado várias vezes.
import type { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';
import { migrate, openDatabase } from './db.ts';
import { insertOrder, shippingFromAccount, type ItemSnapshot } from './orders.ts';
import type { AddressInput } from './account.ts';
import { hashPassword } from './security.ts';

type P = [name: string, category: string, size: string, priceCents: number, stock: number, description: string];

/** Produtos de demonstração. Identificados por (nome, tamanho) para não duplicar. */
export const DEMO_PRODUCTS: P[] = [
  ['Camiseta Básica Algodão', 'Camisetas', 'P', 4990, 30, 'Camiseta de algodão penteado, gola careca.\nCor: branca.'],
  ['Camiseta Básica Algodão', 'Camisetas', 'M', 4990, 25, 'Camiseta de algodão penteado, gola careca.\nCor: branca.'],
  ['Camiseta Básica Algodão', 'Camisetas', 'G', 4990, 0, 'Camiseta de algodão penteado, gola careca.\nCor: branca.'],
  ['Camiseta Estampada Coleção D\'Água', 'Camisetas', 'M', 6990, 12, 'Estampa exclusiva da coleção D\'Água, inspirada no mar.'],
  ['Regata Dry Fit', 'Camisetas', 'GG', 3990, 18, 'Tecido leve que seca rápido, ideal para treinos.'],
  ['Calça Jeans Reta', 'Calças', '38', 15990, 10, 'Jeans com elastano, modelagem reta e lavagem média.'],
  ['Calça Jeans Reta', 'Calças', '42', 15990, 7, 'Jeans com elastano, modelagem reta e lavagem média.'],
  ['Calça de Moletom Jogger', 'Calças', 'M', 11990, 15, 'Moletom flanelado com punho na barra e cordão.'],
  ['Bermuda Sarja', 'Bermudas', '40', 8990, 20, 'Bermuda de sarja com cinco bolsos. Cor: cáqui.'],
  ['Bermuda Tactel', 'Bermudas', 'G', 5990, 22, 'Bermuda leve de tactel com forro interno.'],
  ['Vestido Midi Floral', 'Vestidos', 'P', 18900, 8, 'Vestido midi em viscose com estampa floral e alças finas.'],
  ['Vestido Longo Linho', 'Vestidos', 'M', 25900, 5, 'Vestido longo de linho com amarração na cintura.'],
  ['Saia Plissada', 'Saias', 'P', 9990, 9, 'Saia midi plissada com cós elástico.'],
  ['Jaqueta Corta-Vento', 'Casacos', 'G', 22990, 6, 'Jaqueta impermeável com capuz e bolsos com zíper.'],
  ['Moletom Canguru "Inverno"', 'Casacos', 'GG', 17990, 11, 'Moletom com capuz, bolso canguru e interior felpado.'],
  ['Meia Esportiva (par)', 'Acessórios', 'Único', 1500, 100, 'Meia cano médio em algodão com reforço no calcanhar.'],
  ['Boné Aba Curva', 'Acessórios', 'Único', 4500, 40, 'Boné de sarja com regulagem traseira.'],
  ['Cinto de Couro', 'Acessórios', 'Único', 7900, 14, 'Cinto de couro legítimo com fivela prateada.'],
];

interface DemoUser {
  name: string; email: string; role: 'cliente' | 'funcionario';
  /** Dados fictícios: CPFs de exemplo com dígitos verificadores válidos, telefones com prefixo 90000. */
  cpf?: string; phone?: string; address?: AddressInput;
  orders: { createdAt: string; status: string; items: [name: string, size: string, qty: number][] }[];
}

const DEMO_USERS: DemoUser[] = [
  {
    name: 'Ana Cliente (demo)', email: 'ana@demo.vestebem', role: 'cliente',
    cpf: '12345678909', phone: '11900000001',
    address: { recipient: 'Ana Cliente (demo)', cep: '01000000', street: 'Rua Fictícia das Flores', number: '100',
      complement: 'Apto 12', district: 'Jardim Exemplo', city: 'São Paulo', state: 'SP' },
    orders: [
      { createdAt: '2026-10-01T13:00:00.000Z', status: 'enviado', items: [
        ['Camiseta Básica Algodão', 'M', 2], ['Calça Jeans Reta', '38', 1]] },
      { createdAt: '2026-10-20T15:30:00.000Z', status: 'recebido', items: [['Vestido Midi Floral', 'P', 1]] },
    ],
  },
  {
    name: 'Bruno Cliente (demo)', email: 'bruno@demo.vestebem', role: 'cliente',
    cpf: '98765432100', phone: '21900000002',
    address: { recipient: 'Bruno Cliente (demo)', cep: '20000000', street: 'Avenida Imaginária', number: '2000',
      complement: null, district: 'Centro Demo', city: 'Rio de Janeiro', state: 'RJ' },
    orders: [
      { createdAt: '2026-10-10T10:15:00.000Z', status: 'em_preparacao', items: [
        ['Jaqueta Corta-Vento', 'G', 1], ['Meia Esportiva (par)', 'Único', 3]] },
      { createdAt: '2026-09-05T18:45:00.000Z', status: 'cancelado', items: [['Bermuda Sarja', '40', 1]] },
    ],
  },
  // Cliente sem CPF, telefone nem endereço: para experimentar o cadastro e o bloqueio da finalização do pedido.
  { name: 'Daniela Cliente (demo)', email: 'daniela@demo.vestebem', role: 'cliente', orders: [] },
  { name: 'Carlos Funcionário (demo)', email: 'carlos@demo.vestebem', role: 'funcionario', phone: '31900000003', orders: [] },
];
const DEMO_PASSWORD = 'demo1234';

export async function seed(db: DatabaseSync, log: (m: string) => void = console.log) {
  const findProduct = db.prepare('SELECT id, name, price_cents FROM products WHERE name = ? AND size = ?');
  let created = 0;
  for (const [name, category, size, price, stock, description] of DEMO_PRODUCTS) {
    if (findProduct.get(name, size)) continue;
    db.prepare('INSERT INTO products (name, description, category, size, price_cents, stock) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, description, category, size, price, stock);
    created++;
  }
  log(`Produtos de demonstração: ${created} criado(s), ${DEMO_PRODUCTS.length - created} já existia(m).`);

  for (const d of DEMO_USERS) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(d.email);
    const id = existing ? Number(existing.id) : Number(db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(d.name, d.email, await hashPassword(DEMO_PASSWORD), d.role).lastInsertRowid);
    // Completa apenas dados ausentes (nunca sobrescreve o que o usuário alterou).
    const filled = fillMissingProfile(db, id, d);
    if (existing) {
      log(`= ${d.email} já existe${filled.length ? `; preenchido: ${filled.join(", ")}` : "; nada a fazer"}.`);
      continue;
    }
    // Pedidos de demo são criados apenas junto com a conta.
    for (const o of d.orders) {
      const items: ItemSnapshot[] = o.items.map(([name, size, quantity]) => {
        const p = findProduct.get(name, size);
        if (!p) throw new Error(`Produto de demonstração ausente: ${name} ${size}`);
        return { productId: Number(p.id), description: String(p.name), quantity, unitPriceCents: Number(p.price_cents) };
      });
      const shipping = shippingFromAccount(db, id);
      const orderId = insertOrder(db, id, items, "error" in shipping ? null : shipping, o.createdAt);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(o.status, orderId);
    }
    log(`+ ${d.email} (${d.role}) criado com ${d.orders.length} pedido(s).`);
  }
}

function fillMissingProfile(db: DatabaseSync, id: number, d: DemoUser): string[] {
  const filled: string[] = [];
  const u = db.prepare('SELECT cpf, phone FROM users WHERE id = ?').get(id)!;
  if (d.cpf && u.cpf === null && !db.prepare('SELECT 1 FROM users WHERE cpf = ?').get(d.cpf)) {
    db.prepare('UPDATE users SET cpf = ? WHERE id = ?').run(d.cpf, id); filled.push("CPF");
  }
  if (d.phone && u.phone === null) { db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(d.phone, id); filled.push("telefone"); }
  if (d.address && !db.prepare('SELECT 1 FROM addresses WHERE user_id = ?').get(id)) {
    const a = d.address;
    db.prepare(`INSERT INTO addresses (user_id, recipient, cep, street, number, complement, district, city, state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, a.recipient, a.cep, a.street, a.number, a.complement, a.district, a.city, a.state);
    filled.push("endereço");
  }
  return filled;
}

if (import.meta.main) {
  const db = openDatabase(config.dbPath);
  migrate(db, config.migrationsDir);
  await seed(db);
  db.close();
}
