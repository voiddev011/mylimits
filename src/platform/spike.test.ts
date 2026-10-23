import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpikeSession,type SpikePort } from './spike';
import { SPIKE_RULE_ID,SPIKE_WAITS_KEY,type ProbeCookie } from '../core/spike';
import { createHostLock } from './host-lock';
import { readJsonResponse } from '../providers/response';
import { responseError } from '../providers/errors';
const NOW=1800000000000;
const cookie=(storeId='normal'):ProbeCookie=>({name:'sessionKey',value:'COOKIE_SECRET',domain:'.claude.ai',path:'/',storeId,httpOnly:true,secure:true,session:false,expirationDate:1800003600});
function fixture(){
 let clock=NOW,observer:Parameters<SpikePort['headers']['addListener']>[0]|undefined;
 const state={normalCookies:[cookie()],privateCookies:[cookie('private')],tabs:[{id:1,incognito:false}] as {id:number;incognito:boolean}[],allowed:true,failCleanup:false,
  requests:[] as {url:string;options:RequestInit}[],rules:new Map<number,unknown>(),closed:[] as number[],cookiesRead:[] as string[],writes:{} as Record<string,unknown>,removedListeners:0,fetchStatus:200,matched:true};
 const token=`e30.${Buffer.from(JSON.stringify({exp:1800003600,secret:'TOKEN_BODY_SECRET'})).toString('base64url')}.TOKEN_SECRET`;
 const port:SpikePort={extensionId:'a'.repeat(32),now:()=>clock,
  cookies:{getAllCookieStores:async()=>[{id:'private',tabIds:state.tabs.filter(t=>t.incognito).map(t=>t.id)},{id:'normal',tabIds:[1]}],getAll:async d=>{state.cookiesRead.push(d.storeId);return d.storeId==='normal'?state.normalCookies:state.privateCookies;}},
  tabs:{query:async()=>state.tabs},windows:{create:async()=>{state.tabs.push({id:20,incognito:true});return {id:10,tabs:[{id:20,incognito:true}]};},remove:async id=>{state.closed.push(id);state.tabs=state.tabs.filter(t=>t.id!==20);}},
  allowedPrivate:async()=>state.allowed,permitted:async()=>true,
  dnr:{getSessionRules:async()=>[...state.rules.keys()].map(id=>({id})),updateSessionRules:async o=>{if(state.failCleanup&&!o.addRules)throw Error('SECRET_CLEANUP_ERROR');for(const id of o.removeRuleIds)state.rules.delete(id);for(const r of o.addRules??[])state.rules.set(r.id,r);},getMatchedRules:async()=>({rulesMatchedInfo:state.matched?[{rule:{ruleId:SPIKE_RULE_ID}}]:[]})},
  headers:{addListener:fn=>{observer=fn;},removeListener:()=>{observer=undefined;state.removedListeners++;}},
  storage:{get:async key=>({[key]:state.writes[key]}),set:async v=>{Object.assign(state.writes,structuredClone(v));}},
  request:async(url,options)=>{
   state.requests.push({url,options});const path=new URL(url).pathname;
   const body=path==='/api/auth/session'?{accessToken:token,user:{id:'USER_SECRET'}}:path==='/api/account'?{uuid:'USER_SECRET'}:path==='/api/organizations'?[{uuid:'ORG_SECRET',name:'Personal',capabilities:['chat']}]:{five_hour:{utilization:30},account_id:'ACCOUNT_SECRET',rate_limit:{primary_window:{used_percent:20}}};
   return new Response(JSON.stringify(body),{status:state.fetchStatus,headers:{'content-type':'application/json',...(state.fetchStatus===429?{'retry-after':'120'}:{})}});
  },lock:createHostLock(),ambient:()=>{throw Error('Not initialized');},schedule:()=>1,cancel:()=>{},
 };
 port.ambient=(provider,signal,trace)=>async(path,headers={},request)=>{
  const response=await readJsonResponse(await port.request(`https://${provider==='chatgpt'?'chatgpt.com':'claude.ai'}${path}`,{credentials:'include',signal,headers,method:request?.method??'GET',body:request?JSON.stringify(request.body):undefined}));
  await trace.record({provider,path,transport:'background',...response});const error=responseError(response,'Fixture',clock);if(error)throw error;return response.body;
 };
 return {port,state,session:createSpikeSession(port),advance:(ms=15000)=>{clock+=ms;},emit:(details:Parameters<NonNullable<typeof observer>>[0])=>observer?.(details),token};
}
test('metadata lists all stores with confirmed normal context; consent capture returns no values',async()=>{
 const f=fixture();const result=await f.session.execute({type:'cookies',provider:'claude'}) as {defaultStore:string;rows:unknown[]};
 assert.equal(result.defaultStore,'normal');assert.equal(result.rows.length,2);assert.ok(!JSON.stringify(result).includes('COOKIE_SECRET'));
 const captured=await f.session.execute({type:'capture',provider:'claude',storeId:'normal',names:['sessionKey'],consent:true});assert.ok(!JSON.stringify(captured).includes('COOKIE_SECRET'));
 assert.deepEqual(f.state.writes,{});await f.session.dispose();assert.deepEqual(f.state.closed,[]);
});
test('comparison exercises all reader endpoints, isolates replay credentials and cleans scoped rules',async()=>{
 const f=fixture();await f.session.execute({type:'capture',provider:'claude',storeId:'normal',names:['sessionKey'],consent:true});
 const output=await f.session.execute({type:'compare',provider:'claude'}) as {summaries:{result:string}[];rows:{ruleMatch?:string}[]};
 assert.ok(output.summaries.every(s=>s.result==='reader-validated'));assert.equal(f.state.requests.length,12);assert.equal(f.state.rules.size,0);
 assert.ok(f.state.requests.slice(8).every(r=>r.options.credentials==='omit'&&r.options.redirect==='error'));assert.ok(output.rows.some(r=>r.ruleMatch==='matched'));
 for(const secret of ['COOKIE_SECRET','USER_SECRET','ORG_SECRET','ACCOUNT_SECRET'])assert.ok(!JSON.stringify(output).includes(secret));
 assert.ok(!JSON.stringify(f.state.writes).includes('COOKIE_SECRET'));assert.ok(f.state.writes[SPIKE_WAITS_KEY]);
});
test('429 stops further comparison requests and cooldown survives a new diagnostic session',async()=>{
 const f=fixture();f.state.fetchStatus=429;
 const output=await f.session.execute({type:'compare',provider:'claude'});assert.equal(f.state.requests.length,1);assert.ok(JSON.stringify(output).includes('rate-limit'));
 await assert.rejects(createSpikeSession(f.port).execute({type:'compare',provider:'claude'}),(e:any)=>e.code==='cooldown');
 assert.equal(f.state.requests.length,1);
});
test('token inspection and F omit browser cookies, use no DNR rule and never return tokens',async()=>{
 const f=fixture();const output=await f.session.execute({type:'token',source:'ambient'}) as {exp:number};
 assert.equal(output.exp,1800003600000);assert.ok(!JSON.stringify(output).includes('SECRET'));
 f.advance();const result=await f.session.execute({type:'bearer'});assert.deepEqual(result,{status:200});
 const request=f.state.requests.at(-1)!;assert.equal(request.options.credentials,'omit');assert.equal(new Headers(request.options.headers).get('Authorization'),`Bearer ${f.token}`);assert.equal(f.state.rules.size,0);
 await f.session.execute({type:'clear'});f.advance();await assert.rejects(f.session.execute({type:'bearer'}),(e:any)=>e.code==='token-unavailable');
});
test('header observation records only names on exact extension-worker provider paths and removes listeners',async()=>{
 const f=fixture();await f.session.execute({type:'observe',provider:'claude',action:'start'});
 const event={url:'https://claude.ai/api/organizations/ORG_SECRET/usage?token=URL_SECRET',tabId:-1,initiator:`chrome-extension://${'a'.repeat(32)}`,statusCode:200,responseHeaders:[{name:'Set-Cookie',value:'sessionKey=HEADER_SECRET; HttpOnly'}]};
 f.emit({...event,initiator:'https://claude.ai'});f.emit({...event,tabId:1});f.emit(event);
 const result=await f.session.execute({type:'observe',provider:'claude',action:'stop'}) as {rows:unknown[]};assert.equal(result.rows.length,1);
 for(const secret of ['ORG_SECRET','URL_SECRET','HEADER_SECRET'])assert.ok(!JSON.stringify(result).includes(secret));assert.ok(f.state.removedListeners>0);
});
test('private dry run respects access, never replaces other private windows and closes only its own window',async()=>{
 const f=fixture();f.state.allowed=false;await assert.rejects(f.session.execute({type:'private',provider:'claude',action:'open'}),(e:any)=>e.code==='incognito-access-required');
 f.state.allowed=true;const opened=await f.session.execute({type:'private',provider:'claude',action:'open'}) as {ownedStore:string};assert.equal(opened.ownedStore,'private');
 await assert.rejects(f.session.execute({type:'private',provider:'claude',action:'open'}),(e:any)=>e.code==='private-window-exists');
 await f.session.dispose();assert.deepEqual(f.state.closed,[10]);assert.deepEqual(f.state.tabs,[{id:1,incognito:false}]);
});
test('startup removes only spike rules; cleanup failure blocks further requests',async()=>{
 const f=fixture();f.state.rules.set(42,{});f.state.rules.set(SPIKE_RULE_ID,{});await f.session.initialize();assert.deepEqual([...f.state.rules.keys()],[42]);
 const original=f.port.request;f.port.request=async(...args)=>{f.state.failCleanup=true;return original(...args);};
 const output=await f.session.execute({type:'compare',provider:'claude'});assert.ok(JSON.stringify(output).includes('rule-cleanup-failed'));
 const count=f.state.requests.length;await assert.rejects(f.session.execute({type:'compare',provider:'claude'}),(e:any)=>e.code==='rule-cleanup-failed');assert.equal(f.state.requests.length,count);
 await assert.rejects(f.session.execute({type:'clear'}),(e:any)=>e.code==='rule-cleanup-failed');
 f.state.failCleanup=false;assert.deepEqual(await f.session.execute({type:'clear'}),{cleared:true});assert.equal(f.state.rules.has(SPIKE_RULE_ID),false);
});
test('cancellation and disposal settle an active request before releasing and removing its rule',async()=>{
 const f=fixture(),original=f.port.request;let started!:()=>void;const active=new Promise<void>(r=>{started=r;});
 f.port.request=async(...args)=>{
  if(f.state.rules.has(SPIKE_RULE_ID)){started();return new Promise<Response>((_resolve,reject)=>{args[1].signal!.addEventListener('abort',()=>reject(new DOMException('FIXTURE_SECRET_ABORT','AbortError')),{once:true});});}
  return original(...args);
 };
 const request=f.session.execute({type:'compare',provider:'claude'});const rejected=assert.rejects(request,(e:any)=>e.code==='cancelled');
 await active;const disposed=f.session.dispose();await rejected;await disposed;
 assert.equal(f.state.rules.size,0);assert.equal(f.state.requests.length,4);
 await assert.rejects(f.session.execute({type:'ping'}),(e:any)=>e.code==='closed');
});
test('failed replay cleanup and request errors never expose raw provider errors or secret values',async()=>{
 const f=fixture();f.port.request=async()=>{throw Error('SERVER_SECRET_COOKIE_SECRET');};
 const result=await f.session.execute({type:'compare',provider:'claude'});assert.ok(!JSON.stringify(result).includes('SECRET'));assert.equal(f.state.rules.size,0);
 await assert.rejects(f.session.execute({type:'capture',provider:'claude',storeId:'other-store',names:['sessionKey'],consent:true}),(e:any)=>e.code==='store-unavailable');
});
test('failed persistence cannot turn a provider Retry-After into more requests',async()=>{
 const f=fixture();f.state.fetchStatus=429;f.port.storage.set=async()=>{throw Error('PRIVATE_STORAGE_SECRET');};
 await assert.rejects(f.session.execute({type:'compare',provider:'claude'}),(e:any)=>e.code==='cooldown-storage-unavailable');
 assert.equal(f.state.requests.length,1);
 await assert.rejects(f.session.execute({type:'compare',provider:'claude'}),(e:any)=>e.code==='cooldown');assert.equal(f.state.requests.length,1);
 const invalid=fixture();invalid.state.writes[SPIKE_WAITS_KEY]={claude:'INVALID_PRIVATE_VALUE'};
 await assert.rejects(invalid.session.execute({type:'compare',provider:'claude'}),(e:any)=>e.code==='cooldown-storage-unavailable');assert.equal(invalid.state.requests.length,0);
});
test('late cookie capture after clear or page disposal cannot restore captured credentials',async()=>{
 for(const close of [false,true]){
  const f=fixture();let started!:()=>void,finish!:(cookies:ProbeCookie[])=>void;
  const active=new Promise<void>(resolve=>{started=resolve;});
  f.port.cookies.getAll=async()=>{started();return new Promise<ProbeCookie[]>(resolve=>{finish=resolve;});};
  const request=f.session.execute({type:'capture',provider:'claude',storeId:'normal',names:['sessionKey'],consent:true});
  const rejected=assert.rejects(request,(e:any)=>e.code==='cancelled');await active;
  const stopped=close?f.session.dispose():f.session.execute({type:'clear'});
  finish([cookie()]);await rejected;await stopped;
  if(close)await assert.rejects(f.session.execute({type:'ping'}),(e:any)=>e.code==='closed');
  else assert.equal((await f.session.execute({type:'ping'}) as {capture:unknown}).capture,null);
 }
});
test('a private window created after cancellation is closed without touching any existing window',async()=>{
 const f=fixture();let started!:()=>void,finish!:(value:{id:number;tabs:{id:number;incognito:boolean}[]})=>void;
 const active=new Promise<void>(resolve=>{started=resolve;});
 f.port.windows.create=async()=>{started();return new Promise(resolve=>{finish=resolve;});};
 const request=f.session.execute({type:'private',provider:'claude',action:'open'}),rejected=assert.rejects(request,(e:any)=>e.code==='cancelled');await active;
 const stopped=f.session.dispose();finish({id:77,tabs:[{id:78,incognito:true}]});await rejected;await stopped;
 assert.deepEqual(f.state.closed,[77]);assert.deepEqual(f.state.tabs,[{id:1,incognito:false}]);
});
test('Grok comparison preserves the fixed quota POST and JSON body across all three transports',async()=>{
 const f=fixture();f.state.normalCookies=[{...cookie(),domain:'.grok.com',name:'x-user-session'}];
 f.port.request=async(url,options)=>{
  f.state.requests.push({url,options});return new Response(JSON.stringify(new URL(url).pathname==='/rest/subscriptions'
   ?{subscriptions:[{xaiUserId:'PRIVATE_GROK_ID',tier:'SUBSCRIPTION_TIER_GROK_PRO',status:'SUBSCRIPTION_STATUS_ACTIVE'}]}
   :{remainingQueries:20,totalQueries:80}),{headers:{'content-type':'application/json'}});
 };
 f.port.ambient=(provider,signal,trace)=>async(path,headers={},request)=>{
  const response=await readJsonResponse(await f.port.request('https://grok.com'+path,{credentials:'include',signal,headers,method:request?.method??'GET',body:request?JSON.stringify(request.body):undefined}));
  await trace.record({provider,path,transport:'background',...response});return response.body;
 };
 await f.session.execute({type:'capture',provider:'grok',storeId:'normal',names:['x-user-session'],consent:true});
 const output=await f.session.execute({type:'compare',provider:'grok'}) as {summaries:{result:string}[]};
 assert.ok(output.summaries.every(s=>s.result==='reader-validated'));
 const posts=f.state.requests.filter(r=>r.options.method==='POST');assert.equal(posts.length,3);
 for(const post of posts){assert.equal(post.url,'https://grok.com/rest/rate-limits');assert.deepEqual(JSON.parse(String(post.options.body)),{requestKind:'DEFAULT',modelName:'grok-4'});}
 assert.deepEqual(posts.map(r=>r.options.credentials),['include','include','omit']);assert.ok(!JSON.stringify(output).includes('PRIVATE_GROK_ID'));
});
