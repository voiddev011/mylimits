import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { parseCopilot,copilotIdentity } from '../core/copilot';
import { readCopilot } from './copilot';
import { createTokenVault,TOKEN_KEY } from './token-vault';
import { createCopilotAccounts } from './copilot-accounts';
import { emptyStore } from '../core/model';
import { StoreSchema } from '../core/schema';
import { toPublicState } from '../core/public';
import { diagnostics } from '../core/presentation';
import { exportReadings,historyPoint } from '../core/history-data';
import { shouldRefresh } from '../core/scheduler';
import type { Store } from '../core/model';
const now=Date.UTC(2026,9,24),secret='github_pat_FAKE_TEST_SECRET_12345',slot='10000000-0000-4000-8000-000000000001';
const usage=(items:unknown[]=[])=>({user:'alice',timePeriod:{year:2026,month:10},usageItems:items});
const row=(n:number)=>({product:'Copilot',unitType:'requests',grossQuantity:n,netQuantity:0});
const response=(v:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(v),{status,headers});
test('Copilot sums gross quantities, excludes other products, preserves unknown allowance and empty month',()=>{
 const parsed=parseCopilot({id:'1',login:'alice'},usage([row(4),row(1.5),{product:'Other',grossQuantity:80}]),now,null);
 assert.equal(parsed.meters[0]!.used,5.5);assert.equal(parsed.meters[0]!.total,null);assert.equal(parsed.meters[0]!.usedPercent,null);
 assert.equal(parsed.meters[0]!.resetsAt,Date.UTC(2026,10,1));
 assert.equal(parseCopilot({id:'1',login:'alice'},usage(),now,50).meters[0]!.remaining,50);
 assert.throws(()=>parseCopilot({id:'1',login:'bob'},usage(),now,50));
 assert.throws(()=>parseCopilot({id:'1',login:'alice'},usage([row(-1)]),now,50));
 assert.throws(()=>parseCopilot({id:'1',login:'alice'},{...usage(),timePeriod:{year:2026,month:9}},now,50));
 assert.throws(()=>copilotIdentity({login:'alice',id:NaN}));
});
test('official REST only, explicit month, required headers, identity verified around usage',async()=>{
 const calls:string[]=[];
 const reading=await readCopilot(secret,300,now,async(url,options)=>{
  calls.push(url);assert.equal(new URL(url).origin,'https://api.github.com');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  const h=options.headers as Record<string,string>;assert.equal(h.Authorization,`Bearer ${secret}`);assert.equal(h.Accept,'application/vnd.github+json');assert.equal(h['X-GitHub-Api-Version'],'2022-11-28');
  return response(url.includes('/usage?')?usage([row(20)]):{id:1,login:'alice'});
 });
 assert.equal(calls.length,3);assert.match(calls[1]!,/year=2026&month=10&product=Copilot/);assert.equal(reading.meters[0]!.used,20);
 let i=0;await assert.rejects(readCopilot(secret,null,now,async()=>response(++i===1?{id:1,login:'alice'}:i===2?usage():{id:2,login:'bob'})),/could not be verified/);
});
test('401 stops authentication, permission errors guide Plan: read, rate limits retain deadline, errors never echo response or token',async()=>{
 for(const status of [401,403,404,429])await assert.rejects(readCopilot(secret,null,now,async()=>response({message:secret},status,{'retry-after':status===429?'3600':''})),e=>{
  assert.ok(e instanceof Error);assert.ok(!e.message.includes(secret));
  if(status===401)assert.match(e.message,/expired or revoked/);
  if(status===403||status===404)assert.match(e.message,/Plan: read/);
  if(status===429)assert.equal((e as Error&{retryAt:number}).retryAt,now+3600000);
  return true;
 });
 await assert.rejects(readCopilot(secret,null,now,async()=>{throw Error(secret)}),/could not be reached/);
});
async function tokenFixture(){
 const data:Record<string,unknown>={};let key:CryptoKey|undefined;
 const crypto=webcrypto as unknown as Crypto;
 const vault=createTokenVault({crypto,local:{get:async k=>({[k]:data[k]}),set:async v=>{Object.assign(data,v)},setAccessLevel:async()=>{}},keys:{load:async()=>key,create:async()=>key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])},lock:async fn=>fn()});
 return {data,vault,key:()=>key};
}
test('PAT vault uses non-extractable AES-GCM, isolated storage, per-slot authenticated encryption and deletion',async()=>{
 const f=await tokenFixture();await f.vault.put(slot,secret);assert.equal(await f.vault.get(slot),secret);assert.equal(f.key()!.extractable,false);
 assert.ok(!JSON.stringify(f.data).includes(secret));assert.deepEqual(Object.keys(f.data),[TOKEN_KEY]);
 const slots=f.data[TOKEN_KEY] as Record<string,unknown>;slots['20000000-0000-4000-8000-000000000002']=slots[slot];await assert.rejects(f.vault.get('20000000-0000-4000-8000-000000000002'),/Encrypted token storage unavailable/);
 await f.vault.delete(slot);await assert.rejects(f.vault.get(slot));assert.ok(!Object.hasOwn(slots,slot)||!Object.hasOwn(f.data[TOKEN_KEY] as object,slot));
});
test('pre-Copilot v2 state migrates additively and credentials remain outside state/public/diagnostics',async()=>{
 const old=emptyStore('old');delete (old.providers as Partial<Store['providers']>).copilot;
 const migrated=StoreSchema.parse(old);assert.equal(migrated.version,2);assert.equal(migrated.providers.copilot.enabled,false);
 assert.deepEqual(migrated.accounts,old.accounts);assert.ok(!migrated.connections.some(c=>c.id==='website:copilot'));
 const f=await tokenFixture();let store=migrated;let index=0;let remote=1;
 const service=createCopilotAccounts({readStore:async()=>store,updateStore:async fn=>{const result=fn(store);store=StoreSchema.parse(result.store);return result.value},tokens:f.vault,uuid:()=>`10000000-0000-4000-8000-${String(++index).padStart(12,'0')}`,now:()=>now,cancel:()=>{},accepted:async()=>{},permitted:async()=>true,lock:async(_,fn)=>fn(),request:async url=>response(url.includes('/usage?')?usage([row(1)]):{id:remote,login:'alice'})});
 await service.connect(secret);remote=2;await service.connect(secret+'SECOND');assert.equal(store.accounts.length,2);assert.equal(store.connections.filter(c=>c.kind==='copilot').length,2);
 for(const state of [exportReadings(store.accounts,store.snapshots.map(historyPoint),'json',now),exportReadings(store.accounts,store.snapshots.map(historyPoint),'csv',now),store,toPublicState(store),diagnostics(toPublicState(store),'test',now)])assert.ok(!JSON.stringify(state).includes(secret));
 const [a,b]=store.connections.filter(c=>c.kind==='copilot');assert.equal(shouldRefresh(a!,'manual',now+899999,5),false);assert.equal(shouldRefresh(a!,'scheduled',now+900000,5),true);assert.equal(shouldRefresh({...a!,status:'needs-auth'},'manual',now+9999999,5),false);
 await assert.rejects(service.connect(secret,a!.id),/another GitHub account/);
 await service.disconnect(a!.id);assert.ok(!store.connections.some(c=>c.id===a!.id));await assert.rejects(f.vault.get(a!.profileId!));assert.equal(await f.vault.get(b!.profileId!),secret+'SECOND');
});
test('token vault fails closed on corrupt storage and sanitizes browser/key-store errors',async()=>{
 const f=await tokenFixture();f.data[TOKEN_KEY]={[slot]:{iv:'bad',data:secret}};
 await assert.rejects(f.vault.get(slot),e=>e instanceof Error&&e.message==='Encrypted token storage unavailable.');
 const v=createTokenVault({crypto:webcrypto as unknown as Crypto,local:{get:async()=>{throw Error(secret)},set:async()=>{throw Error(secret)},setAccessLevel:async()=>{}},keys:{load:async()=>{throw Error(secret)},create:async()=>{throw Error(secret)}},lock:async fn=>fn()});
 for(const action of [()=>v.get(slot),()=>v.put(slot,secret),()=>v.delete(slot)])await assert.rejects(action(),e=>e instanceof Error&&!e.message.includes(secret));
});
