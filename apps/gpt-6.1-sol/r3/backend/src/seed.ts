import { randomBytes, scryptSync } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { insertOrder } from './orders.js';
import { readDelivery, copyDelivery } from './profile.js';
export function seedDemo(db: DatabaseSync) {
 db.exec('BEGIN IMMEDIATE');
 try {
  const accounts = [ ['Ana Demonstração','ana@demo.vestebem.local','customer'], ['Bruno Demonstração','bruno@demo.vestebem.local','customer'], ['Fernanda Demonstração','funcionario@demo.vestebem.local','employee'] ];
  for (const [name,email,role] of accounts) {
   const existing = db.prepare('SELECT id,role FROM users WHERE email=?').get(email);
   if (existing && existing.role !== role) throw new Error(`O e-mail reservado ${email} já existe com outro perfil. Nenhuma alteração foi aplicada.`);
   if (!existing) { const salt = randomBytes(16).toString('hex'); const hash = scryptSync('VesteBem@2026', salt, 64).toString('hex'); db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run(name,email,salt+':'+hash,role); }
  }
  const names = ["Coleção D'Água",'Camiseta básica','Calça de algodão','Blusa de linho','Vestido floral','Jaqueta leve','Saia midi','Camisa social','Shorts de verão','Casaco de lã','Regata lisa','Calça reta','Vestido longo','Blusa canelada','Jaqueta jeans','Lenço estampado'];
  for (const [index,name] of names.entries()) db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock,demo_key) VALUES (?,?,?,?,?,?,?) ON CONFLICT(demo_key) DO NOTHING').run(name, index === 0 ? 'Peça leve da coleção de verão, com toque macio.' : `Conforto para o dia a dia. Modelo ${index+1}.`, ['Básicos','Casual','Social','Inverno'][index%4], ['P','M','G','GG'][Math.floor(index/4)%4], index === 15 ? 0 : 2990+index*1000, index === 0 ? 0 : 10+index, `demo-product-${index+1}`);
  for (const [index,email] of ['ana@demo.vestebem.local','bruno@demo.vestebem.local'].entries()) {
   const user = db.prepare('SELECT id FROM users WHERE email=?').get(email)!;
   if(!db.prepare('SELECT user_id FROM demo_profile_seeds WHERE user_id=?').get(user.id)) {
    db.prepare('UPDATE users SET cpf=COALESCE(cpf,?),phone=COALESCE(phone,?),delivery_version=delivery_version+1 WHERE id=?').run(index===0?'00000000000':'11111111111','00000000000',user.id);
    db.prepare('INSERT INTO addresses(user_id,recipient,postal_code,street,number,complement,neighborhood,city,state) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').run(user.id,index===0?'Destinatária fictícia Ana':'Destinatário fictício Bruno','00000000','Rua Fictícia de Demonstração',String(index+1),'Endereço fictício, não utilizar para envios','Bairro Exemplo','Cidade de Demonstração','SP');
    db.prepare('INSERT INTO demo_profile_seeds(user_id) VALUES (?)').run(user.id);
   }
   const key = `demo-order-${index+1}`;
   const product = db.prepare('SELECT id,name,price_cents FROM products WHERE demo_key=?').get(`demo-product-${index+2}`)!;
   if (!db.prepare('SELECT id FROM orders WHERE demo_key=?').get(key)) { const id=insertOrder(db, Number(user.id), [{ productId: Number(product.id), description: String(product.name), quantity: 2, unitPriceCents: Number(product.price_cents) }], key); copyDelivery(db,id,readDelivery(db,Number(user.id))!); }
  }
  db.exec('COMMIT');
 } catch (error) { db.exec('ROLLBACK'); throw error; }
}
