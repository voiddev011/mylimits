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
  const service = new Connections({ directory, now: () => now, launchAuth: async value => { browsers.push(value); },
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
  const idle = async () => { for (let i = 0; i < 20; i++) { await Promise.allSettled([...service.operations.values()]); if (!service.operations.size) break; } };
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
  assert.notEqual(clients[0].options.home, clients[1].options.home);
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
test('Claude is explicitly unavailable and allocates no misleading profile', async t => {
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
