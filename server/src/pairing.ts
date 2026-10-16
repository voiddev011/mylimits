import type { FastifyInstance,FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hash,uuid,transaction } from './db';
import { ApiError,opaque,requireWeb,type Principal } from './auth';
import { registerDevice } from './service';
export function pairingRoutes(app:FastifyInstance,pool:pg.Pool){
 const ipBudgets=new Map<string,{at:number;count:number}>();
 const limit=(r:FastifyRequest)=>{const now=Date.now(),prior=ipBudgets.get(r.ip),b=prior&&now-prior.at<60000?prior:{at:now,count:0};if(++b.count>30)throw new ApiError(429,'pairing_budget_exceeded');ipBudgets.delete(r.ip);ipBudgets.set(r.ip,b);if(ipBudgets.size>2000)ipBudgets.delete(ipBudgets.keys().next().value!)};
 app.post('/pairing/start',async r=>{
  limit(r);const b=z.object({name:z.string().trim().min(1).max(60)}).strict().parse(r.body),id=uuid(),secret=opaque(),code=randomBytes(6).toString('hex').toUpperCase(),expiresAt=Date.now()+600000;
  await pool.query('DELETE FROM pair_requests WHERE expires_at<$1',[Date.now()]);
  await pool.query('INSERT INTO pair_requests(id,secret_hash,user_code,name,expires_at) VALUES($1,$2,$3,$4,$5)',[id,hash(secret),code,b.name,expiresAt]);return {id,secret,code,expiresAt};
 });
 app.post('/pairing/poll',async r=>{
  limit(r);const b=z.object({id:z.string().uuid(),secret:z.string().min(32).max(100)}).strict().parse(r.body);
  return transaction(pool,async db=>{
   const candidate=(await db.query('SELECT approved_owner FROM pair_requests WHERE id=$1 AND secret_hash=$2 AND expires_at>$3 AND consumed_at IS NULL',[b.id,hash(b.secret),Date.now()])).rows[0];if(!candidate)throw new ApiError(410,'pairing_expired');if(!candidate.approved_owner)return {status:'pending'};await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[candidate.approved_owner]);
   const pair=(await db.query('SELECT * FROM pair_requests WHERE id=$1 AND secret_hash=$2 AND expires_at>$3 AND consumed_at IS NULL FOR UPDATE',[b.id,hash(b.secret),Date.now()])).rows[0];if(!pair)throw new ApiError(410,'pairing_expired');
   if(!pair.approved_owner)return {status:'pending'};
   const device=await registerDevice(db,{owner:pair.approved_owner,kind:'web'},pair.name);await db.query('UPDATE pair_requests SET consumed_at=$2 WHERE id=$1',[b.id,Date.now()]);return {status:'connected',deviceId:device.id,token:device.token};
  });
 });
 app.get('/v1/pairings/:code',async r=>{
  const p=(r as FastifyRequest&{principal:Principal}).principal;requireWeb(p);const {code}=z.object({code:z.string().regex(/^[A-F0-9]{12}$/)}).parse(r.params);
  const row=(await pool.query('SELECT name,expires_at FROM pair_requests WHERE user_code=$1 AND expires_at>$2 AND approved_owner IS NULL AND consumed_at IS NULL',[code,Date.now()])).rows[0];if(!row)throw new ApiError(404,'pairing_unavailable');return {name:row.name,expiresAt:Number(row.expires_at)};
 });
 app.post('/v1/pairings/approve',async r=>{
  const p=(r as FastifyRequest&{principal:Principal}).principal;requireWeb(p);const b=z.object({code:z.string().regex(/^[A-F0-9]{12}$/)}).strict().parse(r.body);
  const row=await pool.query('UPDATE pair_requests SET approved_owner=$2 WHERE user_code=$1 AND approved_owner IS NULL AND consumed_at IS NULL AND expires_at>$3 RETURNING id',[b.code,p.owner,Date.now()]);if(!row.rows.length)throw new ApiError(409,'pairing_unavailable');return {approved:true};
 });
}
