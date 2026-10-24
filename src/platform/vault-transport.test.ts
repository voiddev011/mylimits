import test from 'node:test';import assert from 'node:assert/strict';
import { createVaultTransport,cleanupVaultRules,vaultRule,VAULT_RULE_START,VAULT_RULE_END,type VaultTransportPort } from './vault-transport';
import { createHostLock } from './host-lock';
import { VaultError } from '../core/vault-contracts';
import { sanitizeDiagnostic,type DiagnosticInput } from './diagnostics';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const tick=()=>new Promise<void>(r=>setImmediate(r));
function gate(){let resolve!:()=>void;return {promise:new Promise<void>(r=>{resolve=r;}),release:()=>resolve()};}
function fixture(){
 let rules:{id:number}[]=[],failRemove=false,nextStatus=200,nextRetry:string|null=null,waitUntil=0;
 const blocked=new Set<string>(),calls:{url:string;init:RequestInit}[]=[],events:string[]=[],diagnostics:DiagnosticInput[]=[];
 const lock=createHostLock(undefined,host=>blocked.has(host));
 const port:VaultTransportPort={extensionId:'a'.repeat(32),dnr:{async getSessionRules(){return rules},async updateSessionRules(o){
  if(failRemove&&!o.addRules)throw Error('RULE_SECRET');rules=rules.filter(r=>!o.removeRuleIds.includes(r.id));rules.push(...o.addRules??[]);events.push(o.addRules?'add':'remove');}},
  enabled:()=>true,permitted:async()=>true,getVault:async(slot,provider)=>({payload:{v:1,origin:provider==='chatgpt'?'https://chatgpt.com':provider==='claude'?'https://claude.ai':'https://cursor.com',cookies:[{name:'fixture',value:slot===A?'COOKIE_A':'COOKIE_B'},{name:'old',value:'EXPIRED',expirationDate:1}]}}),
  async request(url,init){calls.push({url,init});return new Response(JSON.stringify({value:'BODY_SECRET'}),{status:nextStatus,headers:{'content-type':'application/json',...(nextRetry?{'retry-after':nextRetry}:{})}});},
  lock,now:()=>1800000000000,async wait(){if(waitUntil>port.now())throw new VaultError('cooldown');},async rememberWait(_p,time){waitUntil=time},blockHost:h=>{blocked.add(h);},ready:async()=>{}};
 let startup:Promise<void>|undefined;port.ready=()=>startup??=cleanupVaultRules({dnr:port.dnr,permitted:async()=>true});
 return {port,transport:createVaultTransport(port),rules:()=>rules,setRules:(v:{id:number}[])=>{rules=v},calls,events,diagnostics,lock,blocked,
  failCleanup:()=>{failRemove=true;},status:(s:number,retry:string|null=null)=>{nextStatus=s;nextRetry=retry},wait:()=>waitUntil,
  trace:{lastSuccessAt:1,record:async(v:DiagnosticInput)=>{diagnostics.push(v)}}};
}
test('vault transport scopes cookie rules, skips expired cookies, omits ambient credentials and removes after reading',async()=>{
 const f=fixture();await f.transport.read('chatgpt',A,undefined,f.trace)('/api/auth/session');
 assert.equal(f.calls[0]!.init.credentials,'omit');assert.equal(f.calls[0]!.init.redirect,'error');assert.deepEqual(f.rules(),[]);assert.deepEqual(f.events,['add','remove']);
 const rule=vaultRule('chatgpt','a'.repeat(32),'fixture=COOKIE_A');assert.deepEqual(rule.condition,{requestDomains:['chatgpt.com'],initiatorDomains:['a'.repeat(32)],tabIds:[-1],resourceTypes:['xmlhttprequest']});
 const trace=JSON.stringify(f.diagnostics);for(const secret of ['COOKIE_A','BODY_SECRET','ciphertext'])assert.ok(!trace.includes(secret));assert.equal(f.diagnostics[0]!.transport,'vault');
});
test('startup cleanup removes only the vault range and fails closed on errors',async()=>{
 const f=fixture();f.setRules([{id:VAULT_RULE_START},{id:VAULT_RULE_END},{id:940001},{id:7}]);await f.transport.initialize();assert.deepEqual(f.rules(),[{id:940001},{id:7}]);
 const g=fixture();g.setRules([{id:VAULT_RULE_START}]);g.failCleanup();await assert.rejects(g.transport.initialize(),{code:'rule-cleanup-failed'});
 await assert.rejects(g.lock('chatgpt.com',async()=>1),/needs recovery/);assert.equal(g.calls.length,0);
 const h=fixture();await cleanupVaultRules({dnr:h.port.dnr,permitted:async()=>false});assert.deepEqual(h.events,[]);
});
test('same-host ambient and two vault accounts never overlap and each rule is removed before release',async()=>{
 const f=fixture(),pending=gate(),events:string[]=[];
 f.port.request=async()=>{events.push('vault');assert.equal(f.rules().length,1);await pending.promise;return new Response('{}',{headers:{'content-type':'application/json'}});};
 const a=f.transport.read('chatgpt',A)('/api/auth/session');await tick();
 const ambient=f.lock('chatgpt.com',async()=>{assert.deepEqual(f.rules(),[]);events.push('ambient');});
 const b=f.transport.read('chatgpt',B)('/api/auth/session');await tick();assert.deepEqual(events,['vault']);
 pending.release();await Promise.all([a,ambient,b]);assert.deepEqual(events,['vault','ambient','vault']);assert.deepEqual(f.rules(),[]);
});
test('request errors and cancellation remove the rule before allowing ambient work',async()=>{
 for(const abort of [false,true]){const f=fixture(),controller=new AbortController(),pending=gate();
  f.port.request=async()=>{await pending.promise;throw Error('COOKIE_A RAW_PROVIDER_SECRET')};
  const task=f.transport.read('chatgpt',A,controller.signal)('/api/auth/session');await tick();if(abort)controller.abort();
  const rejected=assert.rejects(task,e=>e instanceof VaultError&&!e.message.includes('SECRET'));
  const ambient=f.lock('chatgpt.com',async()=>{assert.deepEqual(f.rules(),[]);});await tick();assert.equal(f.rules().length,1);pending.release();await rejected;await ambient;
 }
});
test('failed final cleanup poisons both saved and ambient access without exposing the cookie header',async()=>{
 const f=fixture();f.port.request=async()=>{f.failCleanup();return new Response('{}',{headers:{'content-type':'application/json'}})};
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session'),{code:'rule-cleanup-failed'});
 await assert.rejects(f.transport.read('chatgpt',B)('/api/auth/session'),VaultError);await assert.rejects(f.lock('chatgpt.com',async()=>1),/needs recovery/);
});
test('disabled policy, wrong endpoints, methods and injected headers never issue HTTP',async()=>{
 const f=fixture();f.port.enabled=()=>false;await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session'),{code:'disabled'});assert.deepEqual(f.events,[]);
 f.port.enabled=()=>true;
 for(const path of ['https://evil.test/','//evil.test/','/logout','/api/auth/session?token=SECRET'])await assert.rejects(f.transport.read('chatgpt',A)(path),{code:'invalid-request'});
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session',{Cookie:'SECRET'}),{code:'invalid-request'});
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session',{Authorization:'Bearer x\r\nBAD'}),{code:'invalid-request'});
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session',{}, {method:'POST',body:{}}),{code:'invalid-request'});
 assert.equal(f.calls.length,0);
});
test('diagnostics sanitize org paths and cleanup permission failures never leak raw API errors',async()=>{
 const f=fixture();await f.transport.read('claude',A,undefined,{lastSuccessAt:null,record:async v=>{f.diagnostics.push(sanitizeDiagnostic(v,1)!);}})('/api/organizations/WORKSPACE_SECRET/usage');
 assert.ok(!JSON.stringify(f.diagnostics).includes('WORKSPACE_SECRET'));
 await assert.rejects(cleanupVaultRules({dnr:f.port.dnr,permitted:async()=>{throw Error('PERMISSION_SECRET')}}),e=>e instanceof VaultError&&!e.message.includes('PERMISSION_SECRET'));
});
test('missing, expired and wrong-origin credentials do not install a rule or issue a request',async()=>{
 for(const state of ['missing','expired','wrong-origin']){const f=fixture();
  f.port.getVault=async()=>state==='missing'?null:{payload:{v:1,origin:state==='wrong-origin'?'https://evil.test':'https://chatgpt.com',cookies:[{name:'fixture',value:'SECRET',expirationDate:1}]}};
  await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session'),VaultError);assert.deepEqual(f.events,[]);assert.equal(f.calls.length,0);
 }
});
test('a partially installed rule is removed even if adding it rejects',async()=>{
 const f=fixture(),update=f.port.dnr.updateSessionRules.bind(f.port.dnr);
 f.port.dnr.updateSessionRules=async o=>{await update(o);if(o.addRules)throw Error('SECRET_RULE_ERROR')};
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session'),{code:'request-failed'});assert.deepEqual(f.rules(),[]);assert.equal(f.calls.length,0);
});
test('different provider requests keep distinct rule IDs and can run concurrently',async()=>{
 const f=fixture(),pending=gate();let started=0;
 f.port.request=async()=>{started++;await pending.promise;return new Response('{}',{headers:{'content-type':'application/json'}});};
 const a=f.transport.read('chatgpt',A)('/api/auth/session'),b=f.transport.read('claude',B)('/api/account');
 await tick();assert.equal(started,2);assert.equal(new Set(f.rules().map(r=>r.id)).size,2);pending.release();await Promise.all([a,b]);assert.deepEqual(f.rules(),[]);
});
test('successful responses also preserve provider Retry-After and missing 429 waits get a fallback',async()=>{
 const f=fixture();f.status(200,'90');await f.transport.read('chatgpt',A)('/api/auth/session');assert.equal(f.wait(),f.port.now()+90000);
 await assert.rejects(f.transport.read('chatgpt',A)('/api/auth/session'),{code:'cooldown'});assert.equal(f.calls.length,1);
 const g=fixture();g.status(429);await assert.rejects(g.transport.read('chatgpt',A)('/api/auth/session'),{code:'rate-limit'});assert.equal(g.wait(),g.port.now()+60000);
});
