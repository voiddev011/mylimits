import type pg from 'pg';
import { z } from 'zod';
import { ApiError,opaque } from './auth';
import { hash,transaction,uuid } from './db';
import { CredentialStore } from './credentials';
import { HostedAttemptSchema,HostedConnectionSchema,HostedStartSchema,HostedRenameSchema,unavailableCapabilities,type HostedProvider } from '../../src/core/hosted-contracts';
import { MeterSchema } from '../../src/core/schema';

// Drivers own official authorization, PKCE/nonce verification, credentials and renewal.
// There is deliberately no external generic "complete" or token-upload endpoint.
export interface HostedDriver {
 method:'official-popup'; scopes:string[]; minRefreshMs:number;
 begin(c:{owner:string;attemptId:string;proof:string;expiresAt:number;signal:AbortSignal}):Promise<{authorizationUrl:string}>;
 cancel(c:{owner:string;attemptId:string}):Promise<void>;
 collect(c:{credential:string;subject:string;workspace:string|null;signal:AbortSignal}):Promise<{subject:string;workspace:string|null;meters:z.infer<typeof MeterSchema>[];providerObservedAt:number|null;credential?:string}>;
 revoke?(credential:string,signal:AbortSignal):Promise<void>;
}
export const hostedDrivers:ReadonlyMap<HostedProvider,HostedDriver>=new Map();
export const ProofSchema=z.object({subject:z.string().min(1).max(240),workspace:z.string().max(240).nullable(),credential:z.string().min(1).max(16384)}).strict();
export class HostedService {
 readonly drivers:ReadonlyMap<HostedProvider,HostedDriver>;
 readonly pool:pg.Pool; readonly credentials:CredentialStore;
 constructor(pool:pg.Pool,credentials:CredentialStore,environment:string,testDrivers?:ReadonlyMap<HostedProvider,HostedDriver>){
  if(testDrivers&&environment!=='test')throw new Error('Fixture hosted drivers forbidden outside tests.');
  this.pool=pool;this.credentials=credentials;this.drivers=testDrivers??hostedDrivers;
 }
 capabilities(){const c=unavailableCapabilities();for(const p of c.providers){const d=this.drivers.get(p.provider);if(d){p.available=true;p.method=d.method;p.scopes=d.scopes;p.reason='available';}}return c;}
 private driver(provider:HostedProvider){const d=this.drivers.get(provider);if(!d)throw new ApiError(409,'hosted_provider_unavailable');return d;}
 private publicAttempt(row:any,authorizationUrl:string|null=null){return HostedAttemptSchema.parse({id:row.id,provider:row.provider,state:row.state,expiresAt:Number(row.expires_at),connectionId:row.connection_id,authorizationUrl});}
 async attempt(owner:string,id:string,now=Date.now()){
  await this.pool.query("UPDATE hosted_attempts SET state='expired' WHERE owner_id=$1 AND id=$2 AND state='pending' AND expires_at<=$3",[owner,id,now]);
  const row=(await this.pool.query('SELECT * FROM hosted_attempts WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row)throw new ApiError(404,'attempt_not_found');return this.publicAttempt(row);
 }
 async start(owner:string,input:unknown,now=Date.now()){
  const b=HostedStartSchema.parse(input),driver=this.driver(b.provider),proof=opaque();
  const prepared=await transaction(this.pool,async db=>{
   await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[owner]);
   const old=(await db.query('SELECT * FROM hosted_attempts WHERE owner_id=$1 AND request_id=$2',[owner,b.requestId])).rows[0];
   if(old){if(old.provider!==b.provider||(old.reconnect_id??null)!==(b.reconnectId??null))throw new ApiError(409,'request_id_conflict');return {row:old,created:false};}
   await db.query("UPDATE hosted_attempts SET state='expired' WHERE owner_id=$1 AND state='pending' AND expires_at<=$2",[owner,now]);
   const count=await db.query("SELECT count(*)::int n FROM hosted_attempts WHERE owner_id=$1 AND state='pending'",[owner]);if(count.rows[0].n>=3)throw new ApiError(429,'too_many_attempts');
   const connections=await db.query("SELECT count(*)::int n FROM hosted_connections WHERE owner_id=$1",[owner]);if(connections.rows[0].n>=200&&!b.reconnectId)throw new ApiError(409,'connection_limit');
   let generation=0;
   if(b.reconnectId){const c=(await db.query('SELECT * FROM hosted_connections WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,b.reconnectId])).rows[0];if(!c||c.provider!==b.provider)throw new ApiError(404,'connection_not_found');
    generation=c.generation+1;
    await db.query("UPDATE hosted_connections SET generation=$3,state='needs-auth',error_code='auth' WHERE owner_id=$1 AND id=$2",[owner,c.id,generation]);
    await db.query('DELETE FROM hosted_jobs WHERE owner_id=$1 AND connection_id=$2',[owner,c.id]);
    await db.query("UPDATE hosted_attempts SET state='cancelled' WHERE owner_id=$1 AND reconnect_id=$2 AND state='pending'",[owner,c.id]);
   }
   const row=(await db.query('INSERT INTO hosted_attempts(id,owner_id,provider,request_id,reconnect_id,generation,proof_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[uuid(),owner,b.provider,b.requestId,b.reconnectId??null,generation,hash(proof),now+600000])).rows[0];return {row,created:true};
  });
  if(!prepared.created)return this.attempt(owner,prepared.row.id,now);
  try{
   const result=await driver.begin({owner,attemptId:prepared.row.id,proof,expiresAt:now+600000,signal:AbortSignal.timeout(15000)});
   const u=new URL(result.authorizationUrl),allowed=b.provider==='openai'?['auth.openai.com']:['claude.ai','claude.com'];
   if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!allowed.includes(u.hostname)||!['/oauth/authorize','/cai/oauth/authorize'].includes(u.pathname)||u.searchParams.get('state')!==proof)throw new ApiError(502,'invalid_authorization_response');
   const state=await this.attempt(owner,prepared.row.id);
   if(state.state!=='pending'){await driver.cancel({owner,attemptId:state.id});return state;}
   return {...state,authorizationUrl:u.href};
  }catch{
   await this.pool.query("UPDATE hosted_attempts SET state='failed' WHERE owner_id=$1 AND id=$2 AND state='pending'",[owner,prepared.row.id]);
   await driver.cancel({owner,attemptId:prepared.row.id}).catch(()=>{});
   throw new ApiError(502,'authorization_start_failed');
  }
 }
 async cancel(owner:string,id:string){
  const r=(await this.pool.query("UPDATE hosted_attempts SET state=CASE WHEN state='pending' THEN 'cancelled' ELSE state END WHERE owner_id=$1 AND id=$2 RETURNING *",[owner,id])).rows[0];if(!r)throw new ApiError(404,'attempt_not_found');
  await this.drivers.get(r.provider)?.cancel({owner,attemptId:id}).catch(()=>{});return this.publicAttempt(r);
 }
 // Invoked only by an official, server-owned driver AFTER validating its provider response.
 async complete(owner:string,id:string,proof:string,input:unknown,now=Date.now()){
  const verified=ProofSchema.parse(input);
  return transaction(this.pool,async db=>{
   await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[owner]);
   const a=(await db.query('SELECT * FROM hosted_attempts WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,id])).rows[0];
   if(!a||a.state!=='pending'||Number(a.expires_at)<=now||a.proof_hash!==hash(proof))throw new ApiError(409,'attempt_not_active');
   const d=this.driver(a.provider),workspace=verified.workspace??'';
   const prior=(await db.query('SELECT * FROM hosted_connections WHERE owner_id=$1 AND provider=$2 AND method=$3 AND subject=$4 AND workspace=$5 FOR UPDATE',[owner,a.provider,d.method,verified.subject,workspace])).rows[0];
   if(prior&&prior.id!==a.reconnect_id){const row=(await db.query("UPDATE hosted_attempts SET state='duplicate',connection_id=$3 WHERE owner_id=$1 AND id=$2 RETURNING *",[owner,id,prior.id])).rows[0];return this.publicAttempt(row);}
   const connectionId=a.reconnect_id??uuid();
   if(a.reconnect_id){const c=(await db.query('SELECT * FROM hosted_connections WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,connectionId])).rows[0];
    if(!c||c.generation!==a.generation||c.state==='disconnected'||c.subject!==verified.subject||c.workspace!==workspace)throw new ApiError(409,'wrong_account');
   }
   const envelope=await this.credentials.seal({owner,connectionId,generation:a.generation},verified.credential);
   if(!a.reconnect_id)await db.query('INSERT INTO hosted_connections(id,owner_id,provider,method,subject,workspace,capabilities) VALUES($1,$2,$3,$4,$5,$6,$7)',[connectionId,owner,a.provider,d.method,verified.subject,workspace,JSON.stringify(d.scopes)]);
   else await db.query("UPDATE hosted_connections SET state='active',error_code=NULL WHERE owner_id=$1 AND id=$2",[owner,connectionId]);
   await db.query('INSERT INTO hosted_credentials(owner_id,connection_id,generation,envelope) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,connection_id) DO UPDATE SET generation=$3,envelope=$4',[owner,connectionId,a.generation,JSON.stringify(envelope)]);
   const row=(await db.query("UPDATE hosted_attempts SET state='connected',connection_id=$3 WHERE owner_id=$1 AND id=$2 RETURNING *",[owner,id,connectionId])).rows[0];return this.publicAttempt(row);
  });
 }
 async list(owner:string){
  const rows=(await this.pool.query(`SELECT c.*,r.meters FROM hosted_connections c LEFT JOIN LATERAL (SELECT meters FROM hosted_readings WHERE owner_id=c.owner_id AND connection_id=c.id ORDER BY fetched_at DESC,id DESC LIMIT 1) r ON true WHERE c.owner_id=$1 ORDER BY c.created_at,c.id LIMIT 200`,[owner])).rows;
  return {version:1 as const,connections:rows.map(c=>HostedConnectionSchema.parse({id:c.id,provider:c.provider,alias:c.alias,identity:{subject:c.subject,workspace:c.workspace||null},method:c.method,capabilities:c.capabilities,state:c.state,generation:c.generation,meters:c.meters??[],fetchedAt:c.fetched_at===null?null:Number(c.fetched_at),providerObservedAt:c.provider_observed_at===null?null:Number(c.provider_observed_at),nextEligibleAt:c.next_eligible_at===null?null:Number(c.next_eligible_at),staleReason:c.state==='disconnected'?'disconnected':c.state==='needs-auth'?'reconnect-required':c.error_code?'fetch-failed':c.fetched_at===null?'never-fetched':null,error:c.error_code}))};
 }
 async rename(owner:string,id:string,input:unknown){const b=HostedRenameSchema.parse(input);const r=await this.pool.query('UPDATE hosted_connections SET alias=$3 WHERE owner_id=$1 AND id=$2 RETURNING id',[owner,id,b.alias]);if(!r.rows.length)throw new ApiError(404,'connection_not_found');return {renamed:true};}
 async disconnect(owner:string,id:string){
  await transaction(this.pool,async db=>{
   const c=(await db.query("UPDATE hosted_connections SET state='disconnected',generation=generation+1 WHERE owner_id=$1 AND id=$2 RETURNING id",[owner,id])).rows[0];if(!c)throw new ApiError(404,'connection_not_found');
   await db.query("UPDATE hosted_attempts SET state='cancelled' WHERE owner_id=$1 AND reconnect_id=$2 AND state='pending'",[owner,id]);
   await db.query('DELETE FROM hosted_jobs WHERE owner_id=$1 AND connection_id=$2',[owner,id]);
   await db.query('DELETE FROM hosted_credentials WHERE owner_id=$1 AND connection_id=$2',[owner,id]);
  });return {disconnected:true,providerRevocation:'unconfirmed'};
 }
}
