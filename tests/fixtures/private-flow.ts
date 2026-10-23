// In-memory browser fixture only: actual runtime/readers/encryption, fictional provider and private-window APIs.
import { createSavedSessions } from '../../src/platform/saved-sessions';
import { emptyStore, type Store } from '../../src/core/model';
import { StoreSchema } from '../../src/core/schema';
import { setupCandidate } from '../../src/core/account-setup';
import { applySnapshot,accountId } from '../../src/core/engine';
import { createIndexedDBVaultKeys } from '../../src/platform/vault-key-store';
import { createVault } from '../../src/platform/vault';
import type { browser as BrowserAPI } from 'wxt/browser';
type Browser=typeof BrowserAPI;
export async function privateFlow(browser:Browser){
 let state=emptyStore('browser-private-fixture'),time=1800000000000,identity='B',used=25,sequence=20,removed=0,requests=0,ambientReads=0,status=200;
 let tabs=[{id:1,windowId:10,incognito:false}];
 // Use the actual rule type without permitting arbitrary fixture rules.
 type Rule=ReturnType<typeof import('../../src/platform/vault-transport').vaultRule>;
 let installed:Rule|undefined;
 const aId=await accountId('chatgpt','A:acc-A',state.installSalt);
 state=applySnapshot(state,'chatgpt',aId,{kind:'account',displayName:'Work',plan:null,meters:[]},time-60000);state.accounts[0]!.alias='Keep work';
 let queue:Promise<unknown>=Promise.resolve();
 const readStore=async()=>StoreSchema.parse(structuredClone(state),{jitless:true});
 function updateStore<T>(fn:(s:Store)=>{store:Store;value:T}){const task=queue.then(async()=>{const result=fn(await readStore());state=StoreSchema.parse(result.store,{jitless:true});return result.value});queue=task.catch(()=>{});return task;}
 const bindings={runtime:{id:browser.runtime.id},storage:browser.storage,permissions:{contains:async()=>true},
  tabs:{query:async()=>structuredClone(tabs)},extension:{isAllowedIncognitoAccess:async()=>true},
  windows:{async create(){const id=++sequence;tabs.push({id,windowId:id,incognito:true});return {id,incognito:true,tabs:[tabs.at(-1)!]}},async get(id:number){return {id,incognito:true,tabs:tabs.filter(t=>t.windowId===id)}},async remove(id:number){removed++;tabs=tabs.filter(t=>t.windowId!==id)},onRemoved:{addListener(){}}},
  cookies:{async getAllCookieStores(){return [{id:'private-fixture',tabIds:tabs.filter(t=>t.incognito).map(t=>t.id)},{id:'normal-fixture',tabIds:[1]}]},async getAll(q:{storeId:string}){if(q.storeId!=='private-fixture'){ambientReads++;throw Error('Wrong jar')};return [{name:'fictional',value:`FICTIONAL_PRIVATE_${identity}`,domain:'chatgpt.com',path:'/',storeId:q.storeId}]},onChanged:{addListener(){}}},
  alarms:{create:async()=>{},clear:async()=>true},
 } as unknown as Parameters<typeof createSavedSessions>[0]['browser'];
 const port:Parameters<typeof createSavedSessions>[0]={browser:bindings,crypto,indexedDB,locks:navigator.locks,supported:true,
  readStore,updateStore,accepted:async()=>{},now:()=>time,uuid:()=>crypto.randomUUID(),trace:{lastSuccessAt:null,record:async()=>{}},
  lock:async(_host,run)=>await navigator.locks.request('private-http-fixture',run),ready:async()=>{},blockHost:()=>{throw Error('Fixture cleanup failed')},
  dnr:{getSessionRules:async()=>[],async updateSessionRules(options){if(options.removeRuleIds.includes(installed?.id??-1))installed=undefined;if(options.addRules?.length)installed=options.addRules[0]}},
  policy:{enabled:p=>p==='chatgpt',allowlist:()=>['fictional']},
  async request(url,init){
   requests++;if(init.credentials!=='omit'||init.redirect!=='error')throw Error('Unsafe request');
   const header=installed?.action.requestHeaders.find(h=>h.header==='cookie')?.value;
   const id=header?.match(/^fictional=FICTIONAL_PRIVATE_([BC])$/)?.[1];if(!id)throw Error('Missing fictional rule');
   if(status!==200)return new Response('{}',{status,headers:{'content-type':'application/json',...(status===403?{'cf-mitigated':'challenge'}:{})}});
   const body=new URL(url).pathname==='/api/auth/session'?{user:{id},accessToken:`FICTIONAL_ACCESS_${id}`}:{account_id:`acc-${id}`,plan_type:'plus',rate_limit:{primary_window:{used_percent:used,limit_window_seconds:18000}}};
   return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  },
 };
 let runtime=createSavedSessions(port);
 for(const id of ['B','C']){
  identity=id;time+=20000;const setup=await runtime.start('chatgpt','private',`Personal ${id}`);await runtime.check(setup);
  const candidate=setupCandidate(await readStore());if(!candidate)throw Error('Candidate missing');
  if(state.accounts.length!==(id==='B'?1:2)||candidate.meters.length||candidate.connection!=='inactive')throw Error('Premature account acceptance');
  await runtime.save(setup,candidate.id,true);
 }
 const connections=state.connections.filter(c=>c.kind==='vault');
 const vault=createVault({local:browser.storage.local,crypto,keys:createIndexedDBVaultKeys({indexedDB,crypto}),now:()=>time,enabled:()=>true,allowlist:()=>['fictional'],lock:async run=>await navigator.locks.request('mylimits:vault:v1',run)});
 const saved=await vault.listVault(),encrypted=JSON.stringify(await browser.storage.local.get('mylimits:vault:v1'));
 runtime=createSavedSessions(port);await runtime.initialize();used=65;time+=20000;
 const readings=await Promise.all(connections.map(c=>runtime.readConnection(c,{},new AbortController().signal,{lastSuccessAt:c.lastSuccessAt,record:async()=>{}})));
 const cleanRules=installed===undefined,keptAlias=state.accounts.find(a=>a.id===aId)?.alias;
 // A cancelled third attempt may not erase either accepted slot.
 identity='B';time+=20000;const pending=await runtime.start('chatgpt','private','Duplicate');await runtime.check(pending);
 const duplicate=state.accountSetup?.message?.includes('already has');await runtime.cancel(pending);
 let rejection='',challenge=false;time+=20000;status=401;
 try{await runtime.readConnection(connections[0]!,{},new AbortController().signal,port.trace)}catch(e){rejection=(e as {code:string}).code}
 status=403;try{await runtime.readConnection(connections[0]!,{},new AbortController().signal,port.trace)}catch(e){const error=e as {code:string;canRecoverWithTab:boolean};challenge=error.code==='challenge'&&!error.canRecoverWithTab}
 return {accountCount:state.accounts.length,aliases:state.accounts.map(a=>a.alias),keptAlias,slots:saved.length,
  encrypted:!encrypted.includes('FICTIONAL_PRIVATE_'),identities:readings.map(r=>r.identity).sort(),quotas:readings.map(r=>r.meters[0]?.usedPercent),scopes:readings.map(r=>r.meters[0]?.scope),
  secretFree:!JSON.stringify(state).includes('FICTIONAL_'),ambientReads,normalUnchanged:tabs.length===1&&tabs[0]!.id===1,removed,requests,cleanRules,duplicate,
  rejection,challenge,retainedSlots:(await vault.listVault()).length,journalGone:!(await browser.storage.session.get('mylimits:vault-signin:v1'))['mylimits:vault-signin:v1']};
}
