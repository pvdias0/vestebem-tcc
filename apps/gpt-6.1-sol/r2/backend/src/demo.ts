import {db} from './db.js';
import {randomBytes,scryptSync} from 'node:crypto';
db.exec('BEGIN');
try{
for(const [name,email,role] of [['Ana Demo','ana@vestebem.demo','cliente'],['Bruno Demo','bruno@vestebem.demo','cliente'],['Carla Demo','carla@vestebem.demo','funcionario']]){
 const existing=db.prepare('SELECT id FROM users WHERE email=?').get(email!);
 if(existing)continue;
 const salt=randomBytes(16).toString('hex');const result=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name!,email!,`${salt}:${scryptSync('VesteBem123!',salt,64).toString('hex')}`);
 db.prepare('UPDATE roles SET role=? WHERE user_id=?').run(role!,result.lastInsertRowid);
}
for(const email of ['ana@vestebem.demo','bruno@vestebem.demo']){
 if(db.prepare('SELECT id FROM orders WHERE demo_key=?').get(email))continue;
 const user=db.prepare('SELECT id FROM users WHERE email=?').get(email)!;
 const order=db.prepare('INSERT INTO orders(customer_id,total_cents,demo_key) VALUES(?,3990,?)').run(user.id!,email);
 db.prepare('INSERT INTO order_items(order_id,description,quantity,unit_price_cents) VALUES(?,?,1,3990)').run(order.lastInsertRowid,'Camiseta básica');
}
for(let i=0;i<18;i++){db.prepare('INSERT OR IGNORE INTO products(name,description,category,size,price_cents,stock,demo_key) VALUES(?,?,?,?,?,?,?)').run(i===0?"Coleção D'Água":['Camiseta','Calça','Vestido'][i%3]+' '+(i+1),'Peça confortável para o dia a dia. '+(i===0?'Algodão e estilo.':''),['Casual','Jeans','Festa'][i%3],['P','M','G'][Math.floor(i/3)%3],1990+i*700,i*2,'produto-demo-'+i);}
for(const email of ['ana@vestebem.demo','bruno@vestebem.demo']){const u=db.prepare('SELECT id FROM users WHERE email=?').get(email)!;db.prepare("INSERT OR IGNORE INTO customer_profiles(user_id,cpf,phone) VALUES(?,'00000000000','11000000000')").run(u.id!);db.prepare("INSERT OR IGNORE INTO addresses VALUES(?,'Destinatário Fictício','00000000','Rua de Demonstração','123','Endereço fictício','Bairro Exemplo','Cidade Exemplo','SP')").run(u.id!);}
db.exec('COMMIT');console.log('Demonstração preparada. Senha: VesteBem123!');
}catch(e){db.exec('ROLLBACK');throw e;}
