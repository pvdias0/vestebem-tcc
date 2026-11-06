import {Router} from 'express';
import {createHash} from 'node:crypto';
import {db} from './db.js';
export const orders=Router();
export function currentUser(cookie=''){
 const token=/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(cookie)?.[1] ?? '';
 return db.prepare('SELECT users.id,name,email,roles.role FROM users JOIN roles ON roles.user_id=users.id JOIN sessions ON sessions.user_id=users.id WHERE token_hash=? AND expires_at>?').get(createHash('sha256').update(token).digest('hex'),Date.now());
}
orders.use((req,res,next)=>{const user=currentUser(req.headers.cookie);if(!user){res.status(401).json({error:'Entre para acessar pedidos.'});return;}res.locals.user=user;next();});
orders.get('/',(_req,res)=>{const u=res.locals.user;res.json(db.prepare(`SELECT orders.*,users.name AS customer_name FROM orders JOIN users ON users.id=customer_id ${u.role==='funcionario'?'':'WHERE customer_id=?'} ORDER BY orders.id DESC`).all(...(u.role==='funcionario'?[]:[u.id])));});
orders.get('/:id',(req,res)=>{const u=res.locals.user;const order=db.prepare(`SELECT orders.*,users.name AS customer_name FROM orders JOIN users ON users.id=customer_id WHERE orders.id=? ${u.role==='funcionario'?'':'AND customer_id=?'}`).get(req.params.id,...(u.role==='funcionario'?[]:[u.id]));if(!order){res.status(404).json({error:'Pedido não encontrado.'});return;}res.json({...order,items:db.prepare('SELECT product_id,description,quantity,unit_price_cents FROM order_items WHERE order_id=? ORDER BY id').all(order.id!)});});
orders.post('/',(req,res)=>{if(res.locals.user.role!=='cliente'){res.status(403).json({error:'Somente clientes podem criar pedidos.'});return;}
 const items:unknown=req.body?.items;
 const address=db.prepare('SELECT recipient,cep,street,number,complement,district,city,state FROM addresses WHERE user_id=?').get(res.locals.user.id);
 const profile=db.prepare('SELECT phone FROM customer_profiles WHERE user_id=?').get(res.locals.user.id);
 if(req.body?.confirm_delivery!==true||!address||!profile?.phone){res.status(400).json({error:'Cadastre endereço e telefone em Minha conta e confirme o endereço de entrega.'});return;}
 if(req.body.delivery_confirmation!==JSON.stringify({...address,phone:profile.phone})){res.status(400).json({error:'Carregue e confirme novamente os dados atuais de entrega.'});return;}
 if(!Array.isArray(items)||items.length<1||items.length>100){res.status(400).json({error:'Informe de 1 a 100 itens.'});return;}
 const parsed:{productId:number;description:string;quantity:number;price:number}[]=[];let total=0;
 for(const item of items){if(!item||!Number.isSafeInteger(item.product_id)||item.product_id<=0||!Number.isSafeInteger(item.quantity)||item.quantity<=0){res.status(400).json({error:'Selecione um produto e quantidade inteira positiva.'});return;}
 const product=db.prepare('SELECT id,name,price_cents FROM products WHERE id=?').get(item.product_id);if(!product){res.status(400).json({error:'Produto não encontrado.'});return;}const price=Number(product.price_cents);total+=price*item.quantity;if(!Number.isSafeInteger(total)){res.status(400).json({error:'Total excede o limite.'});return;}parsed.push({productId:item.product_id,description:String(product.name),quantity:item.quantity,price});}
 db.exec('BEGIN');try{const result=db.prepare('INSERT INTO orders(customer_id,total_cents,delivery_json) VALUES(?,?,?)').run(res.locals.user.id,total,JSON.stringify({...address,phone:profile.phone}));for(const i of parsed)db.prepare('INSERT INTO order_items(order_id,description,quantity,unit_price_cents,product_id) VALUES(?,?,?,?,?)').run(result.lastInsertRowid,i.description,i.quantity,i.price,i.productId);db.exec('COMMIT');res.status(201).json({id:Number(result.lastInsertRowid)});}catch(e){db.exec('ROLLBACK');throw e;}
});
orders.patch('/:id/status',(req,res)=>{if(res.locals.user.role!=='funcionario'){res.status(403).json({error:'Somente funcionários podem alterar status.'});return;}const status:unknown=req.body?.status;if(typeof status!=='string'||!['recebido','em preparação','enviado','cancelado'].includes(status)){res.status(400).json({error:'Status inválido.'});return;}const result=db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,req.params.id);if(!result.changes){res.status(404).json({error:'Pedido não encontrado.'});return;}res.json({message:'Status atualizado.'});});
