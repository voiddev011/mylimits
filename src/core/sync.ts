import { z } from 'zod';
import type { Store } from './model';
import { syncItem,SyncPreferencesSchema } from './sync-contracts';
const Pair=z.object({id:z.string().uuid(),secret:z.string().min(32).max(100),code:z.string().regex(/^[A-F0-9]{12}$/),expiresAt:z.number()});
const State=z.object({version:z.literal(1),origin:z.string(),enabled:z.boolean(),deviceId:z.string().uuid().nullable(),token:z.string().nullable(),pair:Pair.nullable(),
 acknowledged:z.array(z.string()).max(500),excluded:z.array(z.string()).max(1000),pendingDeletes:z.array(z.string().min(1).max(240)).max(1000),mappings:z.record(z.string(),z.string().uuid()),
 failures:z.number().int().min(0),nextAttemptAt:z.number().nullable(),lastAttemptAt:z.number().nullable(),lastSyncedAt:z.number().nullable(),preferenceRevision:z.number().int().min(0),error:z.string().nullable()});
export type SyncPrivate=z.infer<typeof State>;
export interface SyncPublic {configured:boolean;origin:string;enabled:boolean;connected:boolean;pairing:{code:string;expiresAt:number}|null;pendingDeletes:number;lastSyncedAt:number|null;error:string|null;}
export interface SyncPort {read():Promise<unknown>;write(value:SyncPrivate):Promise<void>;request(path:string,options:{method:string;token?:string;body?:unknown;signal:AbortSignal}):Promise<unknown>;store():Promise<Store>;}
export class SyncError extends Error {status:number;constructor(status:number){super(`Sync request failed (${status}).`);this.status=status}}
const initial=(origin:string):SyncPrivate=>({version:1,origin,enabled:false,deviceId:null,token:null,pair:null,acknowledged:[],excluded:[],pendingDeletes:[],mappings:{},failures:0,nextAttemptAt:null,lastAttemptAt:null,lastSyncedAt:null,preferenceRevision:0,error:null});
export class SnapshotSync {
 origin:string;port:SyncPort;private queue:Promise<unknown>=Promise.resolve();private active:AbortController|null=null;
 constructor(origin:string,port:SyncPort){this.origin=origin;this.port=port;}
 private async state(){const raw=await this.port.read();if(raw===undefined)return initial(this.origin);const parsed=State.safeParse(raw);if(!parsed.success)throw new Error('Saved sync state needs recovery. Local account data is unchanged.');return parsed.data;}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const task=this.queue.then(fn);this.queue=task.catch(()=>{});return task}
 private public(s:SyncPrivate):SyncPublic{return {configured:!!this.origin,origin:this.origin,enabled:s.enabled,connected:!!s.token,pairing:s.pair?{code:s.pair.code,expiresAt:s.pair.expiresAt}:null,pendingDeletes:s.pendingDeletes.length,lastSyncedAt:s.lastSyncedAt,error:s.origin!==this.origin?'Sync server changed. Remove the local sync connection before pairing again.':s.error};}
 async status(){return this.public(await this.state())}
 private async request(s:SyncPrivate,path:string,method='GET',body?:unknown){
  if(!this.origin||s.origin!==this.origin)throw new Error('Sync server is not configured for this connection.');
  this.active=new AbortController();try{return await this.port.request(path,{method,token:s.token??undefined,body,signal:AbortSignal.any([this.active.signal,AbortSignal.timeout(10000)])})}finally{this.active=null}
 }
 async start(name='My browser'){return this.serial(async()=>{const s=await this.state();if(s.token)throw new Error('Disconnect the existing sync device first.');const next=initial(this.origin);next.pair=Pair.parse(await this.request(next,'/pairing/start','POST',{name}));await this.port.write(next);return this.public(next)})}
 async poll(enableSnapshotSync=true){return this.serial(async()=>{const s=await this.state();if(!s.pair)return this.public(s);if(s.pair.expiresAt<Date.now()){s.pair=null;s.error='Pairing expired. Start again.'}else{
   const result=z.discriminatedUnion('status',[z.object({status:z.literal('pending')}),z.object({status:z.literal('connected'),deviceId:z.string().uuid(),token:z.string().min(32).max(200)})]).parse(await this.request(s,'/pairing/poll','POST',{id:s.pair.id,secret:s.pair.secret}));
   if(result.status==='connected'){s.deviceId=result.deviceId;s.token=result.token;s.enabled=enableSnapshotSync;s.pair=null;s.error=null;}
  }await this.port.write(s);return this.public(s)})}
 async enable(enabled:boolean){if(!enabled)this.active?.abort();return this.serial(async()=>{const s=await this.state();s.enabled=enabled&&!!s.token;s.error=null;await this.port.write(s);return this.public(s)})}
 async reset(){this.active?.abort();return this.serial(async()=>{const s=initial(this.origin);await this.port.write(s);return this.public(s)})}
 async forget(accountId:string){return this.serial(async()=>{const s=await this.state();if(!s.excluded.includes(accountId))s.excluded.push(accountId);if(s.deviceId&&!s.pendingDeletes.includes(accountId))s.pendingDeletes.push(accountId);s.excluded=s.excluded.slice(-1000);await this.port.write(s)})}
 async run(manual=false,now=Date.now()){return this.serial(async()=>{
  const s=await this.state();if(!s.enabled||!s.token||!s.deviceId||s.origin!==this.origin)return this.public(s);
  if(s.nextAttemptAt!==null&&s.nextAttemptAt>now||s.lastAttemptAt!==null&&now-s.lastAttemptAt<(manual?15000:60000))return this.public(s);
  s.lastAttemptAt=now;try{
   for(const id of [...s.pendingDeletes]){try{await this.request(s,'/v1/source-data','DELETE',{sourceAccountId:id})}catch(e){if(!(e instanceof SyncError&&[404,410].includes(e.status)))throw e}s.pendingDeletes=s.pendingDeletes.filter(x=>x!==id);delete s.mappings[id];await this.port.write(s)}
   const local=await this.port.store(),expired=local.snapshots.filter(x=>x.observedAt<now-90*86400000);
   const pending=local.snapshots.filter(x=>!x.accountId.startsWith('hosted:')&&x.observedAt>=now-90*86400000&&x.observedAt<=now+60000&&x.receivedAt<=now+60000&&!s.acknowledged.includes(x.snapshotId)&&!s.excluded.includes(x.accountId)&&local.accounts.some(a=>a.id===x.accountId));
   let batches=0;
   for(const accountId of [...new Set(pending.map(x=>x.accountId))]){
    if(batches++>=5)break;const account=local.accounts.find(a=>a.id===accountId)!;const items=pending.filter(x=>x.accountId===accountId).slice(0,20).map(x=>syncItem(account,x));
    try{const response=z.object({accepted:z.array(z.object({snapshotId:z.string(),accountId:z.string().uuid(),connectionId:z.string().uuid(),duplicate:z.boolean()}))}).parse(await this.request(s,'/v1/snapshots/batch','POST',{deviceId:s.deviceId,items}));
     for(const accepted of response.accepted){if(!items.some(i=>i.snapshot.snapshotId===accepted.snapshotId))throw new Error('Unrecognized sync acknowledgement.');s.mappings[accountId]=accepted.accountId;if(!s.acknowledged.includes(accepted.snapshotId))s.acknowledged.push(accepted.snapshotId)}s.acknowledged=s.acknowledged.slice(-500);
    }catch(e){if(e instanceof SyncError&&e.status===410){if(!s.excluded.includes(accountId))s.excluded.push(accountId)}else throw e}
    await this.port.write(s);
   }
   s.failures=0;s.nextAttemptAt=null;s.error=expired.length?'Readings older than 90 days stay local; newer snapshots are synced.':null;s.lastSyncedAt=now;
  }catch(e){s.failures++;s.nextAttemptAt=now+Math.min(3600000,30000*2**Math.min(6,s.failures));s.error=e instanceof SyncError&&e.status===401?'Device access was revoked or expired. Disconnect and pair again.':'Sync is waiting to retry. Local tracking continues.';if(e instanceof SyncError&&e.status===401)s.enabled=false;}
  await this.port.write(s);return this.public(s);
 })}
 async hostedRequest(path:string,method='GET',body?:unknown){return this.serial(async()=>{
  if(!/^\/v1\/hosted\/(connections(?:\/[0-9a-f-]{36}(?:\/(?:refresh|data))?)?|attempts(?:\/[0-9a-f-]{36})?)$/i.test(path)||!['GET','POST','PATCH','DELETE'].includes(method))throw new Error('Invalid hosted operation.');
  const s=await this.state();if(!s.token)throw new Error('Connect MyLimits first.');
  try{return await this.request(s,path,method,body);}catch(e){if(e instanceof SyncError&&e.status===401){s.token=null;s.deviceId=null;s.enabled=false;s.pair=null;s.error='MyLimits access expired. Sign in again.';await this.port.write(s);}throw e;}
 })}
 async pushPreferences(){return this.serial(async()=>{const s=await this.state();if(!s.enabled||!s.token)throw new Error('Connect sync first.');const local=await this.port.store();const names=Object.fromEntries(local.accounts.flatMap(a=>s.mappings[a.id]?[[s.mappings[a.id]!,(a.alias||a.defaultName||a.provider).slice(0,60)]]:[]));
  try{const result=z.object({revision:z.number().int()}).parse(await this.request(s,'/v1/preferences','PATCH',{expectedRevision:s.preferenceRevision,data:SyncPreferencesSchema.parse({settings:local.settings,names})}));s.preferenceRevision=result.revision;s.error=null;await this.port.write(s);return this.public(s)}catch(e){if(e instanceof SyncError&&e.status===409)throw new Error('Cloud preferences changed. Review/apply them before pushing again.');throw e}
 })}
 async pullPreferences(){return this.serial(async()=>{const s=await this.state();if(!s.enabled||!s.token)throw new Error('Connect sync first.');const result=z.object({revision:z.number().int(),data:SyncPreferencesSchema}).parse(await this.request(s,'/v1/preferences'));s.preferenceRevision=result.revision;await this.port.write(s);
  return {settings:result.data.settings,names:Object.fromEntries(Object.entries(s.mappings).flatMap(([local,remote])=>result.data.names?.[remote]!==undefined?[[local,result.data.names[remote]]]:[]))};
 })}
 async disconnect(){this.active?.abort();return this.serial(async()=>{const s=await this.state();s.enabled=false;await this.port.write(s);if(s.token&&s.deviceId){try{for(const id of s.pendingDeletes)await this.request(s,'/v1/source-data','DELETE',{sourceAccountId:id});await this.request(s,`/v1/devices/${s.deviceId}`,'DELETE')}catch(e){if(!(e instanceof SyncError&&e.status===401)){s.error='Disconnected locally; server revocation is unconfirmed. Retry disconnect or revoke the device in the dashboard.';await this.port.write(s);return this.public(s)}}}const next=initial(this.origin);await this.port.write(next);return this.public(next)})}
}
