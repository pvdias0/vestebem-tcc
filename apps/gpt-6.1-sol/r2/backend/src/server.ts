import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {orders,currentUser} from './orders.js';
import {products} from './products.js';
import {account} from './account.js';
export const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'64kb'}));
app.use('/api', (req,res,next) => { res.setHeader('Cache-Control','no-store'); if(req.method !== 'GET' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) { res.status(403).json({error:'Origem não permitida.'}); return; } next(); });
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
app.post('/api/register',(req,res) => {
 const {name,email,password}=req.body ?? {};
 if(typeof name!=='string'||!name.trim()||name.trim().length>100||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<8||password.length>128) {res.status(400).json({error:'Informe nome, e-mail válido e senha de 8 a 128 caracteres.'});return;}
 const salt=randomBytes(16).toString('hex');
 try {db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim(),email.trim().toLowerCase(),`${salt}:${scryptSync(password,salt,64).toString('hex')}`);res.status(201).json({message:'Conta criada. Entre para continuar.'});} catch(e) {if(String(e).includes('UNIQUE'))res.status(409).json({error:'Este e-mail já está cadastrado.'});else throw e;}
});
app.post('/api/login',(req,res)=>{
 const {email,password}=req.body ?? {};
 if(typeof email!=='string'||typeof password!=='string'||password.length>128){res.status(401).json({error:'E-mail ou senha incorretos.'});return;}
 const user=db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(email.trim().toLowerCase());
 const [salt,digest]=String(user?.password_hash ?? 'dummy:').split(':');
 const actual=scryptSync(password,salt!,64); const expected=digest?Buffer.from(digest,'hex'):Buffer.alloc(64);
 if(!user||!timingSafeEqual(actual,expected)){res.status(401).json({error:'E-mail ou senha incorretos.'});return;}
 const token=randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),Number(user.id),Date.now()+86400000);
 res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:86400000,path:'/'});res.json({message:'Bem-vindo!'});
});
const tokenOf=(req:express.Request)=> /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1] ?? '';
app.get('/api/me',(req,res)=>{const user=currentUser(req.headers.cookie);if(!user){res.status(401).json({error:'Entre para acessar sua conta.'});return;}res.json(user);});
app.use('/api/orders',orders);
app.use('/api/products',products);
app.use('/api/account',account);
app.post('/api/logout',(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(tokenOf(req)));res.clearCookie('session',{path:'/'});res.json({message:'Você saiu da conta.'});});
app.use(express.static(fileURLToPath(new URL('../../frontend/dist/',import.meta.url))));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({error:'Não foi possível concluir a operação.'});});
if(process.env.NODE_ENV!=='test')app.listen(Number(process.env.PORT ?? 3000),'127.0.0.1',()=>console.log('VesteBem: http://localhost:3000'));
