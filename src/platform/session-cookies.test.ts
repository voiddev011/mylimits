import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConnectionStatus } from '../core/model';
import { authRetryDeadline, createSessionCookies, needsSessionSignal } from './session-cookies';

const NOW=1792700000000;
const cookie={name:'sessionKey',domain:'.claude.ai',storeId:'normal-jar',value:'NEVER_EXPORT_THIS'};
type Change={removed:boolean;cause:string;cookie:typeof cookie&{partitionKey?:unknown}};
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
function fixture(verifiedProviders:('claude'|'chatgpt')[]=[]){
 const listeners=new Set<(event:Change)=>void>();
 const timers=new Map<number,()=>void>();let nextTimer=0;
 const f={allowed:true,status:'needs-auth' as ConnectionStatus|null,reads:[] as {url:string;storeId:string}[],calls:[] as string[],
  cookies:[{...cookie}],
  tabs:[{id:1,incognito:false,cookieStoreId:undefined as string|undefined},{id:2,incognito:true,cookieStoreId:undefined as string|undefined}],
  stores:[{id:'private-jar',tabIds:[2]},{id:'normal-jar',tabIds:[1]}],fail:false};
 const manager=createSessionCookies({
  cookies:{getAllCookieStores:async()=>{if(f.fail)throw new Error('Unavailable');return f.stores;},
   getAll:async details=>{f.reads.push(details);return f.cookies;},
   onChanged:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener)}},
  tabs:{query:async()=>f.tabs},permissions:{contains:async()=>f.allowed},status:async()=>f.status,
  now:()=>NOW,verifiedProviders,
  schedule:(callback,ms)=>{assert.equal(ms,2000);timers.set(++nextTimer,callback);return nextTimer;},cancel:timer=>timers.delete(timer as number),
 });
 const stop=manager.listenSessionCookies(provider=>{f.calls.push(provider);});
 return {...f,state:f,manager,stop,timers,listeners,emit:async(event:Partial<Change>={})=>{
  for(const listener of listeners)listener({removed:false,cause:'explicit',cookie,...event});await settle();
 },fire:async()=>{const pending=[...timers.values()];timers.clear();pending.forEach(run=>run());await settle();}};
}

test('cookie presence reads the proven normal store, never list order, and returns metadata without values',async()=>{
 const f=fixture();const result=await f.manager.inspect('claude');
 assert.deepEqual(result,{state:'present',names:['sessionKey']});
 assert.deepEqual(f.state.reads,[{url:'https://claude.ai',storeId:'normal-jar'}]);
 assert.ok(!JSON.stringify(result).includes(cookie.value));f.stop();
});

test('missing candidate names stay unknown until provider evidence is explicitly verified',async()=>{
 const f=fixture();f.state.cookies=[];
 assert.equal(await f.manager.sessionCookieState('claude'),'unknown');f.stop();
 const verified=fixture(['claude']);verified.state.cookies=[];
 assert.equal(await verified.manager.sessionCookieState('claude'),'absent');verified.stop();
});

test('chunked ChatGPT session names produce only metadata and can signal the OpenAI website source',async()=>{
 const f=fixture();f.state.cookies=[0,1].map(i=>({...cookie,name:`__Secure-next-auth.session-token.${i}`,domain:'.chatgpt.com'}));
 const info=await f.manager.inspect('chatgpt');assert.deepEqual(info,{state:'present',names:['__Secure-next-auth.session-token.0','__Secure-next-auth.session-token.1']});
 await f.emit({cookie:f.state.cookies[0]!});await f.fire();assert.deepEqual(f.state.calls,['chatgpt']);assert.ok(!JSON.stringify(info).includes(cookie.value));f.stop();
});

test('partitioned or wrong-store results stay unknown even when ordinary cookie names were verified',async()=>{
 const f=fixture(['claude']);Object.assign(f.state.cookies[0]!,{partitionKey:{topLevelSite:'https://example.test'}});
 assert.equal(await f.manager.sessionCookieState('claude'),'unknown');
 f.state.cookies=[{...cookie,storeId:'private-jar'}];assert.equal(await f.manager.sessionCookieState('claude'),'unknown');f.stop();
});

test('Firefox container and incognito tabs cannot establish the ordinary default cookie store',async()=>{
 const f=fixture();f.state.tabs[0]!.cookieStoreId='firefox-container-1';
 assert.equal(await f.manager.sessionCookieState('claude'),'unknown');
 f.state.tabs[0]!.cookieStoreId='firefox-default';assert.equal(await f.manager.sessionCookieState('claude'),'present');f.stop();
});

test('normal sign-in events debounce and can recover needs-auth or needs-tab and check active accounts for identity switches',async()=>{
 const f=fixture();await f.emit();await f.emit({cause:'overwrite'});assert.equal(f.timers.size,1);
 await f.fire();assert.deepEqual(f.state.calls,['claude']);
 f.state.status='active';await f.emit();assert.equal(f.timers.size,1);await f.fire();
 f.state.status='needs-tab';await f.emit();await f.fire();assert.deepEqual(f.state.calls,['claude','claude','claude']);
 for(const status of [null,'offline','error','disabled','checking'] as const)assert.equal(needsSessionSignal(status),false);
 f.stop();
});

test('private-store events, removals, wrong domains and partitioned cookies neither trigger nor cancel a normal sign-in',async()=>{
 const f=fixture();await f.emit();
 await f.emit({cookie:{...cookie,storeId:'private-jar'}});
 await f.emit({removed:true});await f.emit({cause:'expired'});
 await f.emit({cookie:{...cookie,domain:'.claude.ai.evil.test'}});
 await f.emit({cookie:{...cookie,partitionKey:{topLevelSite:'https://example.test'}}});
 await f.fire();assert.deepEqual(f.state.calls,['claude']);f.stop();
});

test('debounced signals recheck permission, current source status and cookie presence before refreshing',async()=>{
 for(const change of ['permission','status','cookie'] as const){
  const f=fixture();await f.emit();
  if(change==='permission')f.state.allowed=false;
  if(change==='status')f.state.status='disabled';
  if(change==='cookie')f.state.cookies=[];
  await f.fire();assert.deepEqual(f.state.calls,[],change);f.stop();
 }
 const stopped=fixture();await stopped.emit();stopped.stop();assert.equal(stopped.listeners.size,0);await stopped.fire();assert.deepEqual(stopped.state.calls,[]);
});

test('missing cookies API is optional and a stopped listener cannot schedule an in-flight callback',async()=>{
 const manager=createSessionCookies({tabs:{query:async()=>[]},permissions:{contains:async()=>true},status:async()=>null});
 assert.equal(await manager.sessionCookieState('claude'),'unknown');manager.listenSessionCookies(()=>{})();
 const f=fixture();const work=f.emit();f.stop();await work;assert.equal(f.timers.size,0);assert.equal(f.state.calls.length,0);
});

test('only verified absent cookies on authentication failure suspend retries; all other waits are retained',()=>{
 assert.equal(authRetryDeadline('signed-out','absent',NOW,1,5,null),null);
 for(const state of ['present','unknown'] as const)assert.equal(authRetryDeadline('signed-out',state,NOW,1,5,null),NOW+600000);
 assert.equal(authRetryDeadline('error','absent',NOW,1,5,NOW+3600000),NOW+3600000);
 assert.equal(authRetryDeadline('waiting-for-tab','absent',NOW,1,5,null),NOW+600000);
});
