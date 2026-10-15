import type pg from 'pg';
import { UsageSnapshotSchema } from '../../src/core/schema';
import type { UsageSnapshot } from '../../src/core/model';
import { transaction,uuid,type DB } from './db';
import { ApiError } from './auth';
import { CredentialStore,type Binding } from './credentials';
export class CollectorError extends Error {code:'auth'|'rate-limit'|'network'|'invalid-response';retryAt:number|null;constructor(code:CollectorError['code'],retryAt:number|null=null){super(code);this.code=code;this.retryAt=retryAt;}}
export interface Collector {
 requiresCredential:boolean;
 collect(context:Binding&{accountId:string;workspaceId:string|null;credential:string|null;kind:'refresh'|'renewal';signal:AbortSignal}):Promise<{identityHash:string;snapshot:UsageSnapshot;rotatedCredential?:string}>;
 revoke?(credential:string,signal:AbortSignal):Promise<void>;
}
// No production entry can be enabled by an environment flag. P2-01 did not pass.
export const productionCollectors:ReadonlyMap<string,Collector>=new Map();
export interface Lease {id:string;owner:string;connectionId:string;accountId:string;generation:number;provider:string;workspaceId:string|null;identityHash:string;kind:'refresh'|'renewal';attempts:number;token:string;}
export class JobRunner {
 pool:pg.Pool;credentials:CredentialStore;collectors:ReadonlyMap<string,Collector>;maxPerMinute:number;
 constructor(options:{pool:pg.Pool;credentials:CredentialStore;environment:string;testCollectors?:ReadonlyMap<string,Collector>;maxPerMinute?:number}){
  if(options.testCollectors&&options.environment!=='test')throw new Error('Fixture collectors are forbidden outside tests.');
  this.pool=options.pool;this.credentials=options.credentials;this.collectors=options.testCollectors??productionCollectors;this.maxPerMinute=options.maxPerMinute??30;
 }
 async enqueue(owner:string,connectionId:string,kind:'refresh'|'renewal'='refresh',now=Date.now()){
  return transaction(this.pool,async db=>{
   const c=(await db.query('SELECT c.*,a.provider FROM connections c JOIN accounts a ON a.owner_id=c.owner_id AND a.id=c.account_id WHERE c.owner_id=$1 AND c.id=$2 AND c.enabled=true AND a.deleted_at IS NULL FOR UPDATE OF c',[owner,connectionId])).rows[0];
   if(!c)throw new ApiError(404,'connection_not_found');if(c.kind!=='cloud'||!c.verified_identity_hash||!this.collectors.has(c.provider))throw new ApiError(409,'independent_collection_unavailable');
   if(c.status==='needs-auth')throw new ApiError(409,'reconnect_required');
   const r=await db.query("INSERT INTO jobs(id,owner_id,connection_id,generation,kind,available_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6/1000.0)) ON CONFLICT(owner_id,connection_id) WHERE status IN ('queued','running') DO UPDATE SET kind=jobs.kind RETURNING id",[uuid(),owner,connectionId,c.generation,kind,now]);return {id:r.rows[0].id};
  });
 }
 async lease(now=Date.now()):Promise<Lease|null>{
  return transaction(this.pool,async db=>{
   await db.query("UPDATE jobs SET status=CASE WHEN attempts>=6 THEN 'failed' ELSE 'queued' END,lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<=to_timestamp($1/1000.0)",[now]);
   const candidates=(await db.query(`SELECT j.*,c.account_id,c.workspace_id,c.verified_identity_hash,a.provider FROM jobs j JOIN connections c ON c.owner_id=j.owner_id AND c.id=j.connection_id JOIN accounts a ON a.owner_id=c.owner_id AND a.id=c.account_id
    WHERE j.status='queued' AND j.available_at<=to_timestamp($1/1000.0) AND j.attempts<6 AND c.enabled=true AND c.generation=j.generation AND c.kind='cloud' AND c.status!='needs-auth' AND a.deleted_at IS NULL ORDER BY j.available_at,j.id LIMIT 10 FOR UPDATE OF j SKIP LOCKED`,[now])).rows;
   for(const r of candidates){
    if(!this.collectors.has(r.provider))continue;
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`mylimits-budget:${r.provider}`]);
    const running=await db.query("SELECT count(*)::int AS n FROM jobs j JOIN connections c ON c.owner_id=j.owner_id AND c.id=j.connection_id JOIN accounts a ON a.owner_id=c.owner_id AND a.id=c.account_id WHERE a.provider=$1 AND j.status='running'",[r.provider]);if(running.rows[0].n>=4)continue;
    await db.query('INSERT INTO provider_budgets(provider,window_start,attempts) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[r.provider,now]);
    const b=(await db.query('SELECT * FROM provider_budgets WHERE provider=$1 FOR UPDATE',[r.provider])).rows[0];const reset=now-Number(b.window_start)>=60000;
    if(!reset&&b.attempts>=this.maxPerMinute)continue;
    await db.query('UPDATE provider_budgets SET window_start=$2,attempts=$3 WHERE provider=$1',[r.provider,reset?now:Number(b.window_start),reset?1:b.attempts+1]);
    const token=uuid();await db.query("UPDATE jobs SET status='running',attempts=attempts+1,lease_token=$2,lease_until=to_timestamp($3/1000.0) WHERE id=$1",[r.id,token,now+30000]);
    return {id:r.id,owner:r.owner_id,connectionId:r.connection_id,accountId:r.account_id,generation:r.generation,provider:r.provider,workspaceId:r.workspace_id,identityHash:r.verified_identity_hash,kind:r.kind,attempts:r.attempts+1,token};
   }return null;
  });
 }
 async finish(lease:Lease,result:{identityHash:string;snapshot:UsageSnapshot;rotatedCredential?:string},revision:number|null,now=Date.now()){
  const snapshot=UsageSnapshotSchema.parse(result.snapshot),binding={owner:lease.owner,connectionId:lease.connectionId,generation:lease.generation};
  if(result.identityHash!==lease.identityHash||snapshot.accountId!==lease.accountId||snapshot.connectionId!==lease.connectionId||snapshot.providerId!==lease.provider||snapshot.workspaceId!==lease.workspaceId||snapshot.observedAt>now+60000||snapshot.receivedAt>now+60000)throw new CollectorError('invalid-response');
  const envelope=result.rotatedCredential!==undefined?await this.credentials.seal(binding,result.rotatedCredential):null;
  return transaction(this.pool,async db=>{
   const active=await this.validLease(db,lease,now);if(!active)return false;
   if(envelope){if(revision===null)throw new CollectorError('invalid-response');await this.credentials.rotate(db,binding,envelope,revision,lease.token)}
   await db.query('INSERT INTO snapshots(id,owner_id,account_id,connection_id,device_id,source_snapshot_id,observed_at,received_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,device_id,source_snapshot_id) DO NOTHING',[uuid(),lease.owner,lease.accountId,lease.connectionId,active.device_id,`job:${lease.id}`,snapshot.observedAt,now,JSON.stringify(snapshot)]);
   await db.query("UPDATE connections SET status='active',message=NULL WHERE owner_id=$1 AND id=$2",[lease.owner,lease.connectionId]);await db.query("UPDATE jobs SET status='done',lease_token=NULL,lease_until=NULL,error_code=NULL WHERE id=$1",[lease.id]);return true;
  });
 }
 private async validLease(db:DB,l:Lease,now:number){
  const r=await db.query(`SELECT c.device_id FROM jobs j JOIN connections c ON c.owner_id=j.owner_id AND c.id=j.connection_id JOIN accounts a ON a.owner_id=c.owner_id AND a.id=c.account_id
  WHERE j.id=$1 AND j.owner_id=$2 AND j.status='running' AND j.lease_token=$3 AND j.lease_until>to_timestamp($4/1000.0) AND c.enabled=true AND c.generation=$5 AND j.generation=$5 AND a.deleted_at IS NULL FOR UPDATE OF j,c`,[l.id,l.owner,l.token,now,l.generation]);return r.rows[0];
 }
 async fail(lease:Lease,error:unknown,now=Date.now()){
  const e=error instanceof CollectorError?error:new CollectorError('network');
  return transaction(this.pool,async db=>{
   if(!await this.validLease(db,lease,now))return false;
   const terminal=e.code==='auth'||lease.attempts>=6,retry=Math.max(now+Math.min(3600000,30000*2**lease.attempts),Math.min(e.retryAt??0,now+86400000));
   await db.query("UPDATE jobs SET status=$2,available_at=to_timestamp($3/1000.0),lease_token=NULL,lease_until=NULL,error_code=$4 WHERE id=$1",[lease.id,terminal?'failed':'queued',retry,e.code]);
   await db.query('UPDATE connections SET status=$3,message=$4 WHERE owner_id=$1 AND id=$2',[lease.owner,lease.connectionId,e.code==='auth'?'needs-auth':'error',e.code==='auth'?'Reconnect the provider authorization.':'Collection failed; prior reading is retained.']);return true;
  });
 }
 async runOne(now=Date.now()){
  const lease=await this.lease(now);if(!lease)return false;
  try{const c=this.collectors.get(lease.provider)!;const binding={owner:lease.owner,connectionId:lease.connectionId,generation:lease.generation};const auth=c.requiresCredential?await this.credentials.read(binding):null;
   const result=await c.collect({...binding,accountId:lease.accountId,workspaceId:lease.workspaceId,credential:auth?.value??null,kind:lease.kind,signal:AbortSignal.timeout(20000)});
   await this.finish(lease,result,auth?.revision??null,Date.now());
  }catch(error){await this.fail(lease,error,Date.now())}return true;
 }
 async disconnect(owner:string,connectionId:string,now=Date.now()){
  await transaction(this.pool,async db=>{
   const c=(await db.query("UPDATE connections SET enabled=false,generation=generation+1,status='disabled' WHERE owner_id=$1 AND id=$2 RETURNING generation",[owner,connectionId])).rows[0];if(!c)throw new ApiError(404,'connection_not_found');
   await db.query('DELETE FROM jobs WHERE owner_id=$1 AND connection_id=$2',[owner,connectionId]);
   await db.query('INSERT INTO connection_cleanup(owner_id,connection_id,generation,available_at,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,connection_id) DO UPDATE SET generation=$3,attempts=0,available_at=$4,expires_at=$5',[owner,connectionId,c.generation,now,now+86400000]);
  });return {disconnected:true,providerRevocation:'pending'};
 }
 async cleanup(now=Date.now()){
  return transaction(this.pool,async db=>{
   const r=(await db.query(`SELECT x.*,c.enabled,c.generation AS current_generation,a.provider,e.envelope,e.generation AS credential_generation FROM connection_cleanup x JOIN connections c ON c.owner_id=x.owner_id AND c.id=x.connection_id JOIN accounts a ON a.owner_id=c.owner_id AND a.id=c.account_id LEFT JOIN encrypted_credentials e ON e.owner_id=x.owner_id AND e.connection_id=x.connection_id WHERE x.available_at<=$1 ORDER BY x.available_at LIMIT 1 FOR UPDATE OF x SKIP LOCKED`,[now])).rows[0];if(!r)return false;
   if(r.enabled||r.current_generation!==r.generation){await db.query('DELETE FROM connection_cleanup WHERE owner_id=$1 AND connection_id=$2',[r.owner_id,r.connection_id]);return true}
   let revoked=false;const collector=this.collectors.get(r.provider);
   if(r.envelope&&collector?.revoke&&r.expires_at>now&&r.attempts<3){try{const value=await this.credentials.open({owner:r.owner_id,connectionId:r.connection_id,generation:r.credential_generation},r.envelope);await collector.revoke(value,AbortSignal.timeout(10000));revoked=true}catch{/* Never persist an upstream error or secret. */}}
   if(!revoked&&r.envelope&&r.attempts<2&&Number(r.expires_at)>now&&collector?.revoke){await db.query('UPDATE connection_cleanup SET attempts=attempts+1,available_at=$3 WHERE owner_id=$1 AND connection_id=$2',[r.owner_id,r.connection_id,now+60000*2**r.attempts]);await db.query("UPDATE connections SET message='Disconnected locally; provider revocation is unconfirmed and cleanup will retry.' WHERE owner_id=$1 AND id=$2",[r.owner_id,r.connection_id]);return true}
   await db.query('DELETE FROM encrypted_credentials WHERE owner_id=$1 AND connection_id=$2',[r.owner_id,r.connection_id]);await db.query('DELETE FROM connection_cleanup WHERE owner_id=$1 AND connection_id=$2',[r.owner_id,r.connection_id]);
   await db.query('UPDATE connections SET message=$3 WHERE owner_id=$1 AND id=$2',[r.owner_id,r.connection_id,revoked?'Provider revocation confirmed.':'Disconnected locally; provider revocation is unconfirmed.']);return true;
  });
 }
}
