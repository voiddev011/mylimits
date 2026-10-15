import Fastify, { type FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { ConfigSchema,type Config } from './config';
import { ApiError,authenticate,oidcVerifier,requireWeb,type Principal,type Verify } from './auth';
import { accounts,deleteAccount,deleteAccountInTransaction,registerDevice,snapshots,upload } from './service';
import { transaction } from './db';
import { SyncPreferencesSchema } from '../../src/core/sync-contracts';
import { authRoutes } from './oidc';
import { JobRunner } from './jobs';
import { CredentialStore } from './credentials';
import { pairingRoutes } from './pairing';
import { webRoutes } from './web';
export type RequestWithPrincipal=FastifyRequest&{principal:Principal};
const identifier=z.string().uuid();
const params=(request:FastifyRequest)=>z.object({id:identifier}).parse(request.params).id;
export function createApp(options:{config:Config;pool:pg.Pool;testVerifier?:Verify}){
 const config=ConfigSchema.parse(options.config),pool=options.pool;
 if(options.testVerifier&&config.environment!=='test')throw new Error('Test authentication is forbidden outside tests.');
 const verify=options.testVerifier??oidcVerifier(config);
 const jobs=new JobRunner({pool,credentials:new CredentialStore(pool),environment:config.environment});
 const app=Fastify({logger:false,bodyLimit:512*1024,requestTimeout:15000,trustProxy:false});
 app.decorateRequest('principal',null);
 const budgets=new Map<string,{at:number;count:number}>();
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','no-referrer');
  const origin=req.headers.origin,allowed=origin===config.origin||config.allowedOrigins.includes(origin??'');
  if(origin&&!allowed)throw new ApiError(403,'invalid_origin');
  if(allowed&&origin){reply.header('access-control-allow-origin',origin).header('vary','Origin').header('access-control-allow-credentials','true').header('access-control-allow-headers','authorization, content-type, x-mylimits-request').header('access-control-allow-methods','GET, POST, PATCH, DELETE, OPTIONS')}
  if(req.method==='OPTIONS'){if(!allowed)throw new ApiError(403,'invalid_origin');return reply.code(204).send()}
 });
 app.addHook('preHandler',async(req)=>{
  if(!req.url.startsWith('/v1/'))return;
  if(req.method!=='GET'&&!req.headers.authorization&&(req.headers.origin!==config.origin||req.headers['x-mylimits-request']!=='1'))throw new ApiError(403,'invalid_origin');
  const p=await authenticate(pool,req.headers.authorization,req.headers.cookie,verify);(req as RequestWithPrincipal).principal=p;
  const now=Date.now(),old=budgets.get(p.owner),budget=old&&now-old.at<60000?old:{at:now,count:0};
  if(++budget.count>120)throw new ApiError(429,'request_budget_exceeded');budgets.delete(p.owner);budgets.set(p.owner,budget);if(budgets.size>10000)budgets.delete(budgets.keys().next().value!);
 });
 app.setErrorHandler((error,_req,reply)=>{
  if(error instanceof ApiError)return reply.code(error.status).send({error:error.code});
  const detail=error as {name?:string;statusCode?:number};
  if(detail.name==='ZodError'||detail.statusCode&&detail.statusCode>=400&&detail.statusCode<500)return reply.code(detail.statusCode??400).send({error:'invalid_request'});
  if((error as {code?:string}).code==='23505')return reply.code(409).send({error:'conflict'});
  return reply.code(500).send({error:'request_failed'});
 });
 const p=(r:FastifyRequest)=>(r as RequestWithPrincipal).principal;
 app.get('/health',async()=>({ok:true,mode:'snapshot-only',authenticationConfigured:!!config.oidc}));
 authRoutes(app,pool,config);
 pairingRoutes(app,pool);
 webRoutes(app);
 app.post('/v1/devices',async r=>{const b=z.object({name:z.string().trim().min(1).max(60)}).strict().parse(r.body);return registerDevice(pool,p(r),b.name)});
 app.get('/v1/devices',async r=>{requireWeb(p(r));return {devices:(await pool.query('SELECT id,name,revoked_at AS "revokedAt" FROM devices WHERE owner_id=$1 ORDER BY created_at',[p(r).owner])).rows}});
 app.delete('/v1/devices/:id',async r=>{
  const id=params(r);if(p(r).kind==='device'&&p(r).deviceId!==id)throw new ApiError(403,'wrong_device');await transaction(pool,async db=>{
   const found=await db.query('UPDATE devices SET revoked_at=now() WHERE owner_id=$1 AND id=$2 RETURNING id',[p(r).owner,id]);if(!found.rows.length)throw new ApiError(404,'device_not_found');
   await db.query("UPDATE connections SET enabled=false,status='disabled',generation=generation+1 WHERE owner_id=$1 AND device_id=$2",[p(r).owner,id]);
   await db.query('DELETE FROM jobs WHERE owner_id=$1 AND connection_id IN (SELECT id FROM connections WHERE owner_id=$1 AND device_id=$2)',[p(r).owner,id]);
   for(const table of ['encrypted_credentials','connection_cleanup'])await db.query(`DELETE FROM ${table} WHERE owner_id=$1 AND connection_id IN (SELECT id FROM connections WHERE owner_id=$1 AND device_id=$2)`,[p(r).owner,id]);
  });return {revoked:true};
 });
 app.post('/v1/snapshots/batch',async r=>upload(pool,p(r),r.body));
 app.get('/v1/accounts',async r=>({accounts:await accounts(pool,p(r)),mode:'snapshot-only'}));
 app.get('/v1/snapshots',async r=>{
  const q=z.object({accountId:identifier,limit:z.coerce.number().int().min(1).max(200).default(48),cursor:z.string().max(200).optional(),from:z.coerce.number().finite().min(0).max(8.64e15).optional(),to:z.coerce.number().finite().min(0).max(8.64e15).optional()}).strict().parse(r.query);
  let before:{time:number;id:string}|undefined;if(q.cursor){try{before=z.object({time:z.number().min(0).max(8.64e15),id:identifier}).strict().parse(JSON.parse(Buffer.from(q.cursor,'base64url').toString('utf8')))}catch{throw new ApiError(400,'invalid_cursor')}}
  if(q.from!==undefined&&q.to!==undefined&&q.from>q.to)throw new ApiError(400,'invalid_range');
  const page=await snapshots(pool,p(r),{...q,before});return {...page,cursor:page.cursor?Buffer.from(JSON.stringify(page.cursor)).toString('base64url'):null};
 });
 app.get('/v1/connections',async r=>({connections:(await pool.query('SELECT id,account_id AS "accountId",kind,status,enabled,generation FROM connections WHERE owner_id=$1',[p(r).owner])).rows}));
 app.post('/v1/connections/:id/refresh',async r=>{
  return jobs.enqueue(p(r).owner,params(r));
 });
 app.delete('/v1/connections/:id',async r=>{
  const id=params(r),prior=(await pool.query('SELECT kind,device_id FROM connections WHERE owner_id=$1 AND id=$2',[p(r).owner,id])).rows[0];
  if(!prior||p(r).kind==='device'&&prior.device_id!==p(r).deviceId)throw new ApiError(404,'connection_not_found');
  if(prior.kind==='cloud')return jobs.disconnect(p(r).owner,id);
  await transaction(pool,async db=>{
   const c=await db.query("UPDATE connections SET enabled=false,status='disabled',generation=generation+1 WHERE owner_id=$1 AND id=$2 AND ($3::uuid IS NULL OR device_id=$3) RETURNING id",[p(r).owner,id,p(r).kind==='device'?p(r).deviceId:null]);if(!c.rows.length)throw new ApiError(404,'connection_not_found');
   await db.query('DELETE FROM jobs WHERE owner_id=$1 AND connection_id=$2',[p(r).owner,id]);
  });return {disconnected:true,providerRevocation:'not-applicable-snapshot-only'};
 });
 app.delete('/v1/accounts/:id',async r=>{await deleteAccount(pool,p(r),params(r));return {deleted:true}});
 app.delete('/v1/source-data',async r=>{
  const principal=p(r);if(principal.kind!=='device'||!principal.deviceId)throw new ApiError(403,'device_authentication_required');
  const {sourceAccountId}=z.object({sourceAccountId:z.string().min(1).max(240)}).strict().parse(r.body);
  await transaction(pool,async db=>{
   const device=await db.query('SELECT id FROM devices WHERE owner_id=$1 AND id=$2 AND revoked_at IS NULL FOR UPDATE',[principal.owner,principal.deviceId]);if(!device.rows.length)throw new ApiError(401,'device_revoked');
   await db.query('INSERT INTO source_tombstones(owner_id,device_id,source_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[principal.owner,principal.deviceId,sourceAccountId]);
   const account=(await db.query('SELECT id FROM accounts WHERE owner_id=$1 AND device_id=$2 AND source_id=$3',[principal.owner,principal.deviceId,sourceAccountId])).rows[0];if(account)await deleteAccountInTransaction(db,principal,account.id);
  });return {deleted:true};
 });
 app.get('/v1/preferences',async r=>{
  const row=(await pool.query('SELECT revision,data FROM preferences WHERE owner_id=$1',[p(r).owner])).rows[0];return row??{revision:0,data:{}};
 });
 app.patch('/v1/preferences',async r=>{
  const body=z.object({expectedRevision:z.number().int().min(0),data:SyncPreferencesSchema}).strict().parse(r.body);
  return transaction(pool,async db=>{
   await db.query('INSERT INTO preferences(owner_id) VALUES($1) ON CONFLICT DO NOTHING',[p(r).owner]);
   const row=(await db.query('SELECT revision FROM preferences WHERE owner_id=$1 FOR UPDATE',[p(r).owner])).rows[0];if(row.revision!==body.expectedRevision)throw new ApiError(409,'preference_revision_conflict');
   for(const [id,name] of Object.entries(body.data.names??{})){const changed=await db.query('UPDATE accounts SET name=$3 WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id',[p(r).owner,id,name]);if(!changed.rows.length)throw new ApiError(404,'account_not_found')}
   const result=await db.query('UPDATE preferences SET data=data||$2::jsonb,revision=revision+1 WHERE owner_id=$1 RETURNING revision,data',[p(r).owner,JSON.stringify(body.data)]);return result.rows[0];
  });
 });
 app.delete('/v1/account-data',async r=>{
  requireWeb(p(r));z.object({confirmation:z.literal('delete-all')}).strict().parse(r.body);
  await transaction(pool,async db=>{
   await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[p(r).owner]);
   await db.query('UPDATE devices SET revoked_at=now() WHERE owner_id=$1',[p(r).owner]);
   await db.query("UPDATE accounts SET deleted_at=now(),name='Deleted account',plan=NULL WHERE owner_id=$1",[p(r).owner]);
   await db.query("UPDATE connections SET enabled=false,generation=generation+1,status='disabled' WHERE owner_id=$1",[p(r).owner]);
   await db.query('DELETE FROM jobs WHERE owner_id=$1',[p(r).owner]);await db.query('DELETE FROM snapshots WHERE owner_id=$1',[p(r).owner]);await db.query('DELETE FROM preferences WHERE owner_id=$1',[p(r).owner]);
   for(const table of ['encrypted_credentials','connection_cleanup'])await db.query(`DELETE FROM ${table} WHERE owner_id=$1`,[p(r).owner]);
   await db.query('DELETE FROM pair_requests WHERE approved_owner=$1',[p(r).owner]);
  });return {deleted:true,devicesRevoked:true};
 });
 return app;
}
