import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Connections } from './connections.mjs';
import { validRequest } from './protocol.mjs';
import { upstreamError } from './app-server.mjs';

const quota = n => ({ rateLimits: { limitId: 'codex', primary: { usedPercent: n, windowDurationMins: 300, resetsAt: 1900000000 } } });
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mylimits-connect-'));
  const accounts = new Map(), clients = [], browsers = [];
  let now = 1800000000000;
  const service = new Connections({ directory, claudeAdapter:{readiness:async()=>({available:false,reason:'Fictional missing dependency'})}, now: () => now, launchAuth: async value => { browsers.push(value); },
    makeClient: options => {
      const id = path.basename(options.home);
      if (!accounts.has(id)) accounts.set(id, { email: `${id}@example.test`, n: accounts.size * 30, signedIn: false });
      const state = accounts.get(id);
      const client = new EventEmitter(); client.ready = Promise.resolve(); client.calls = []; client.options = options;
      client.request = async (method, params) => {
        client.calls.push({ method, params });
        if (method === 'account/login/start') {
          const loginId = `${id}-login`;
          if (!state.noComplete) { state.signedIn = true; queueMicrotask(() => client.emit('notification', { method: 'account/login/completed', params: { loginId, success: true } })); }
          return { loginId, authUrl: 'https://auth.openai.com/authorize?state=PRIVATE-AUTH-URL' };
        }
        if (method === 'account/read') return { account: state.signedIn ? { type: 'chatgpt', email: state.email, planType: 'plus', accessToken: 'PRIVATE-TOKEN' } : null };
        if (method === 'account/rateLimits/read') {
          if (state.wait) await state.wait;
          if (state.error) throw state.error;
          if (state.changeIdentity) state.email = 'unexpected@example.test';
          return state.empty ? {} : quota(state.n);
        }
        if (method === 'account/logout') { if (state.logoutFailure) throw Error('PRIVATE-ERROR'); state.signedIn = false; }
        return {};
      };
      client.close = () => client.emit('stopped'); clients.push(client); return client;
    } });
  await service.load();
  t.after(async () => { await service.close(); await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  // Most old lifecycle cases explicitly approve their fictional account; the
  // confirmation-specific cases below inspect the default unapproved state.
  const idle = async (confirm = true) => { for (let i = 0; i < 20; i++) {
    await Promise.allSettled([...service.operations.values()]);
    const waiting = confirm ? [...service.profiles.values()].filter(p=>p.authState==='awaiting-confirmation') : [];
    for (const p of waiting) await service.confirm(p.id,p.generation);
    if (!service.operations.size && !waiting.length) break;
  } };
  return { service, accounts, clients, browsers, directory, idle, advance: (ms = 120001) => { now += ms; } };
}
test('strict native contract rejects token fields, invalid profiles and control text', () => {
  assert.ok(validRequest({ id: 'request', method: 'start', provider: 'openai', alias: 'Work' }));
  for (const extra of [{ token: 'secret' }, { executable: 'evil' }, { profile: '../auth' }]) assert.equal(validRequest({ id: 'request', method: 'start', ...extra }), false);
  assert.equal(validRequest({ id: 'request', method: 'rename', profile: 'a'.repeat(36), alias: 'bad\n' }), false);
  assert.equal(validRequest({ id: 'request', method: 'toString' }), false);
});
test('two account sign-ins use distinct homes/browsers and only verified identity-bound quotas', async t => {
  const { service, idle, clients, browsers } = await fixture(t);
  const a = await service.add('openai', 'Personal'); await idle();
  const b = await service.add('openai', 'Work'); await idle();
  const profiles = service.snapshot().profiles;
  assert.equal(profiles.find(p => p.id === a.profile).meters[0].usedPercent, 0);
  assert.equal(profiles.find(p => p.id === b.profile).meters[0].usedPercent, 30);
  assert.ok(profiles.every(p => p.authState === 'connected' && p.identityConfidence === 'email-only' && p.providerSubject === null));
  assert.equal(new Set(clients.map(c=>c.options.home)).size,2);
  assert.notEqual(browsers[0].directory, browsers[1].directory);
  assert.ok(!JSON.stringify(service.snapshot()).includes('PRIVATE'));
  assert.ok(clients.every(c => c.calls.every(v => /^account\/(login\/(start|cancel)|read|rateLimits\/read)$/.test(v.method))));
});
test('same identity is surfaced as duplicate without merging or claiming connected', async t => {
  const { service, idle, accounts } = await fixture(t);
  const a = await service.add(); await idle();
  const original = accounts.get(a.profile).email;
  service.launchAuth = async () => { [...accounts.values()].at(-1).email = original; };
  const b = await service.add(); await idle();
  assert.equal(service.get(b.profile).authState, 'duplicate');
  assert.equal(service.get(b.profile).updatedAt, 0);
  assert.equal(service.snapshot().profiles.length, 2);
  assert.ok(service.snapshot().profiles.every(p => p.possibleDuplicate));
});
test('official completion stages reported OpenAI identity until an explicit generation-bound confirmation', async t => {
  const {service,idle,clients}=await fixture(t);
  const {profile}=await service.add('openai','Personal'); await idle(false);
  const pending=service.get(profile);
  assert.equal(pending.authState,'awaiting-confirmation');assert.equal(pending.confirmed,false);
  assert.equal(pending.updatedAt,0);assert.equal(pending.meters.length,0);
  assert.ok(pending.displayIdentity.endsWith('@example.test'));
  assert.ok(clients.every(c=>!c.calls.some(v=>v.method==='account/rateLimits/read')));
  await service.refresh(profile,true);assert.equal(pending.updatedAt,0);
  await assert.rejects(service.confirm(profile,pending.generation-1),e=>e.code==='stale-confirmation');
  await service.confirm(profile,pending.generation,'My personal account');
  assert.equal(pending.confirmed,true);assert.equal(pending.authState,'connected');
  assert.equal(pending.alias,'My personal account');assert.equal(pending.meters[0].usedPercent,0);
});
test('wrong identity after confirmation and cancellation of pending identity cannot connect',async t=>{
  const {service,idle,accounts}=await fixture(t);
  const a=await service.add();await idle(false);const p=service.get(a.profile);
  accounts.get(a.profile).email='wrong@example.test';await service.confirm(p.id,p.generation);
  assert.equal(p.authState,'needs-sign-in');assert.equal(p.confirmed,false);assert.equal(p.updatedAt,0);
  const b=await service.add();await idle(false);const q=service.get(b.profile);const generation=q.generation;
  await service.cancel(q.id);await assert.rejects(service.confirm(q.id,generation),e=>e.code==='stale-confirmation');
  assert.equal(q.updatedAt,0);assert.equal(q.displayIdentity,null);
  assert.equal(validRequest({id:'confirm',method:'confirm',profile:q.id,generation:-1}),false);
  assert.equal(validRequest({id:'confirm',method:'confirm',profile:q.id,generation,alias:'Work'}),true);
});
test('failed/empty checks retain exact prior timestamp, persist cooldown and recover after restart', async t => {
  const { service, idle, accounts, advance, directory } = await fixture(t);
  const a = await service.add(); await idle(); const prior = service.get(a.profile).updatedAt;
  const state = accounts.get(a.profile); state.empty = true; advance(); await service.refresh(a.profile);
  assert.equal(service.get(a.profile).updatedAt, prior); assert.equal(service.get(a.profile).errorCode, 'quota-unavailable');
  state.empty = false; state.error = Object.assign(Error('PRIVATE-ERROR'), { code: 'throttled', retryAt: prior + 3600000 });
  advance(); await service.refresh(a.profile);
  assert.equal(service.get(a.profile).updatedAt, prior);
  assert.equal(service.get(a.profile).nextRetryAt, prior + 3600000);
  const restored = new Connections({ directory }); await restored.load();
  assert.equal(restored.get(a.profile).updatedAt, prior); assert.equal(restored.get(a.profile).status, 'unavailable');
  assert.equal(restored.get(a.profile).nextRetryAt, prior + 3600000); await restored.close();
  assert.ok(!JSON.stringify(service.snapshot()).includes('PRIVATE'));
});
test('identity changes between quota reads are rejected', async t => {
  const { service, idle, accounts, advance } = await fixture(t);
  const a = await service.add(); await idle(); const prior = service.get(a.profile).updatedAt;
  accounts.get(a.profile).changeIdentity = true; advance(); await service.refresh(a.profile);
  assert.equal(service.get(a.profile).errorCode, 'identity-changed'); assert.equal(service.get(a.profile).updatedAt, prior);
});
test('cancelled and unrelated login completion never connect a profile', async t => {
  const { service, idle, clients, accounts } = await fixture(t);
  const original = service.makeClient;
  service.makeClient = options => { const client = original(options); accounts.get(path.basename(options.home)).noComplete = true; return client; };
  const a = await service.add();
  while (!clients.length) await new Promise(resolve => setImmediate(resolve));
  clients[0].emit('notification', { method: 'account/login/completed', params: { loginId: 'other-account', success: true } });
  await service.cancel(a.profile); await idle();
  assert.equal(service.get(a.profile).authState, 'needs-sign-in'); assert.equal(service.get(a.profile).updatedAt, 0);
});
test('disconnect is scoped and failed logout keeps credentials/readings for retry', async t => {
  const { service, idle, accounts } = await fixture(t);
  const a = await service.add(); await idle(); const b = await service.add(); await idle();
  accounts.get(a.profile).logoutFailure = true;
  await assert.rejects(service.disconnect(a.profile), e => e.code === 'logout-unconfirmed');
  assert.ok(service.get(a.profile).meters.length);
  accounts.get(a.profile).logoutFailure = false; await service.disconnect(a.profile);
  assert.equal(service.get(a.profile).authState, 'disconnected');
  assert.equal(accounts.get(b.profile).signedIn, true); assert.equal(service.get(b.profile).authState, 'connected');
});
test('legacy index migrates IDs without touching profile credentials', async t => {
  const { service, directory } = await fixture(t); await service.close();
  await rm(path.join(directory, 'connections-v2.json'));
  const id = '7ed38977-1fc5-405a-8ac6-e3da24df7e4f';
  await writeFile(path.join(directory, 'profiles.json'), JSON.stringify([id]));
  const upgraded = new Connections({ directory }); await upgraded.load();
  assert.equal(upgraded.get(id).id, id); assert.equal(upgraded.get(id).status, 'unavailable');
  assert.equal(await readFile(path.join(directory, 'profiles.json'), 'utf8'), JSON.stringify([id])); await upgraded.close();
});
test('missing Claude dependency is explicit and allocates no misleading profile', async t => {
  const { service } = await fixture(t);
  await assert.rejects(service.add('claude', 'Work'), e => e.code === 'provider-unavailable');
  assert.equal(service.profiles.size, 0);
  assert.equal((await service.handle({ method: 'capabilities' })).providers.find(p => p.provider === 'claude').available, false);
});
test('retry parser retains explicit Retry-After and strips raw errors', () => {
  const error = upstreamError({ message: 'PRIVATE', data: { status: 429, headers: { 'retry-after': '600' }, token: 'PRIVATE' } }, 1000);
  assert.equal(error.code, 'throttled'); assert.equal(error.retryAt, 601000); assert.ok(!error.message.includes('PRIVATE'));
  assert.equal(upstreamError({ data: { status: 401 } }).code, 'needs-sign-in');
});

test('refresh coalesces each account and bounds total provider work to two processes', async t => {
  const { service, idle, accounts, advance } = await fixture(t);
  const ids=[]; for(let i=0;i<4;i++){ids.push((await service.add()).profile);await idle();}
  let release;const wait=new Promise(resolve=>{release=resolve;});for(const state of accounts.values())state.wait=wait;
  advance();const tasks=ids.flatMap(id=>[service.refresh(id),service.refresh(id)]);
  for(let i=0;i<20&&service.running<2;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(service.running,2);assert.equal(service.operations.size,4);
  release();await Promise.all(tasks);assert.equal(service.running,0);
  for(const id of ids)assert.equal(service.get(id).authState,'connected');
});
test('expired authorization and late generations preserve dated data', async t => {
  const { service, idle, accounts, advance } = await fixture(t);
  const a=await service.add();await idle();const prior=service.get(a.profile).updatedAt;
  const state=accounts.get(a.profile);state.signedIn=false;advance();await service.refresh(a.profile);
  assert.equal(service.get(a.profile).authState,'needs-sign-in');assert.equal(service.get(a.profile).updatedAt,prior);
  state.signedIn=true;state.error=null;advance();service.get(a.profile).authState='connected';
  let release;state.wait=new Promise(resolve=>{release=resolve;});const task=service.refresh(a.profile);
  for(let i=0;i<20&&!service.get(a.profile).lastAttemptAt;i++)await new Promise(resolve=>setImmediate(resolve));
  // Change authorization generation while an upstream response is in flight.
  await new Promise(resolve=>setTimeout(resolve,5));service.get(a.profile).generation++;release();await task;
  assert.equal(service.get(a.profile).errorCode,'identity-changed');assert.equal(service.get(a.profile).updatedAt,prior);
});
test('integrated service uses real fictional CLI subprocesses and confirms their shutdown', async t => {
  const {mkdir}=await import('node:fs/promises');
  const directory=await mkdtemp(path.join(tmpdir(),'mylimits-real-connect-'));
  const ids=['1f30feba-2b2a-4c19-8ebc-cd35bc96ff71','6c7b581a-333d-4016-955e-98e84dcf22aa'];
  await writeFile(path.join(directory,'profiles.json'),JSON.stringify(ids));
  for(const [index,id] of ids.entries()){
    const home=path.join(directory,'accounts',id);await mkdir(home,{recursive:true});
    await writeFile(path.join(home,'proof-fixture.json'),JSON.stringify({email:`account-${index}@example.test`,used:index*35}));
  }
  const service=new Connections({directory,executable:path.resolve('tests/fixtures/account-proof-cli.mjs')});
  t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
  await service.load();await service.refreshAll();
  assert.equal(service.get(ids[0]).meters[0]?.usedPercent,0);assert.equal(service.get(ids[1]).meters[0]?.usedPercent,35);
  assert.equal(service.clients.size,0);assert.ok(!service.requiresRecovery);
  assert.ok(!JSON.stringify(service.snapshot()).includes('NEVER_EXPORT'));
});

test('two Claude accounts and an OpenAI account keep identity, usage and logout independent', async t => {
 const f=await fixture(t), {service,idle,advance,directory}=f;
 const states=new Map();
 service.claudeAdapter={
  readiness:async()=>({available:true}),
  context:async(root,generation,signal)=>{
   const id=path.basename(root);if(!states.has(id))states.set(id,{email:`${id}@claude.test`,used:states.size*40});
   return {root,id,generation,signal,home:path.join(root,'claude')};
  },
  login:async c=>{states.get(c.id).signedIn=true;},
  identity:async c=>{const v=states.get(c.id);if(!v.signedIn)throw Object.assign(Error(),{code:'needs-sign-in'});return {binding:JSON.stringify([v.email,'org-'+c.id]),display:v.email,plan:'pro',confidence:'email-and-organization',organizationId:'org-'+c.id};},
  usage:async c=>{const v=states.get(c.id);if(v.fail)throw Object.assign(Error(),{code:'needs-setup'});return {meters:[{id:'session',label:'Current session',usedPercent:v.used,resetsAt:null}]};},
  logout:async c=>{states.get(c.id).signedIn=false;},
  onboarding:async c=>{states.get(c.id).fail=false;},
 };
 const gpt=await service.add('openai','GPT');await idle();
 const a=await service.add('claude','Claude Personal');await idle();const b=await service.add('claude','Claude Work');await idle();
 assert.equal(service.get(a.profile).meters[0].usedPercent,0);assert.equal(service.get(b.profile).meters[0].usedPercent,40);
 assert.equal(service.get(a.profile).meters[0].scope,'subscription');
 assert.equal(service.snapshot().profiles.find(p=>p.id===a.profile).identityConfidence,'email-and-organization');
 const prior=service.get(a.profile).updatedAt;states.get(a.profile).fail=true;advance(300001);await service.refresh(a.profile);
 assert.equal(service.get(a.profile).authState,'needs-setup');assert.equal(service.get(a.profile).updatedAt,prior);
 await service.setup(a.profile);await idle();advance(300001);await service.refresh(a.profile);
 assert.equal(service.get(a.profile).authState,'connected');
 await service.disconnect(a.profile);assert.equal(service.get(a.profile).authState,'disconnected');
 assert.equal(service.get(b.profile).authState,'connected');assert.equal(service.get(gpt.profile).authState,'connected');
 const restored=new Connections({directory,claudeAdapter:service.claudeAdapter});await restored.load();
 assert.equal(restored.get(b.profile).provider,'claude');assert.equal(restored.get(b.profile).meters[0].usedPercent,40);await restored.close();
});
test('Claude confirmation binds organization, retains consent across setup and detects identity changes',async t=>{
 const {service,idle,advance}=await fixture(t); const states=new Map();
 service.claudeAdapter={
  readiness:async()=>({available:true}),
  context:async(root,generation,signal)=>{const id=path.basename(root);if(!states.has(id))states.set(id,{org:'org-'+id,used:13,setup:true});return {id,generation,signal};},
  login:async()=>{},
  identity:async c=>({binding:JSON.stringify(['same@example.test',states.get(c.id).org]),display:'same@example.test',plan:'pro',confidence:'email-and-organization',organizationId:states.get(c.id).org}),
  usage:async c=>{const s=states.get(c.id);if(s.setup)throw Object.assign(Error('PRIVATE'),{code:'needs-setup'});if(s.changed)s.org='changed';return {meters:[{id:'session',label:'Current session',usedPercent:s.used,resetsAt:null}]};},
  onboarding:async c=>{states.get(c.id).setup=false;},logout:async()=>{},
 };
 const a=await service.add('claude','Work');await idle(false);const p=service.get(a.profile);
 assert.equal(p.authState,'awaiting-confirmation');assert.equal(p.updatedAt,0);
 await service.confirm(p.id,p.generation);assert.equal(p.authState,'needs-setup');assert.equal(p.confirmed,true);
 service.setup(p.id);await idle(false);advance(300001);await service.refresh(p.id,true);
 assert.equal(p.authState,'connected');assert.equal(p.meters[0].usedPercent,13);
 states.get(p.id).used=42;advance(300001);await service.refresh(p.id);assert.equal(p.meters[0].usedPercent,42);
 const b=await service.add('claude','Other workspace');await idle();
 assert.notEqual(service.get(b.profile).workspaceIdentity,p.workspaceIdentity);
 assert.equal(service.snapshot().profiles.some(p=>p.possibleDuplicate),false);
 const before=p.updatedAt;states.get(p.id).changed=true;advance(300001);await service.refresh(p.id);
 assert.equal(p.errorCode,'identity-changed');assert.equal(p.confirmed,false);assert.equal(p.updatedAt,before);
 assert.ok(!JSON.stringify(service.snapshot()).includes('PRIVATE'));
});
test('Claude browser URL validation requires first-party authorize and local first-party callback', async()=>{
 const {safeAuthUrl}=await import('./protocol.mjs');
 const valid='https://claude.com/cai/oauth/authorize?response_type=code&state=fixture&code_challenge=fixture&redirect_uri='+encodeURIComponent('http://localhost:42345/callback');
 assert.equal(safeAuthUrl(valid,'claude'),true);
 for(const url of [valid.replace('claude.com','claude.com.evil.test'),valid.replace('localhost','evil.test'),valid.replace('response_type=code','response_type=token'),'https://claude.ai/settings'])assert.equal(safeAuthUrl(url,'claude'),false);
 const {routeClaudeBrowser}=await import('./claude-browser-route.mjs');
 const directory=await mkdtemp(path.join(tmpdir(),'mylimits-route-test-'));let called;
 try{await routeClaudeBrowser(valid,{MYLIMITS_AUTH_BROWSER_DIRECTORY:directory},async options=>{called=options;});
 assert.equal(called.provider,'claude');assert.deepEqual(JSON.parse(await readFile(path.join(directory,'route-result.json'),'utf8')),{opened:true});
 assert.ok(!(await readFile(path.join(directory,'route-result.json'),'utf8')).includes('fixture'));}
 finally{await rm(directory,{recursive:true,force:true});}
});

test('actual browser launcher forwards the Claude provider to isolated authorization validation',async()=>{
 const {openAuthBrowser}=await import('./auth-browser.mjs');
 const {EventEmitter}=await import('node:events');
 const url='https://claude.com/cai/oauth/authorize?response_type=code&state=fixture&code_challenge=fixture&redirect_uri='+encodeURIComponent('http://localhost:42345/callback');
 const directory=path.resolve('fictional-browser-profile');let launched=false,unreferenced=false;
 await openAuthBrowser({directory,url,provider:'claude'},{
  candidates:()=>['fictional-browser'],accessFile:async()=>{},createDirectory:async()=>{},
  spawnProcess:(file,args,options)=>{
   launched=true;assert.equal(file,'fictional-browser');
   assert.ok(args.includes('--user-data-dir='+directory));assert.ok(args.includes(url));assert.equal(options.stdio,'ignore');
   const child=new EventEmitter();child.unref=()=>{unreferenced=true;};queueMicrotask(()=>child.emit('spawn'));return child;
  },
 });
 assert.ok(launched);assert.ok(unreferenced);
});

test('cancelled Claude login preserves an unconfirmed shutdown as a service recovery failure',async t=>{
 const {service}=await fixture(t);let notify;
 const started=new Promise(resolve=>{notify=resolve;});
 service.claudeAdapter={readiness:async()=>({available:true}),
  context:async(root,generation,signal)=>({signal}),
  login:async({signal})=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>reject(Object.assign(Error('PRIVATE'),{code:'terminal-stop-unconfirmed'})),{once:true});notify();
  }),
 };
 const added=await service.add('claude','Work');await started;await service.cancel(added.profile);
 assert.equal(service.get(added.profile).errorCode,'terminal-stop-unconfirmed');
 assert.equal(service.get(added.profile).authState,'unavailable');assert.equal(service.requiresRecovery,true);
 await assert.rejects(service.serial(added.profile,async()=>assert.fail('Recovery must fence new operations.')),e=>e.code==='service-unavailable');
 assert.ok(!JSON.stringify(service.snapshot()).includes('PRIVATE'));
});

test('production Claude adapter reads two isolated fictional CLI profiles through actual PTYs',async t=>{
 const {mkdir}=await import('node:fs/promises');
 const {createClaudeAdapter}=await import('./claude-adapter.mjs');
 const directory=await mkdtemp(path.join(tmpdir(),'mylimits-real-claude-'));
 const ids=['1f30feba-2b2a-4c19-8ebc-cd35bc96ff71','6c7b581a-333d-4016-955e-98e84dcf22aa'];
 const initial=[];
 for(const [i,id]of ids.entries()){
  const home=path.join(directory,'accounts',id,'claude');await mkdir(home,{recursive:true});
  await writeFile(path.join(home,'fixture.json'),JSON.stringify({email:`claude-${i}@example.test`,org:`org-${i}`,used:i*37}));
  initial.push({id,provider:'claude',alias:`Claude ${i}`,generation:1,binding:null,authState:'unavailable',plan:null,updatedAt:0,meters:[],lastAttemptAt:null,nextRetryAt:null,failures:0});
 }
 await writeFile(path.join(directory,'connections-v2.json'),JSON.stringify({version:2,salt:ids[0],profiles:initial}));
 const adapter=createClaudeAdapter({locate:async()=>path.resolve('tests/fixtures/claude-connection-cli.mjs')});
 const service=new Connections({directory,claudeAdapter:adapter});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await service.load();await service.refreshAll();
 assert.equal(service.get(ids[0]).meters[0]?.usedPercent,0);assert.equal(service.get(ids[1]).meters[0]?.usedPercent,37);
 assert.equal(service.get(ids[0]).meters[0]?.resetsAt,null);
 assert.equal(service.get(ids[0]).authState,'connected');assert.ok(!JSON.stringify(service.snapshot()).includes('PRIVATE'));
 // Exercise the production login terminal and scoped cancellation too.
 service.get(ids[0]).nextRetryAt=null;service.beginLogin(ids[0]);await Promise.allSettled([...service.operations.values()]);
 assert.equal(service.get(ids[0]).authState,'connected');
 const home=path.join(directory,'accounts',ids[1],'claude');
 await writeFile(path.join(home,'fixture.json'),JSON.stringify({email:'claude-1@example.test',org:'org-1',used:37,delayLogin:true}));
 service.get(ids[1]).nextRetryAt=null;service.beginLogin(ids[1]);
 let started=false;for(let i=0;i<100;i++){try{await readFile(path.join(home,'login-started'));started=true;break;}catch{}await new Promise(resolve=>setTimeout(resolve,20));}
 assert.ok(started);await service.cancel(ids[1]);assert.equal(service.get(ids[1]).authState,'needs-sign-in');
 assert.equal(service.get(ids[1]).meters[0].usedPercent,37);

});
