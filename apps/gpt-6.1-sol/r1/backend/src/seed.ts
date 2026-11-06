import type { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './database.js';
import { hashPassword } from './password.js';
import { insertOrder } from './orders.js';

export async function seedDemo(db: DatabaseSync) {
  const accounts = [
    { name: 'Ana Demo', email: 'ana@demo.vestebem.test', role: 'customer' },
    { name: 'Bruno Demo', email: 'bruno@demo.vestebem.test', role: 'customer' },
    { name: 'Carla Demo', email: 'carla@demo.vestebem.test', role: 'employee' },
  ];
  const hashes = await Promise.all(accounts.map(() => hashPassword('VesteBem2026!')));
  db.exec('BEGIN IMMEDIATE');
  try {
    const names = ['Camiseta de algodão', 'Calça de linho', 'Vestido floral', 'Jaqueta jeans', 'Blusa canelada', 'Bermuda casual', 'Saia midi', 'Moletom básico', 'Camisa social', 'Calça reta', 'Vestido longo', 'Coleção D\'Água', 'Camiseta listrada', 'Short de sarja', 'Blusa de tricô', 'Casaco leve'];
    for (const [index, name] of names.entries()) {
      db.prepare('INSERT INTO products(name, description, category, size, price_cents, stock, demo_key) VALUES (?,?,?,?,?,?,?) ON CONFLICT(demo_key) DO NOTHING').run(name, `Peça confortável da VesteBem. ${index % 2 === 0 ? 'Algodão macio para o dia a dia.' : 'Acabamento leve e versátil.'}`, ['Camisetas', 'Calças', 'Vestidos', 'Casacos'][index % 4], ['P', 'M', 'G', 'GG'][Math.floor(index / 4)], 1990 + index * 1500, index === 15 ? 0 : 5 + index, `demo-product-${index + 1}`);
    }
    for (const [index, account] of accounts.entries()) {
      const existing = db.prepare('SELECT role FROM users WHERE email = ?').get(account.email);
      if (existing && existing.role !== account.role) throw new Error(`E-mail de demonstração já usado por outro perfil: ${account.email}. Nenhuma conta foi alterada.`);
      db.prepare('INSERT INTO users(name, email, password_hash, role) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING').run(account.name, account.email, hashes[index], account.role);
      if (account.role === 'customer') {
        const key = `demo-profile-${index + 1}`;
        if (!db.prepare('SELECT key FROM demo_data WHERE key=?').get(key)) {
          const id = db.prepare('SELECT id FROM users WHERE email=?').get(account.email)!.id;
          db.prepare('INSERT INTO customer_profiles(user_id,cpf,phone) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').run(id, index === 0 ? '00000000000' : '11111111111', '00000000000');
          db.prepare('INSERT INTO addresses(user_id,recipient,postal_code,street,number,complement,district,city,state) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').run(id, account.name, '00000000', 'Rua Fictícia de Demonstração', String(index + 1), 'Endereço fictício — não enviar', 'Bairro Exemplo', 'Cidade Exemplo', 'SP');
          db.prepare('INSERT INTO demo_data(key) VALUES (?)').run(key);
        }
      }
    }
    for (const [index, account] of accounts.slice(0, 2).entries()) {
      const key = `demo-order-${index + 1}`;
      if (db.prepare('SELECT id FROM orders WHERE demo_key = ?').get(key)) continue;
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(account.email)!;
      insertOrder(db, Number(user.id), [
        { description: index === 0 ? 'Camiseta de algodão' : 'Calça de linho', quantity: 2, unitPriceCents: index === 0 ? 5990 : 12990 },
        { description: 'Meias', quantity: 1, unitPriceCents: 1990 },
      ], key);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDatabase();
  try { await seedDemo(db); console.log('Demonstração preparada. Senha inicial das três contas: VesteBem2026!'); }
  finally { db.close(); }
}
