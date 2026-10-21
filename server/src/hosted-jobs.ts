import type pg from 'pg';
import { z } from 'zod';
import { MeterSchema } from '../../src/core/schema';
import { transaction,uuid } from './db';
import { ApiError } from './auth';
import { CollectorError } from './jobs';
import type { HostedService,HostedDriver } from './hosted';
import type { HostedProvider } from '../../src/core/hosted-contracts';
interface Lease {owner:string;connectionId:string;generation:number;token:string;provider:HostedProvider;subject:string;workspace:string;attempts:number;}
function interval(d:HostedDriver){return Math.max(60000,d.minRefreshMs);}
async function bounded<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw new Error('timeout');
 let listener!:()=>void;
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{listener=()=>reject(new Error('timeout'));signal.addEventListener('abort',listener,{once:true});})]);}finally{signal.removeEventListener('abort',listener);}
}
export class HostedJobs {
 readonly service:HostedService;readonly pool:pg.Pool;
 constructor(service:HostedService){this.service=service;this.pool=service.pool;}
 async enqueue(owner:string,id:string,now=Date.now()){
  return transaction(this.pool,async db=>{
   const c=(await db.query('SELECT * FROM hosted_connections WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,id])).rows[0];
   if(!c)throw new ApiError(404,'connection_not_found');
   if(!this.service.drivers.has(c.provider))throw new ApiError(409,'hosted_provider_unavailable');
   if(c.state==='disconnected'||c.state==='needs-auth')throw new ApiError(409,'reconnect_required');
   if(c.next_eligible_at!==null&&Number(c.next_eligible_at)>now)return {queued:false,nextEligibleAt:Number(c.next_eligible_at)};
   const r=await db.query('INSERT INTO hosted_jobs(owner_id,connection_id,generation,available_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING connection_id',[owner,id,c.generation,now]);
   return {queued:!!r.rows.length,nextEligibleAt:c.next_eligible_at===null?null:Number(c.next_eligible_at)};
  });
 }
 async schedule(now=Date.now()){
  if(!this.service.drivers.size)return;
  const rows=(await this.pool.query("SELECT owner_id,id FROM hosted_connections WHERE state IN ('active','error') AND (next_eligible_at IS NULL OR next_eligible_at<=$1) ORDER BY next_eligible_at NULLS FIRST LIMIT 100",[now])).rows;
  for(const c of rows)await this.enqueue(c.owner_id,c.id,now).catch(()=>{});
 }
 async lease(now=Date.now()):Promise<Lease|null>{
  return transaction(this.pool,async db=>{
   await db.query("SELECT pg_advisory_xact_lock(64923018)");
   await db.query('UPDATE hosted_jobs SET lease_token=NULL,lease_until=NULL WHERE lease_until<=$1',[now]);
   const running=(await db.query('SELECT count(*)::int n FROM hosted_jobs WHERE lease_token IS NOT NULL')).rows[0].n;if(running>=4)return null;
   const rows=(await db.query(`SELECT j.*,c.provider,c.subject,c.workspace FROM hosted_jobs j JOIN hosted_connections c ON c.owner_id=j.owner_id AND c.id=j.connection_id
    WHERE j.lease_token IS NULL AND j.available_at<=$1 AND c.generation=j.generation AND c.state IN ('active','error') ORDER BY j.available_at,j.connection_id LIMIT 100 FOR UPDATE OF j SKIP LOCKED`,[now])).rows;
   for(const r of rows){
    if(!this.service.drivers.has(r.provider))continue;
    const tenant=(await db.query('SELECT count(*)::int n FROM hosted_jobs WHERE owner_id=$1 AND lease_token IS NOT NULL',[r.owner_id])).rows[0].n;if(tenant>=2)continue;
    const budgetKey=`hosted:${r.provider}`;
    await db.query('INSERT INTO provider_budgets(provider,window_start,attempts) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[budgetKey,now]);
    const b=(await db.query('SELECT * FROM provider_budgets WHERE provider=$1 FOR UPDATE',[budgetKey])).rows[0];const reset=now-Number(b.window_start)>=60000;if(!reset&&b.attempts>=30)continue;
    await db.query('UPDATE provider_budgets SET window_start=$2,attempts=$3 WHERE provider=$1',[budgetKey,reset?now:Number(b.window_start),reset?1:b.attempts+1]);
    const token=uuid();await db.query('UPDATE hosted_jobs SET lease_token=$3,lease_until=$4,attempts=attempts+1 WHERE owner_id=$1 AND connection_id=$2',[r.owner_id,r.connection_id,token,now+30000]);
    return {owner:r.owner_id,connectionId:r.connection_id,generation:r.generation,token,provider:r.provider,subject:r.subject,workspace:r.workspace,attempts:r.attempts+1};
   }return null;
  });
 }
 private async valid(db:pg.PoolClient,l:Lease,now:number){
  const c=(await db.query("SELECT * FROM hosted_connections WHERE owner_id=$1 AND id=$2 AND generation=$3 AND state IN ('active','error') FOR UPDATE",[l.owner,l.connectionId,l.generation])).rows[0];
  if(!c)return null;
  const job=(await db.query('SELECT * FROM hosted_jobs WHERE owner_id=$1 AND connection_id=$2 AND generation=$3 AND lease_token=$4 AND lease_until>$5 FOR UPDATE',[l.owner,l.connectionId,l.generation,l.token,now])).rows[0];return job?c:null;
 }
 async finish(l:Lease,input:Awaited<ReturnType<HostedDriver['collect']>>,now=Date.now()){
  const parsed=z.object({subject:z.string(),workspace:z.string().nullable(),meters:z.array(MeterSchema).max(20),providerObservedAt:z.number().finite().nonnegative().nullable(),credential:z.string().min(1).max(16384).optional()}).strict().safeParse(input);
  const d=this.service.drivers.get(l.provider);if(!d||!parsed.success)throw new CollectorError('invalid-response');const r=parsed.data;
  if(r.subject!==l.subject||(r.workspace??'')!==l.workspace||r.providerObservedAt!==null&&r.providerObservedAt>now+60000||r.meters.some(m=>m.evidence!=='reported'||!d.scopes.includes(m.scope)))throw new CollectorError('invalid-response');
  const envelope=r.credential?await this.service.credentials.seal({owner:l.owner,connectionId:l.connectionId,generation:l.generation},r.credential):null;
  return transaction(this.pool,async db=>{
   if(!await this.valid(db,l,now))return false;
   if(envelope)await db.query('UPDATE hosted_credentials SET envelope=$4 WHERE owner_id=$1 AND connection_id=$2 AND generation=$3',[l.owner,l.connectionId,l.generation,JSON.stringify(envelope)]);
   await db.query('INSERT INTO hosted_readings(id,owner_id,connection_id,generation,fetched_at,provider_observed_at,meters) VALUES($1,$2,$3,$4,$5,$6,$7)',[uuid(),l.owner,l.connectionId,l.generation,now,r.providerObservedAt,JSON.stringify(r.meters)]);
   await db.query("UPDATE hosted_connections SET state='active',error_code=NULL,fetched_at=$3,provider_observed_at=$4,next_eligible_at=$5 WHERE owner_id=$1 AND id=$2",[l.owner,l.connectionId,now,r.providerObservedAt,now+interval(d)]);
   await db.query('DELETE FROM hosted_jobs WHERE owner_id=$1 AND connection_id=$2',[l.owner,l.connectionId]);return true;
  });
 }
 async fail(l:Lease,error:unknown,now=Date.now()){
  const e=error instanceof CollectorError?error:new CollectorError('network');
  return transaction(this.pool,async db=>{
   if(!await this.valid(db,l,now))return false;
   const d=this.service.drivers.get(l.provider)!;
   const retry=Math.max(now+interval(d),now+Math.min(3600000,30000*2**Math.min(l.attempts,7))+Math.floor(Math.random()*5000),e.retryAt??0);
   await db.query("UPDATE hosted_connections SET state=$3,error_code=$4,next_eligible_at=$5 WHERE owner_id=$1 AND id=$2",[l.owner,l.connectionId,e.code==='auth'?'needs-auth':'error',e.code,retry]);
   // Retry in a later scheduling pass after cooldown, never reset fetched_at.
   await db.query('DELETE FROM hosted_jobs WHERE owner_id=$1 AND connection_id=$2',[l.owner,l.connectionId]);return true;
  });
 }
 async runOne(){
  const l=await this.lease();if(!l)return false;
  try{
   const row=(await this.pool.query('SELECT envelope FROM hosted_credentials WHERE owner_id=$1 AND connection_id=$2 AND generation=$3',[l.owner,l.connectionId,l.generation])).rows[0];if(!row)throw new CollectorError('auth');
   const credential=await this.service.credentials.open({owner:l.owner,connectionId:l.connectionId,generation:l.generation},row.envelope);
   const signal=AbortSignal.timeout(20000),result=await bounded(this.service.drivers.get(l.provider)!.collect({credential,subject:l.subject,workspace:l.workspace||null,signal}),signal);
   await this.finish(l,result);
  }catch(e){await this.fail(l,e);}return true;
 }
 async maintenance(now=Date.now()){
  const expired=(await this.pool.query("UPDATE hosted_attempts SET state='expired' WHERE state='pending' AND expires_at<=$1 RETURNING owner_id,id,provider",[now])).rows;
  for(const a of expired)await this.service.drivers.get(a.provider)?.cancel({owner:a.owner_id,attemptId:a.id}).catch(()=>{});
  await this.pool.query("DELETE FROM hosted_attempts WHERE state!='pending' AND created_at<now()-interval '7 days'");
  // Preserve the newest dated reading per connection; bound history by age and count.
  await this.pool.query(`DELETE FROM hosted_readings WHERE id IN (SELECT id FROM (SELECT id,fetched_at,row_number() OVER(PARTITION BY owner_id,connection_id ORDER BY fetched_at DESC,id DESC) AS n FROM hosted_readings) r WHERE n>5000 OR n>1 AND fetched_at<$1)`,[now-30*86400000]);
 }
}
