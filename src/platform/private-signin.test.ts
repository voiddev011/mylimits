import test from 'node:test';import assert from 'node:assert/strict';
import { createPrivateSignIn,type PrivateSignInPort } from './private-signin';
import { emptyStore,type Store } from '../core/model';
import { accountId,applySnapshot,type Snapshot } from '../core/engine';
import { setupCandidate,saveAccountSetup,startAccountSetup } from '../core/account-setup';
import { StoreSchema } from '../core/schema';
import { toPublicState } from '../core/public';
import { PRIVATE_JOURNAL } from '../core/private-signin';
import { vaultId } from '../core/connection-id';
import { websiteConnection } from '../core/model';
import type { VaultPayload } from '../core/vault-contracts';
const tick=()=>new Promise<void>(r=>setImmediate(r));
function gate(){let release!:()=>void;return {promise:new Promise<void>(r=>{release=r}),release:()=>release()};}
const snapshot=(identity:string):Snapshot=>({identity,kind:'account',displayName:'Fictional personal',plan:'plus',meters:[{id:'session',label:'Codex fixture',scope:'work-codex',evidence:'reported',unit:'percent',used:null,total:null,usedPercent:25,resetsAt:null,source:'Fixture'}]});
async function fixture(){
 let state=emptyStore('private-fixture'),now=1800000000000,n=1,queue:Promise<unknown>=Promise.resolve(),reads=0;
 const aid=await accountId('chatgpt','A',state.installSalt);state=applySnapshot(state,'chatgpt',aid,snapshot('A'),now-60000);state.accounts[0]!.alias='Keep work';
 const session:Record<string,unknown>={},entries=new Map<string,VaultPayload>(),closed:number[]=[],history:string[]=[],cookieReads:string[]=[];
 let tabs=[{id:1,windowId:10,incognito:false}],identity='B',cookieValue='SECRET_B',privateCookies=true,enabled=true,alarm=0;
 const port:PrivateSignInPort={readStore:async()=>structuredClone(state),updateStore:<T>(fn:(s:Store)=>{store:Store;value:T})=>{const task=queue.then(()=>{const r=fn(structuredClone(state));state=StoreSchema.parse(r.store);return r.value;});queue=task.catch(()=>{});return task;},
  enabled:()=>enabled,allowlist:()=>['fixture'],permitted:async()=>true,allowedPrivate:async()=>true,
  tabs:{async query(){return structuredClone(tabs)}},windows:{async create(){tabs.push({id:2,windowId:20,incognito:true});return {id:20,incognito:true,tabs:[tabs[1]!]};},async get(id){return {id,incognito:id===20,tabs:tabs.filter(t=>t.windowId===id)};},async remove(id){closed.push(id);tabs=tabs.filter(t=>t.windowId!==id);}},
  cookies:{async getAllCookieStores(){return [{id:'private',tabIds:tabs.filter(t=>t.incognito).map(t=>t.id)},{id:'normal',tabIds:[1]}]},async getAll(q){cookieReads.push(q.storeId);return q.storeId==='private'&&!privateCookies?[]:[{name:'fixture',value:q.storeId==='normal'?'SECRET_A':cookieValue,domain:'chatgpt.com',path:'/',storeId:q.storeId}];}},
  session:{async get(k){return {[k]:structuredClone(session[k])}},async set(v){Object.assign(session,structuredClone(v));},async remove(k){delete session[k];}},
  async arm(t){alarm=t},async disarm(){alarm=0},now:()=>now,uuid:()=>`10000000-0000-4000-8000-${String(n++).padStart(12,'0')}`,
  async verify(_p,slot){reads++;assert.ok(service.pendingPayload(slot));return snapshot(identity);},async put(slot,_p,payload){entries.set(slot,structuredClone(payload));},async delete(slot){entries.delete(slot);},async accepted(_a,c){history.push(c)},
 };
 let service=createPrivateSignIn(port);
 return {port,session,entries,closed,history,cookieReads,aid,state:()=>state,service:()=>service,restart:()=>service=createPrivateSignIn(port),reads:()=>reads,alarm:()=>alarm,
  setIdentity:(v:string)=>{identity=v},setCookie:(v:string)=>{cookieValue=v},noCookies:()=>{privateCookies=false},withCookies:()=>{privateCookies=true},setNow:(v:number)=>{now=v},disable:()=>{enabled=false},addPrivate:()=>{tabs.push({id:3,windowId:30,incognito:true})},setState:(s:Store)=>{state=s}};
}
test('private B verifies without touching normal A; Save alone encrypts and accepts a dated source-bound quota',async()=>{
 const f=await fixture(),before=structuredClone(f.state().providers.chatgpt),id=await f.service().start('chatgpt','private','Personal');await f.service().check(id);
 assert.ok(f.cookieReads.every(id=>id==='private'));assert.equal(f.entries.size,0);assert.equal(f.state().accounts.length,1);
 const candidate=setupCandidate(toPublicState(f.state()))!;assert.equal(candidate.connection,'inactive');assert.deepEqual(candidate.meters,[]);
 const observed=candidate.updatedAt;f.setNow(observed+5000);
 await assert.rejects(f.service().save(id,candidate.id,false),{code:'confirmation-required'});assert.equal(f.entries.size,0);
 assert.throws(()=>saveAccountSetup(f.state(),id,candidate.id));
 assert.throws(()=>startAccountSetup(f.state(),'chatgpt','detect','Replacement','10000000-0000-4000-8000-000000000099',observed),/Finish or cancel/);
 await f.service().save(id,candidate.id,true);
 assert.equal(f.entries.size,1);assert.equal(f.state().accounts.length,2);assert.equal(f.state().accounts.find(a=>a.id===f.aid)!.alias,'Keep work');
 assert.equal(f.state().accounts.find(a=>a.id===candidate.id)!.alias,'Personal');assert.equal(f.state().accounts.find(a=>a.id===candidate.id)!.updatedAt,observed);
 assert.deepEqual(f.state().providers.chatgpt,before);assert.deepEqual(f.closed,[20]);assert.equal(f.history.length,1);assert.equal(f.session[PRIVATE_JOURNAL],undefined);assert.equal(f.alarm(),0);
 const output=JSON.stringify(toPublicState(f.state()));assert.ok(!output.includes('SECRET_B'));assert.ok(!output.includes('SECRET_A'));
});
test('first private account is allowed without detecting a browser account',async()=>{
 const f=await fixture();f.setState(emptyStore('private-fixture'));const id=await f.service().start('chatgpt','private','First');await f.service().check(id);assert.ok(setupCandidate(f.state()));await f.service().cancel(id);assert.equal(f.state().connections.filter(c=>c.kind==='vault').length,0);
});
test('incognito refusal never falls back; explicit current-login mode carries a weaker guarantee',async()=>{
 const f=await fixture();f.port.allowedPrivate=async()=>false;await assert.rejects(f.service().start('chatgpt','private',''),{code:'incognito-access-required'});assert.equal(f.reads(),0);assert.equal(f.entries.size,0);
 const g=await fixture();g.port.allowedPrivate=async()=>false;const id=await g.service().start('chatgpt','current','');await g.service().check(id);
 assert.ok(g.cookieReads.every(id=>id==='normal'));assert.match(g.state().accountSetup!.message!,/probably end/);assert.deepEqual(g.closed,[]);await g.service().cancel(id);
});
test('existing private windows and mixed normal/private stores are rejected without reading values',async()=>{
 const f=await fixture();f.addPrivate();await assert.rejects(f.service().start('chatgpt','private',''),{code:'private-window-in-use'});assert.deepEqual(f.closed,[]);assert.deepEqual(f.cookieReads,[]);
 const g=await fixture();g.port.cookies.getAllCookieStores=async()=>[{id:'mixed',tabIds:[1,2]}];await assert.rejects(g.service().start('chatgpt','private',''),{code:'private-window-in-use'});assert.deepEqual(g.cookieReads,[]);assert.deepEqual(g.closed,[20]);
});
test('normal-store cookie changes are ignored; the owned private store can trigger verification',async()=>{
 const f=await fixture();f.noCookies();const id=await f.service().start('chatgpt','private','');await f.service().check(id);assert.equal(f.reads(),0);
 await f.service().cookieChanged({removed:false,cookie:{name:'fixture',value:'SECRET_A',domain:'chatgpt.com',path:'/',storeId:'normal'}});assert.equal(f.reads(),0);
 f.withCookies();await f.service().cookieChanged({removed:false,cookie:{name:'fixture',value:'SECRET_B',domain:'chatgpt.com',path:'/',storeId:'private'}});assert.equal(f.reads(),1);assert.ok(setupCandidate(f.state()));
 await f.service().cancel(id);assert.equal(f.entries.size,0);
});
test('cancel and timeout discard candidates and their pending slots without changing A',async()=>{
 for(const expire of [false,true]){const f=await fixture(),before=structuredClone(f.state().accounts),id=await f.service().start('chatgpt','private','');await f.service().check(id);
  if(expire){f.setNow(f.alarm());await f.service().expire();}else await f.service().cancel(id);
  assert.deepEqual(f.state().accounts,before);assert.equal(f.state().accountSetup,null);assert.equal(f.entries.size,0);assert.deepEqual(f.closed,[20]);
 }
});
test('late verification and late-created windows cannot survive cancellation',async()=>{
 const f=await fixture(),waiting=gate();f.port.verify=async()=>{await waiting.promise;return snapshot('B')};const id=await f.service().start('chatgpt','private','');await tick();const cancel=f.service().cancel(id);waiting.release();await cancel;
 assert.equal(f.state().accountSetup,null);assert.equal(f.state().accounts.length,1);assert.equal(f.entries.size,0);
 const g=await fixture(),opened=gate(),create=g.port.windows.create;g.port.windows.create=async p=>{await opened.promise;return create(p);};
 const start=g.service().start('chatgpt','private',''),rejected=assert.rejects(start,{code:'cancelled'});await tick();const stop=g.service().cancel('10000000-0000-4000-8000-000000000001');opened.release();await stop;await rejected;assert.deepEqual(g.closed,[20]);
});
test('a changed login cannot be saved under the previously verified identity',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const candidate=setupCandidate(f.state())!;f.setCookie('SECRET_C');await assert.rejects(f.service().save(id,candidate.id,true),{code:'wrong-account'});assert.equal(f.entries.size,0);assert.equal(f.state().accounts.length,1);
});
test('duplicate verified accounts are reported and never overwrite the existing source or alias',async()=>{
 const f=await fixture(),slot='20000000-0000-4000-8000-000000000001',s=f.state();s.connections.push({...websiteConnection('chatgpt'),id:vaultId('chatgpt',slot),kind:'vault',profileId:slot,accountId:f.aid});f.setState(s);f.setIdentity('A');
 const id=await f.service().start('chatgpt','private','Replace');await f.service().check(id);assert.equal(setupCandidate(f.state()),null);assert.match(f.state().accountSetup!.message!,/already has/);await f.service().cancel(id);assert.ok(f.state().connections.some(c=>c.profileId===slot));assert.equal(f.state().accounts[0]!.alias,'Keep work');
});
test('worker restoration re-verifies the owned window without resetting its deadline',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const deadline=f.alarm(),previous=f.reads();
 const restored=f.restart();await restored.initialize();await restored.check(id);assert.equal(f.alarm(),deadline);assert.ok(f.reads()>previous);assert.equal(f.entries.size,0);assert.ok(setupCandidate(f.state()));await restored.cancel(id);
});
test('partitioned and wrong-store cookies are rejected without verification or token leakage',async()=>{
 for(const bad of ['partition','store']){const f=await fixture();f.port.cookies.getAll=async()=>[{name:'fixture',value:'SECRET_B',domain:'chatgpt.com',path:'/',storeId:bad==='store'?'normal':'private',...(bad==='partition'?{partitionKey:{}}:{})}];
  const id=await f.service().start('chatgpt','private','');await f.service().check(id);assert.equal(f.reads(),0);assert.ok(!JSON.stringify(f.state()).includes('SECRET_B'));await f.service().cancel(id);
 }
});
test('a disabled policy cannot open a window, read cookies or create a pending source',async()=>{
 const f=await fixture();f.disable();await assert.rejects(f.service().start('chatgpt','private',''),{code:'disabled'});assert.equal(f.state().accountSetup??null,null);assert.deepEqual(f.cookieReads,[]);assert.deepEqual(f.closed,[]);assert.equal(f.entries.size,0);
});
test('cancellation during encrypted persistence removes the late slot and cannot accept a reading',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const candidate=setupCandidate(f.state())!,wait=gate(),put=f.port.put;
 f.port.put=async(...args)=>{await wait.promise;return put(...args)};
 const save=f.service().save(id,candidate.id,true),rejected=assert.rejects(save,{code:'cancelled'});await tick();const cancel=f.service().cancel(id);wait.release();await Promise.all([cancel,rejected]);
 assert.equal(f.entries.size,0);assert.equal(f.state().accounts.length,1);assert.equal(f.state().accountSetup,null);assert.equal(f.history.length,0);
});
test('failed cleanup retains recovery metadata and blocks starting a new attempt until retried',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const remove=f.port.delete;f.port.delete=async()=>{throw Error('SECRET_B')};
 await assert.rejects(f.service().cancel(id),{code:'setup-recovery-required'});assert.ok(f.session[PRIVATE_JOURNAL]);assert.deepEqual(f.closed,[20]);
 await assert.rejects(f.service().start('chatgpt','private',''),{code:'setup-recovery-required'});f.port.delete=remove;await f.service().cancel(id);assert.equal(f.session[PRIVATE_JOURNAL],undefined);assert.equal(f.state().accountSetup,null);
});
test('cancellation after the accepted Store write retains the confirmed source rather than deleting its slot',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','Personal');await f.service().check(id);const candidate=setupCandidate(f.state())!,wait=gate(),update=f.port.updateStore;
 f.port.updateStore=async(fn)=>{const value=await update(fn);if(value===true)await wait.promise;return value};
 const save=f.service().save(id,candidate.id,true);await tick();assert.equal(f.state().accounts.length,2);
 const cancel=f.service().cancel(id);wait.release();await Promise.all([save,cancel]);assert.equal(f.entries.size,1);assert.equal(f.state().accounts.length,2);assert.equal(f.state().accountSetup,null);assert.equal(f.history.length,1);
});
test('expired worker restoration cleans up without fetching provider data or resetting the timeout',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const reads=f.reads();f.setNow(f.alarm());
 await f.restart().initialize();assert.equal(f.reads(),reads);assert.equal(f.entries.size,0);assert.equal(f.state().accountSetup,null);assert.deepEqual(f.closed,[20]);assert.equal(f.session[PRIVATE_JOURNAL],undefined);
});
test('browser restart with lost session journal removes only unconfirmed setup and leaves accepted sources intact',async()=>{
 const f=await fixture(),id=await f.service().start('chatgpt','private','');await f.service().check(id);const old=structuredClone(f.state().accounts);
 delete f.session[PRIVATE_JOURNAL];await f.restart().initialize();assert.equal(f.state().accountSetup,null);assert.equal(f.state().connections.filter(c=>c.kind==='vault').length,0);assert.deepEqual(f.state().accounts,old);assert.equal(f.entries.size,0);assert.deepEqual(f.closed,[]);
 const g=await fixture(),setup=await g.service().start('chatgpt','private','');await g.service().check(setup);const metadata=structuredClone(g.state().accountSetup),candidate=setupCandidate(g.state())!;await g.service().save(setup,candidate.id,true);
 g.setState({...g.state(),accountSetup:metadata,connections:g.state().connections.map(c=>c.kind==='vault'?{...c,enabled:false}:c)});await g.restart().initialize();assert.equal(g.entries.size,1);assert.equal(g.state().connections.filter(c=>c.kind==='vault').length,1);assert.equal(g.state().accountSetup,null);
});
