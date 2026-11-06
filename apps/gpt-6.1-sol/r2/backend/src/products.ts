import {Router} from 'express';
import type {SQLInputValue} from 'node:sqlite';
import {db} from './db.js';
import {currentUser} from './orders.js';
export const products=Router();
export function cents(value:unknown):number|null {if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;const c=Math.round(value*100);return Number.isSafeInteger(c)&&Math.abs(value*100-c)<0.000001?c:null;}
products.get('/',(req,res)=>{
 const q=req.query;const text=(key:string)=>typeof q[key]==='string'?q[key] as string:'';
 if(Object.values(q).some(v=>typeof v!=='string')){res.status(400).json({error:'Parâmetros inválidos.'});return;}
 const page=Number(text('page')||1),sort=text('sort')||'name',direction=text('direction')||'asc';
 if(!Number.isSafeInteger(page)||page<1||page>1000000||!['name','price'].includes(sort)||!['asc','desc'].includes(direction)){res.status(400).json({error:'Página ou ordenação inválida.'});return;}
 const where:string[]=[],params:SQLInputValue[]=[];
 if(text('q')){where.push('(instr(lower(name),lower(?))>0 OR instr(lower(description),lower(?))>0)');params.push(text('q'),text('q'));}
 for(const key of ['category','size'])if(text(key)){where.push(`${key}=?`);params.push(text(key));}
 let min:number|null=null,max:number|null=null;
 for(const [key,op] of [['min','>='],['max','<=']] as const)if(text(key)!==''){const value=cents(Number(text(key)));if(value===null){res.status(400).json({error:'Preço de filtro inválido.'});return;}if(key==='min')min=value;else max=value;where.push(`price_cents${op}?`);params.push(value);}
 if(min!==null&&max!==null&&min>max){res.status(400).json({error:'Preço mínimo deve ser menor ou igual ao máximo.'});return;}
 const clause=where.length?' WHERE '+where.join(' AND '):'';
 const total=db.prepare('SELECT count(*) AS total FROM products'+clause).get(...params)!.total;
 const items=db.prepare(`SELECT id,name,description,category,size,price_cents,stock FROM products${clause} ORDER BY ${sort==='price'?'price_cents':'name COLLATE NOCASE'} ${direction},id ASC LIMIT 12 OFFSET ?`).all(...params,(page-1)*12);
 res.json({items,total,page,pageSize:12});
});
products.get('/:id',(req,res)=>{const product=db.prepare('SELECT id,name,description,category,size,price_cents,stock FROM products WHERE id=?').get(req.params.id);if(!product){res.status(404).json({error:'Produto não encontrado.'});return;}res.json(product);});
products.use((req,res,next)=>{const u=currentUser(req.headers.cookie);if(!u){res.status(401).json({error:'Entre para continuar.'});return;}if(u.role!=='funcionario'){res.status(403).json({error:'Somente funcionários podem gerenciar produtos.'});return;}next();});
products.post('/',save);products.put('/:id',save);
function save(req:import('express').Request,res:import('express').Response){const b=req.body ?? {},price=cents(b.price);if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>200||typeof b.description!=='string'||b.description.length>5000||typeof b.category!=='string'||!b.category.trim()||b.category.trim().length>100||typeof b.size!=='string'||!b.size.trim()||b.size.trim().length>30||price===null||!Number.isSafeInteger(b.stock)||b.stock<0){res.status(400).json({error:'Preencha os campos; preço não negativo com até 2 casas e estoque inteiro não negativo.'});return;}
 const values=[b.name.trim(),b.description,b.category.trim(),b.size.trim(),price,b.stock];
 if(req.method==='PUT'){const r=db.prepare('UPDATE products SET name=?,description=?,category=?,size=?,price_cents=?,stock=? WHERE id=?').run(...values,req.params.id as string);if(!r.changes){res.status(404).json({error:'Produto não encontrado.'});return;}res.json({id:Number(req.params.id)});}else{const r=db.prepare('INSERT INTO products(name,description,category,size,price_cents,stock) VALUES(?,?,?,?,?,?)').run(...values);res.status(201).json({id:Number(r.lastInsertRowid)});}
}
