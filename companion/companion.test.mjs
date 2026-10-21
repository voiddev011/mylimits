import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { frame, frameReader, MAX_FRAME, safeAuthUrl, validRequest } from './protocol.mjs';
import { parseLimits } from './limits.mjs';
import { AppServer } from './app-server.mjs';
import { Companion } from './service.mjs';

const quota = percent => ({ rateLimitsByLimitId: { codex: { primary: { usedPercent: percent, windowDurationMins: 300, resetsAt: 1800000000 }, secondary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 1800500000 } } } });

test('native framing handles fragmented UTF-8 and several messages in one chunk', () => {
  const values = [{ id: 'a', value: '你好 ✦' }, { id: 'b', value: 'second' }];
  const received = []; const read = frameReader(value => received.push(value));
  const bytes = Buffer.concat(values.map(frame));
  for (let i = 0; i < bytes.length; i += 3) read(bytes.subarray(i, i + 3));
  assert.deepEqual(received, values);
});
test('invalid, oversized and arbitrary native operations are rejected', () => {
  const header = Buffer.alloc(4); header.writeUInt32LE(MAX_FRAME + 1);
  assert.throws(() => frameReader(() => {})(header));
  assert.throws(() => frameReader(() => {})(Buffer.from([0, 0, 0, 0])));
  assert.throws(() => frame({ value: 'x'.repeat(MAX_FRAME) }));
  assert.ok(validRequest({ id: 'req-1', method: 'status' }));
  assert.ok(!validRequest({ id: 'req', method: 'turn/start' }));
  assert.ok(!validRequest({ id: 'req', method: 'remove', profile: '../../auth' }));
});
test('sign-in URL must use the exact OpenAI HTTPS origin', () => {
  assert.ok(safeAuthUrl('https://auth.openai.com/authorize?state=abc'));
  for (const url of ['https://auth.openai.com.evil.test/', 'https://user@chatgpt.com/', 'http://chatgpt.com/', 'javascript:alert(1)', 'https://chatgpt.com:1234/']) assert.equal(safeAuthUrl(url), false);
});
test('only actual quota buckets are normalized, preserving zero and reset units', () => {
  const meters = parseLimits({ ...quota(65), accessToken: 'secret' });
  assert.equal(meters.length, 2); assert.equal(meters[0].usedPercent, 65);
  assert.equal(meters[1].usedPercent, 0); assert.equal(meters[0].resetsAt, 1800000000000);
  assert.equal(meters[0].label, 'codex · 5h'); assert.equal(meters[1].label, 'codex · 7d');
  assert.ok(!JSON.stringify(meters).includes('secret'));
  assert.deepEqual(parseLimits({}), []);
  assert.deepEqual(parseLimits({ rateLimits: { primary: { usedPercent: '50' } } }), []);
  assert.equal(parseLimits({ rateLimits: { primary: { usedPercent: 0 } } })[0].resetsAt, null);
});

function processFixture(handler) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null; child.killed = false;
  child.stdin = new Writable({ write(chunk, _encoding, done) { handler(JSON.parse(chunk.toString()), value => child.stdout.write(JSON.stringify(value) + '\n')); done(); } });
  child.kill = () => { child.killed = true; child.emit('exit', 0); };
  return child;
}
test('App Server initializes, matches responses, sanitizes errors and rejects server tool requests', async () => {
  const seen = [];
  const child = processFixture((message, reply) => {
    seen.push(message);
    if (message.method === 'initialize') reply({ id: message.id, result: {} });
    if (message.method === 'read') reply({ id: message.id, result: quota(45) });
    if (message.method === 'bad') reply({ id: message.id, error: { message: 'secret token' } });
  });
  const client = new AppServer({ home: '/unused', spawnProcess: () => child });
  await client.ready;
  assert.equal((await client.request('read')).rateLimitsByLimitId.codex.primary.usedPercent, 45);
  await assert.rejects(client.request('bad'), error => !error.message.includes('secret'));
  child.stdout.write(JSON.stringify({ id: 999, method: 'item/commandExecution/requestApproval' }) + '\n');
  assert.equal(seen.at(-1).error.code, -32601); client.close();
});
test('App Server rejects timed out requests and pending requests on process exit', async () => {
  const child = processFixture((message, reply) => { if (message.method === 'initialize') reply({ id: message.id, result: {} }); });
  const client = new AppServer({ home: '/unused', timeout: 10, spawnProcess: () => child });
  await client.ready; await assert.rejects(client.request('never'), /timed out/);
  const pending = client.request('pending'); child.emit('exit', 1);
  await assert.rejects(pending, /stopped/); client.close();
});

class FakeClient extends EventEmitter {
  ready = Promise.resolve(); percent = 45; failRead = false; failLogout = false; calls = [];
  async request(method) {
    this.calls.push(method);
    if (method === 'account/login/start') return { authUrl: 'https://auth.openai.com/authorize?state=fictional', loginId: 'login-test' };
    if (method === 'account/read') return { account: { type: 'chatgpt', email: 'private@example.com', planType: 'plus', accessToken: 'private-token' } };
    if (method === 'account/rateLimits/read') { if (this.failRead) throw new Error('secret upstream error'); return quota(this.percent); }
    if (method === 'account/logout' && this.failLogout) throw new Error('revoke failed');
    return {};
  }
  close() { this.emit('stopped'); }
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mylimits-test-')); const clients = []; let now = 1800000000000;
  const service = new Companion({ directory, makeClient: () => { const client = new FakeClient(); clients.push(client); return client; }, now: () => now });
  t.after(async () => { service.close(); await rm(directory, { recursive: true, force: true }); });
  await service.load(); return { service, clients, directory, advance: () => { now += 60000; } };
}
test('two independent profiles keep separate limits and expose only sanitized readings', async t => {
  const { service, clients } = await fixture(t);
  const first = await service.add(); const second = await service.add();
  for (const profile of service.profiles.values()) delete profile.loginId;
  clients[1].percent = 65; await service.refreshAll();
  const snapshot = service.snapshot();
  assert.equal(snapshot.profiles.find(profile => profile.id === first.profile).meters[0].usedPercent, 45);
  assert.equal(snapshot.profiles.find(profile => profile.id === second.profile).meters[0].usedPercent, 65);
  const json = JSON.stringify(snapshot);
  for (const value of ['private@example.com', 'private-token', 'authUrl', 'loginId']) assert.ok(!json.includes(value));
  assert.ok(clients.every(client => !client.calls.some(method => method.startsWith('turn/'))));
});
test('failed refresh retains old timestamp and marks reading unavailable', async t => {
  const { service, clients, advance } = await fixture(t); const { profile } = await service.add();
  delete service.profiles.get(profile).loginId; await service.refresh(profile);
  const previous = service.snapshot().profiles[0]; advance(); clients[0].failRead = true;
  await service.refresh(profile); const after = service.snapshot().profiles[0];
  assert.equal(after.status, 'unavailable'); assert.equal(after.updatedAt, previous.updatedAt);
  assert.deepEqual(after.meters, previous.meters);
});
test('logout failure keeps profile and credentials so disconnect can be retried', async t => {
  const { service, clients, directory } = await fixture(t); const { profile } = await service.add();
  delete service.profiles.get(profile).loginId; clients[0].failLogout = true;
  await assert.rejects(service.remove(profile)); assert.ok(service.profiles.has(profile));
  assert.ok(JSON.parse(await readFile(path.join(directory, 'profiles.json'))).includes(profile));
  clients[0].failLogout = false; await service.remove(profile);
  assert.equal(service.snapshot().profiles.length, 0);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'profiles.json'))), []);
});
test('restart reloads profiles without inventing fresh data; private files are owner-only', async t => {
  const { service, directory } = await fixture(t); const { profile } = await service.add();
  if (process.platform !== 'win32') {
    assert.equal((await stat(path.join(directory, 'profiles.json'))).mode & 0o777, 0o600);
    assert.equal((await stat(path.join(directory, 'accounts', profile))).mode & 0o777, 0o700);
  }
  const restarted = new Companion({ directory }); await restarted.load(); t.after(() => restarted.close());
  assert.equal(restarted.snapshot().profiles[0].status, 'unavailable');
  assert.equal(restarted.snapshot().profiles[0].updatedAt, 0); assert.deepEqual(restarted.snapshot().profiles[0].meters, []);
});
test('failed OpenAI reads back off rather than hammering the service', async t => {
  const { service, clients, advance } = await fixture(t); const { profile } = await service.add();
  delete service.profiles.get(profile).loginId; clients[0].failRead = true;
  await service.refresh(profile); const calls = clients[0].calls.length;
  await service.refresh(profile); assert.equal(clients[0].calls.length, calls);
  advance(); await service.refresh(profile); assert.ok(clients[0].calls.length > calls);
});
test('the real child-process RPC transport reads only the requested quota', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mylimits-rpc-'));
  const executable = path.join(directory, 'fixture-codex.mjs');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(executable, `#!${process.execPath}
import readline from 'node:readline';
for await (const line of readline.createInterface({input:process.stdin})) {
  const request=JSON.parse(line);
  if (request.id === undefined) continue;
  const result=request.method==='initialize'?{}:request.method==='account/rateLimits/read'?${JSON.stringify(quota(65))}:{};
  process.stdout.write(JSON.stringify({id:request.id,result})+'\\n');
}
`, { mode: 0o700 });
  const client = new AppServer({ executable, home: directory });
  t.after(async () => { client.close(); await rm(directory, { recursive: true, force: true }); });
  let fixtureError = '';
  client.child.stderr.on('data', chunk => { fixtureError += chunk.toString(); });
  client.child.stdout.on('data', chunk => { fixtureError += ' stdout=' + chunk.toString(); });
  client.child.on('error', error => { fixtureError += error.code; });
  client.child.on('exit', (code, signal) => { fixtureError += ` exit=${code} signal=${signal}`; });
  await client.ready.catch(error => { throw new Error(`${error.message} Fixture stderr: ${fixtureError}`); });
  const meters = parseLimits(await client.request('account/rateLimits/read'));
  assert.equal(meters[0].usedPercent, 65);
});
test('an interrupted sign-in keeps a visible profile for explicit cleanup', async t => {
  const { service, directory } = await fixture(t);
  service.makeClient = () => {
    const client = new FakeClient();
    client.request = async method => method === 'account/login/start' ? { loginId: 'pending', authUrl: 'https://untrusted.example/authorize' } : {};
    return client;
  };
  await assert.rejects(service.add(), /Could not start/);
  assert.equal(service.snapshot().profiles.length, 1);
  assert.equal(service.snapshot().profiles[0].status, 'unavailable');
  assert.equal(JSON.parse(await readFile(path.join(directory, 'profiles.json'))).length, 1);
});
test('Windows paths use LocalAppData and a stable per-user named pipe', async () => {
  const { companionPaths } = await import('./paths.mjs');
  const first = companionPaths('win32', 'C:\\Users\\Jainam', 'C:\\Users\\Jainam\\AppData\\Local');
  assert.equal(first.dataDir, 'C:\\Users\\Jainam\\AppData\\Local\\MyLimitsCompanion');
  assert.ok(first.socketPath.startsWith('\\\\.\\pipe\\mylimits-'));
  assert.notEqual(first.socketPath, companionPaths('win32', 'C:\\Users\\Other').socketPath);
  assert.equal(first.socketPath, companionPaths('win32', 'C:\\Users\\Jainam').socketPath);
});
test('Windows launchers quote spaces, percent and apostrophes without enabling shell expansion', async () => {
  const { batchLauncher, psLiteral, taskScript, registryRoots } = await import('./windows.mjs');
  const batch = batchLauncher('C:\\Program Files\\nodejs\\node.exe', 'C:\\100%\\host.mjs');
  assert.ok(batch.includes('DisableDelayedExpansion')); assert.ok(batch.includes('100%%'));
  assert.ok(!batch.includes('%*'));
  assert.equal(psLiteral("C:\\O'Neil\\node.exe"), "'C:\\O''Neil\\node.exe'");
  assert.ok(taskScript('node.exe', 'daemon.mjs', 'codex.js', 'C:\\My Limits').includes('-EncodedCommand'));
  assert.ok(registryRoots.brave.includes('BraveSoftware\\Brave-Browser'));
});
test('local bridge authorization rejects missing and incorrect tokens', async t => {
  const { localToken, authenticated, challenge, answer } = await import('./local-auth.mjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'mylimits-token-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const token = await localToken(directory, true);
  assert.equal((await localToken(directory)), token);
  assert.equal(await localToken(directory, true), token);
  const hello = challenge(token); const response = answer(hello, token);
  assert.ok(authenticated(response, token, hello.nonce));
  assert.equal(authenticated(response, token, challenge(token).nonce), false);
  assert.throws(() => answer(hello, 'a'.repeat(64)));
  assert.equal(authenticated({ type: 'status' }, token, hello.nonce), false);
  assert.ok(!JSON.stringify([hello, response]).includes(token));
});
test('extension discovery reads only exact MyLimits metadata and rejects malformed identities',async()=>{
 const {extensionCandidates}=await import('./discovery.mjs');
 const input={extensions:{settings:{['a'.repeat(32)]:{manifest:{name:'MyLimits'},accessToken:'DO_NOT_EXPOSE'},['b'.repeat(32)]:{manifest:{name:'Other'}},'bad-id':{manifest:{name:'MyLimits'}}}},cookies:'NEVER_COPY'};
 const found=extensionCandidates(input,'edge','Default');assert.equal(found.length,1);assert.equal(found[0].browser,'edge');assert.ok(!JSON.stringify(found).includes('DO_NOT_EXPOSE'));assert.ok(!JSON.stringify(found).includes('NEVER_COPY'));
 const {registryRoots}=await import('./windows.mjs');assert.equal(registryRoots.edge,'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts');
});

test('independent authorization uses a distinct local browser profile and exposes no authorization URL',async t=>{
 const {service}=await fixture(t);const launched=[];service.launchAuth=async input=>{launched.push(input)};
 const first=await service.add(),second=await service.add();
 assert.equal(first.browserOpened,true);assert.equal(second.browserOpened,true);assert.ok(!('authUrl' in first));
 assert.notEqual(launched[0].directory,launched[1].directory);
 assert.ok(launched[0].directory.includes(first.profile));
 assert.ok(!JSON.stringify(service.snapshot()).includes('fictional'));
});
test('authorization browser validates origins and passes paths as arguments instead of shell code',async()=>{
 const {authArguments,browserCandidates}=await import('./auth-browser.mjs');
 const directory=path.resolve('private space');const args=authArguments(directory,'https://auth.openai.com/authorize?state=test');
 assert.equal(args[0],`--user-data-dir=${directory}`);assert.equal(args.at(-1),'https://auth.openai.com/authorize?state=test');
 assert.throws(()=>authArguments(directory,'https://evil.test/'));assert.throws(()=>authArguments('relative','https://auth.openai.com/'));
 assert.ok(browserCandidates('win32',{PROGRAMFILES:'C:\\Program Files'}).every(p=>p.startsWith('C:\\Program Files')));
});

test('same-email profiles show a conservative duplicate warning without merging workspace identities or exporting email',async t=>{
 const {service}=await fixture(t);await service.add();await service.add();
 for(const profile of service.profiles.values())delete profile.loginId;
 await service.refreshAll();const snapshot=service.snapshot();
 assert.equal(snapshot.profiles.length,2);assert.ok(snapshot.profiles.every(p=>p.possibleDuplicate===true));
 assert.ok(!JSON.stringify(snapshot).includes('private@example.com'));assert.ok(!JSON.stringify(snapshot).includes('identityHint'));
});
