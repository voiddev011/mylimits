import type { Store,Account,ConnectionRecord,UsageSnapshot } from './model';
import { HostedListSchema } from './hosted-contracts';
export const hostedLocalId=(id:string)=>`hosted:${id}`;
export function remoteHostedId(id:string){return /^hosted:[0-9a-f-]{36}$/i.test(id)?id.slice(7):null;}
/** Additive projection: never merge website/native identity or overwrite local history. */
export function mergeHosted(input:Store,payload:unknown,now:number):Store{
 const list=HostedListSchema.parse(payload),store=structuredClone(input),seen=new Set<string>();
 for(const c of list.connections){
  const id=hostedLocalId(c.id);seen.add(id);const provider=c.provider==='openai'?'chatgpt':'claude';
  const old=store.accounts.find(a=>a.id===id);
  if(!old&&(store.accounts.length>=100||store.connections.length>=200)){store.historyIssue='Device account capacity reached. Existing accounts and history were preserved.';continue;}
  // A delayed response must not move a successful reading backwards.
  const previous=store.connections.find(v=>v.id===id);
  if(previous&&c.generation<previous.generation)continue;
  if(previous?.generation===c.generation&&old&&c.fetchedAt!==null&&c.fetchedAt<old.updatedAt)continue;
  if(c.fetchedAt!==null&&c.fetchedAt>now+60000||c.providerObservedAt!==null&&c.providerObservedAt>now+60000||c.meters.some(m=>m.observedAt!==undefined&&m.observedAt>now+60000))throw new Error('Future hosted reading rejected.');
  const status=c.state==='active'?'active':c.state==='needs-auth'?'signed-out':c.state==='disconnected'?'inactive':'error';
  const meters=c.meters.map(m=>({...m,connectionId:id,observedAt:m.observedAt??c.providerObservedAt??c.fetchedAt??0}));
  const a:Account={...(old??{id,provider,kind:'account',alias:'',defaultName:c.provider==='openai'?'OpenAI account':'Claude account',plan:null,createdAt:now,alertRemaining:null,alertsMuted:false}),alias:c.alias,connection:status,meters,updatedAt:c.fetchedAt??0};
  store.accounts=store.accounts.filter(a=>a.id!==id);store.accounts.push(a);
  const connection:ConnectionRecord={id,provider,kind:'cloud',accountId:id,workspaceId:c.identity.workspace,workspaceIds:[],enabled:c.state!=='disconnected',status:c.state==='needs-auth'?'needs-auth':c.state==='disconnected'?'disabled':c.state,generation:c.generation,lastAttemptAt:null,lastSuccessAt:c.fetchedAt,nextRetryAt:c.nextEligibleAt,failures:c.error?1:0,message:c.error?'Refresh failed; showing the last successful reading.':c.fetchedAt===null?'No quota reading yet.':null};
  store.connections=store.connections.filter(v=>v.id!==id);store.connections.push(connection);
  if(c.fetchedAt!==null){
   const snapshotId=`${id}:${c.fetchedAt}`;
   if(!store.snapshots.some(s=>s.snapshotId===snapshotId)){
    const s:UsageSnapshot={schemaVersion:2,snapshotId,providerId:provider,accountId:id,connectionId:id,workspaceId:c.identity.workspace,observedAt:c.providerObservedAt??c.fetchedAt,receivedAt:c.fetchedAt,connectorVersion:'hosted-v1',meters};
    store.snapshots.push(s);
   }
  }
 }
 // Missing/revoked remote connections keep clearly inactive dated readings.
 for(const a of store.accounts)if(remoteHostedId(a.id)&&!seen.has(a.id))a.connection='inactive';
 for(const c of store.connections)if(remoteHostedId(c.id)&&!seen.has(c.id)){c.enabled=false;c.status='disabled';}
 store.snapshots=store.snapshots.slice(-400);
 return store;
}
export function hostedUnavailable(input:Store):Store{
 const store=structuredClone(input);
 for(const a of store.accounts)if(remoteHostedId(a.id))a.connection='offline';
 for(const c of store.connections)if(remoteHostedId(c.id)&&c.enabled){c.status='offline';c.message='Hosted service unavailable; showing dated readings.';}
 return store;
}
