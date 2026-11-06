import { Router, type RequestHandler, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const addressFields = 'recipient,postal_code AS postalCode,street,number,complement,neighborhood,city,state';
export function readDelivery(db: DatabaseSync, userId: number) {
 return db.prepare('SELECT '+addressFields+',u.phone,u.delivery_version AS deliveryVersion FROM addresses a JOIN users u ON u.id=a.user_id WHERE a.user_id=?').get(userId);
}
export function copyDelivery(db: DatabaseSync, orderId: number, delivery: NonNullable<ReturnType<typeof readDelivery>>) {
 db.prepare('INSERT INTO order_delivery(order_id,recipient,phone,postal_code,street,number,complement,neighborhood,city,state) VALUES (?,?,?,?,?,?,?,?,?,?)').run(orderId,delivery.recipient,delivery.phone,delivery.postalCode,delivery.street,delivery.number,delivery.complement,delivery.neighborhood,delivery.city,delivery.state);
}
export function profileRouter(db: DatabaseSync, authenticate: RequestHandler, limiter: RequestHandler, clearCookie: (res: Response) => unknown) {
 const router = Router(); router.use(authenticate);
 router.post('/password', limiter, async (req,res) => {
  const {currentPassword,newPassword} = req.body ?? {};
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length>128 || typeof newPassword!=='string' || newPassword.length<8 || newPassword.length>128) { res.status(400).json({message:'Informe a senha atual e uma nova senha de 8 a 128 caracteres.'}); return; }
  const id = Number(res.locals.user.id);
  const stored = String(db.prepare('SELECT password_hash FROM users WHERE id=?').get(id)!.password_hash);
  const [salt,hash] = stored.split(':'); const candidate = await scrypt(currentPassword,salt,64) as Buffer;
  if (!timingSafeEqual(candidate,Buffer.from(hash,'hex'))) { res.status(400).json({message:'A senha atual está incorreta.'}); return; }
  const nextSalt=randomBytes(16).toString('hex'); const nextHash=await scrypt(newPassword,nextSalt,64) as Buffer;
  db.exec('BEGIN IMMEDIATE');
  try {
   if (db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').run(nextSalt+':'+nextHash.toString('hex'),id,stored).changes!==1) { db.exec('ROLLBACK'); res.status(409).json({message:'A senha foi alterada por outra solicitação. Entre novamente.'}); return; }
   db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
  clearCookie(res); res.json({message:'Senha alterada. Entre novamente com a nova senha.'});
 });
 router.use((_req,res,next)=>{ if(res.locals.user.role!=='customer'){res.status(403).json({message:'Dados pessoais e endereço são exclusivos da própria conta de cliente.'});return;}next(); });
 router.get('/profile',(_req,res)=>{
  const id=Number(res.locals.user.id);
  const user=db.prepare('SELECT name,email,cpf,phone,delivery_version AS deliveryVersion FROM users WHERE id=?').get(id)!;
  const address=db.prepare('SELECT '+addressFields+' FROM addresses WHERE user_id=?').get(id) ?? null;
  res.json({...user,address});
 });
 router.put('/profile',(req,res)=>{
  const {name,cpf,phone}=req.body ?? {};
  const normalize=(value:unknown,pattern:RegExp,lengths:number[])=>typeof value==='string' && pattern.test(value) && (value.trim()==='' || lengths.includes(value.replace(/\D/g,'').length));
  if(typeof name!=='string' || name.trim().length<2 || name.trim().length>100 || !normalize(cpf,/^[\d.\-\s]*$/,[11]) || !normalize(phone,/^[\d().\-\s]*$/,[10,11])) {res.status(400).json({message:'Informe nome de 2 a 100 caracteres, CPF com 11 dígitos e telefone com DDD (10 ou 11 dígitos). CPF e telefone podem ficar vazios.'});return;}
  db.prepare('UPDATE users SET name=?,cpf=?,phone=?,delivery_version=delivery_version+1 WHERE id=?').run(name.trim(),cpf.replace(/\D/g,'') || null,phone.replace(/\D/g,'') || null,res.locals.user.id);
  res.json({message:'Dados pessoais atualizados com sucesso.'});
 });
 router.put('/address',(req,res)=>{
  const {recipient,postalCode,street,number,complement='',neighborhood,city,state}=req.body ?? {};
  const text=(value:unknown,min:number,max:number)=>typeof value==='string' && value.trim().length>=min && value.trim().length<=max;
  if(!text(recipient,2,100) || typeof postalCode!=='string' || !/^[\d\-\s]+$/.test(postalCode) || postalCode.replace(/\D/g,'').length!==8 || !text(street,1,200) || !text(number,1,30) || !text(complement,0,100) || !text(neighborhood,1,100) || !text(city,1,100) || typeof state!=='string' || !states.includes(state.toUpperCase())) {res.status(400).json({message:'Preencha todos os campos do endereço, com CEP de 8 dígitos e uma UF válida. Complemento é opcional.'});return;}
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('INSERT INTO addresses(user_id,recipient,postal_code,street,number,complement,neighborhood,city,state) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET recipient=excluded.recipient,postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,complement=excluded.complement,neighborhood=excluded.neighborhood,city=excluded.city,state=excluded.state').run(res.locals.user.id,recipient.trim(),postalCode.replace(/\D/g,''),street.trim(),number.trim(),complement.trim(),neighborhood.trim(),city.trim(),state.toUpperCase());
   db.prepare('UPDATE users SET delivery_version=delivery_version+1 WHERE id=?').run(res.locals.user.id); db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  res.json({message:'Endereço atualizado com sucesso.'});
 });
 return router;
}
