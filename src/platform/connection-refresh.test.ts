import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore,websiteConnection,type Store } from '../core/model';
import { accountId,applySnapshot,markConnection,markProvider } from '../core/engine';
import { vaultId } from '../core/connection-id';
import { changeConnection } from '../core/connections';
import { createConnectionRefresh,type ConnectionRefreshPort } from './connection-refresh';
import { AdapterError } from '../providers/errors';
const now=1800000000000;
const slots=['05e288dc-4612-4c98-8ea5-5557688394de','95fbcbfb-7fa6-4fa2-9a19-68bc51c60959'];
const snapshot=(identity:string,used=30)=>({identity,kind:'account' as const,displayName:'Fictional account',plan:null,meters:[{id:'session',label:'Session',scope:'subscription' as const,evidence:'reported' as const,unit:'percent' as const,used:null,total:null,usedPercent:used,resetsAt:null,source:'Fixture'}]});
const settle=()=>new Promise<void>(r=>setImmediate(r));
function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
async function fixture(){
 let state=emptyStore('isolation-test');const ids=await Promise.all(['A','B'].map(i=>accountId('claude',i,state.installSalt)));
 for(let i=0;i<2;i++){
  const id=vaultId('claude',slots[i]!);state.connections.push({...websiteConnection('claude'),id,kind:'vault',profileId:slots[i],enabled:true,status:'active'});
  state=applySnapshot(state,'claude',ids[i]!,snapshot(i===0?'A':'B',90),now-60000,{connectionId:id});
  state.accounts.find(a=>a.id===ids[i])!.alias=i===0?'Personal':'Work';
 }
 let queue:Promise<unknown>=Promise.resolve();const calls:string[]=[],history:string[]=[];
 const port:ConnectionRefreshPort={
  readStore:async()=>structuredClone(state),updateStore:<T>(mutate:(s:Store)=>{store:Store;value:T})=>{const task=queue.then(()=>{const result=mutate(structuredClone(state));state=result.store;return result.value;});queue=task.catch(()=>{});return task;},
  permitted:async()=>true,permissionMissing:async()=>{throw Error('Unexpected permission failure');},
  read:async c=>{calls.push(c.id);return snapshot(c.profileId===slots[0]?'A':'B',c.profileId===slots[0]?20:40);},
  cookieState:async()=>'unknown',saveHistory:async(_a,c)=>{history.push(c);},updated:async()=>{},now:()=>now,
 };
 return {port,calls,history,ids,read:()=>state,set:(s:Store)=>{state=s;},refresh:createConnectionRefresh(port),connections:slots.map(s=>vaultId('claude',s))};
}
test('two fictional same-provider connections refresh concurrently with independent IDs, aliases and snapshots',async()=>{
 const f=await fixture(),wait=gate();let running=0,peak=0;const original=f.port.read;
 f.port.read=async(...args)=>{running++;peak=Math.max(peak,running);await wait.promise;try{return await original(...args);}finally{running--;}};
 const mirror=structuredClone(f.read().providers.claude),work=Promise.all(f.connections.map(id=>f.refresh(id,'manual')));
 await settle();assert.equal(peak,2);wait.resolve();await work;
 assert.deepEqual(f.read().accounts.map(a=>[a.alias,a.connection,a.meters[0]!.usedPercent]).sort(),[['Personal','active',20],['Work','active',40]]);
 assert.equal(f.history.length,2);assert.deepEqual(f.read().providers.claude,mirror);
 assert.ok(f.connections.every(id=>f.read().snapshots.some(s=>s.connectionId===id&&s.observedAt===now)));
});
test('one failed connection and a website failure cannot invalidate the other source or its reading',async()=>{
 const f=await fixture(),original=f.port.read;const before=f.read().accounts.find(a=>a.id===f.ids[0])!.updatedAt;
 f.port.read=async(...args)=>{if(args[0].profileId===slots[0])throw new AdapterError('signed-out','Reconnect this fictional source.');return original(...args);};
 await Promise.all(f.connections.map(id=>f.refresh(id,'manual')));
 const a=f.read().accounts.find(a=>a.id===f.ids[0])!,b=f.read().accounts.find(a=>a.id===f.ids[1])!;
 assert.equal(a.connection,'signed-out');assert.equal(a.updatedAt,before);assert.equal(a.meters[0]!.usedPercent,90);
 assert.equal(b.connection,'active');assert.equal(b.meters[0]!.usedPercent,40);
 const failed=markProvider(f.read(),'claude','error','Website fixture failure',now+1);
 assert.equal(failed.accounts.find(a=>a.id===f.ids[1])!.connection,'active');
 assert.deepEqual(markConnection(f.read(),'missing','error','ignored',now),f.read());
});
test('saved source rejects wrong identity, preserving its old dated quota and all other accounts',async()=>{
 const f=await fixture();f.port.read=async()=>snapshot('Wrong account',5);
 await f.refresh(f.connections[0]!,'manual');const state=f.read();
 assert.equal(state.accounts.length,2);assert.equal(state.accounts[0]!.updatedAt,now-60000);assert.equal(state.accounts[0]!.meters[0]!.usedPercent,90);
 assert.equal(state.connections.find(c=>c.id===f.connections[0])!.status,'needs-auth');assert.equal(f.history.length,0);
});
test('coalescing and late disconnected generations cannot accept a new quota',async()=>{
 const f=await fixture(),wait=gate(),original=f.port.read;f.port.read=async(...args)=>{f.calls.push('started');await wait.promise;return original(...args);};
 const a=f.refresh(f.connections[0]!,'manual'),b=f.refresh(f.connections[0]!,'manual');await settle();assert.deepEqual(f.calls,['started']);
 f.set(changeConnection(f.read(),f.connections[0]!,{enabled:false,status:'disabled'},true));wait.resolve();await Promise.all([a,b]);
 assert.equal(f.read().accounts[0]!.updatedAt,now-60000);assert.equal(f.read().accounts[0]!.connection,'inactive');assert.equal(f.history.length,0);
});
test('connection refresh respects persisted waits and never sends imported data to the provider reader',async()=>{
 const f=await fixture();f.read().connections.find(c=>c.id===f.connections[0])!.nextRetryAt=now+60000;
 f.read().connections.find(c=>c.id===f.connections[1])!.kind='snapshot-import';
 await Promise.all(f.connections.map(id=>f.refresh(id,'manual')));assert.equal(f.calls.length,0);
});
