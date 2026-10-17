import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, lstat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { profileEnvironment, command, runCli, proofDirectory } from './runtime.mjs';
import { ProofStore, privateDirectory } from './store.mjs';
import { AccountProof } from './service.mjs';
import { claudeIdentity, parseClaudeUsage, claudeProbeArguments, probeClaudeUsage, stopProbeTerminal } from './claude.mjs';
import { codexLoginWaiter } from './codex-login.mjs';

const executable = fileURLToPath(new URL('../../tests/fixtures/account-proof-cli.mjs', import.meta.url));
const quota = used => ({ rateLimits: { primary: { usedPercent: used, windowDurationMins: 300 } } });
async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mylimits-proof-'));
  const store = new ProofStore(directory);
  const service = new AccountProof({ store, locate: async () => executable, ...options });
  await service.load();
  t.after(async () => { await service.close(); await rm(directory, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 }); });
  return { service, store, directory };
}
async function profileFixture(store, provider, alias, email, used) {
  const p = await store.create(provider, alias);
  const { home } = await store.paths(p);
  await writeFile(path.join(home, 'proof-fixture.json'), JSON.stringify({ email, used }));
  return p;
}
function fakeClient(identityBefore = 'a@fixture.test', identityAfter = identityBefore, used = 20) {
  const client = new EventEmitter(); client.ready = Promise.resolve(); let calls = 0;
  client.request = async method => {
    if (method === 'account/read') return { account: { type: 'chatgpt', email: ++calls === 1 ? identityBefore : identityAfter } };
    if (method === 'account/rateLimits/read') return quota(used);
    throw new Error('Unexpected request');
  };
  client.close = () => client.emit('stopped');
  return client;
}

test('auth environment isolates every selector while preserving proxy, CA and OS settings', () => {
  const env = profileEnvironment('claude', '/proof/claude-a', { PATH: '/bin', HTTPS_PROXY: 'https://proxy', NODE_EXTRA_CA_CERTS: '/ca', HOME: '/home/user',
    OPENAI_API_KEY: 'ambient', CODEX_HOME: 'other', ANTHROPIC_API_KEY: 'ambient', CLAUDE_CONFIG_DIR: 'other', CLAUDE_CODE_OAUTH_TOKEN: 'ambient',
    AWS_PROFILE: 'ambient', AZURE_TENANT_ID: 'ambient', GOOGLE_APPLICATION_CREDENTIALS: 'ambient', NODE_OPTIONS: '--import unsafe', BROWSER: 'unsafe' });
  assert.equal(env.CLAUDE_CONFIG_DIR, '/proof/claude-a'); assert.equal(env.HTTPS_PROXY, 'https://proxy'); assert.equal(env.NODE_EXTRA_CA_CERTS, '/ca');
  assert.equal(env.HOME, '/home/user'); assert.ok(!JSON.stringify(env).includes('ambient')); assert.ok(!JSON.stringify(env).includes('unsafe'));
  assert.equal(profileEnvironment('openai', '/proof/codex-b', env).CODEX_HOME, '/proof/codex-b');
  assert.ok(!('CLAUDE_CONFIG_DIR' in profileEnvironment('openai', '/proof/codex-b', env)));
});
test('native CLI commands never invoke a shell or accept shell launcher scripts', () => {
  assert.throws(() => command('C:\\Users\\name\\claude.cmd', []));
  assert.deepEqual(command('codex.exe', ['auth', 'status']), ['codex.exe', ['auth', 'status']]);
  assert.deepEqual(command('/tmp/path with spaces/cli.mjs', ['auth', 'status']), [process.execPath, ['/tmp/path with spaces/cli.mjs', 'auth', 'status']]);
  assert.equal(proofDirectory('win32', { LOCALAPPDATA: 'C:\\Users\\Example\\AppData\\Local' }), 'C:\\Users\\Example\\AppData\\Local\\MyLimitsAccountProof');
});
test('profile storage is separate, atomic, locked, owner-only and rejects invalid aliases', async t => {
  const { store, directory } = await fixture(t);
  const a = await store.create('openai', 'Personal'), b = await store.create('openai', 'Work');
  assert.notEqual((await store.paths(a)).home, (await store.paths(b)).home);
  await assert.rejects(store.create('claude', 'a@private.test')); await assert.rejects(store.create('x', 'Other'));
  const other = new ProofStore(directory); await assert.rejects(other.load(), /already running/);
  if (process.platform !== 'win32') {
    assert.equal((await lstat(path.join(directory, 'profiles.json'))).mode & 0o777, 0o600);
    assert.equal((await lstat((await store.paths(a)).home)).mode & 0o777, 0o700);
  }
});
test('private profile roots reject symbolic links', { skip: process.platform === 'win32' ? 'Windows symlink privilege is not assumed' : false }, async t => {
  const { directory } = await fixture(t);
  const link = path.join(directory, 'linked'); await symlink(directory, link);
  await assert.rejects(privateDirectory(link), /real private directory/);
});
test('Claude identity requires documented directory confirmation and subscription auth', () => {
  const value = { loggedIn: true, authMethod: 'claude.ai', email: 'A@fixture.test', configDirectory: '/profiles/a' };
  assert.equal(claudeIdentity(value, '/profiles/a', 'linux').display, 'a@fixture.test');
  assert.equal(claudeIdentity({ ...value, subscriptionType: 'max' }, '/profiles/a', 'linux').plan, 'max');
  assert.equal(claudeIdentity({ ...value, subscriptionType: 'unknown' }, '/profiles/a', 'linux').plan, null);
  for (const authMethod of ['api_key', 'oauth_token', 'third_party', 'api_key_helper']) assert.throws(() => claudeIdentity({ ...value, authMethod }, '/profiles/a'), /subscription/);
  assert.throws(() => claudeIdentity({ ...value, configDirectory: '/profiles/b' }, '/profiles/a'), /expected config/);
  assert.throws(() => claudeIdentity({ ...value, email: null }, '/profiles/a'), /identity/);
  assert.equal(claudeIdentity({ ...value, configDirectory: 'C:\\Profiles\\A' }, 'c:\\profiles\\a', 'win32').display, 'a@fixture.test');
});
test('usage parser accepts real zero and scoped windows, excludes context/API estimates and unknown formats', () => {
  const meters = parseClaudeUsage('Current session\n ███ 35% used\nResets 4:00pm\n\nCurrent week (all models)\n0% used\n\nCurrent week (Sonnet only)\n70% used\nExtra usage\n$2 / $10');
  assert.deepEqual(meters.map(m => m.usedPercent), [35, 0, 70]); assert.ok(meters.every(m => m.resetsAt === null));
  assert.deepEqual(parseClaudeUsage('Context window\n35% used\nTokens 4000\nAPI credits 30%'), []);
  assert.deepEqual(parseClaudeUsage('Current session\n35% remaining'), []);
  assert.deepEqual(parseClaudeUsage('Current session\nLoading...\nCurrent week (all models)\n20% used').map(m => m.id), ['week-all']);
  assert.throws(() => parseClaudeUsage('Current session\n101% used'), /range/);
  assert.throws(() => parseClaudeUsage('Failed to load usage data\nCurrent session\n35% used'), /could not provide/);
});
test('probe invocation enables no model prompts, tools, MCP or user hooks', () => {
  const args = claudeProbeArguments();
  assert.equal(args[args.indexOf('--tools') + 1], ''); assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(args.includes('{"mcpServers":{}}')); assert.ok(args.includes('{"disableAllHooks":true,"remoteControlAtStartup":false}'));
  assert.ok(!args.includes('-p')); assert.ok(!args.includes('--dangerously-skip-permissions'));
});
test('real App Server subprocesses keep A/B values apart and catch later fixture-only changes', async t => {
  let now = 1800000000000;
  const { service, store } = await fixture(t, { now: () => now });
  const a = await profileFixture(store, 'openai', 'A', 'a@fixture.test', 15);
  const b = await profileFixture(store, 'openai', 'B', 'b@fixture.test', 75);
  const values = await Promise.all([service.check(a.id), service.check(b.id)]);
  assert.deepEqual(values.map(v => v.meters[0].usedPercent), [15, 75]);
  assert.ok(values.every(v => v.meters[0].windowMinutes === 300));
  now += 121000;
  await writeFile(path.join((await store.paths(b)).home, 'proof-fixture.json'), JSON.stringify({ email: 'b@fixture.test', used: 90 }));
  await service.check(b.id);
  const report = service.report();
  assert.deepEqual(report.profiles.map(p => p.last.meters[0].usedPercent), [15, 90]);
  assert.notEqual(report.profiles[0].identityGroup, report.profiles[1].identityGroup);
  assert.ok(!JSON.stringify(report).includes('@fixture.test')); assert.ok(!JSON.stringify(report).includes('NEVER_EXPORT_FIXTURE_TOKEN'));
  assert.equal(report.overallGate, 'pending real-account review');
});
test('account change during a read rejects the result and cannot bind a new identity', async t => {
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => fakeClient('a@fixture.test', 'b@fixture.test') });
  const a = await store.create('openai', 'A');
  await assert.rejects(service.check(a.id), error => error.code === 'identity-changed');
  assert.equal(a.identityBinding, null); assert.equal(service.report().profiles[0].last, null);
});
test('relabeling the ambient account as B is detectable, never auto-merged or called two real accounts', async t => {
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => fakeClient() });
  const a = await store.create('openai', 'A'), b = await store.create('openai', 'B');
  await service.check(a.id); await service.check(b.id);
  const report = service.report(); assert.equal(report.profiles.length, 2);
  assert.equal(report.profiles[0].identityGroup, report.profiles[1].identityGroup);
  assert.equal(report.checks.find(c => c.check === 'two-distinct-accounts').result, 'pending');
});
test('same-profile checks coalesce, cooldown cannot be bypassed, and failure retains dated quota', async t => {
  let now = 1800000000000, reads = 0;
  const { service, store } = await fixture(t, { now: () => now, version: async () => '0.0.1', makeClient: () => { reads++; return reads === 1 ? fakeClient() : fakeClient('changed@fixture.test'); } });
  const a = await store.create('openai', 'A');
  const first = service.check(a.id), second = service.check(a.id); assert.equal(first, second);
  const reading = await first;
  await assert.rejects(service.check(a.id), error => error.code === 'cooldown'); assert.equal(reads, 1);
  now += 121000;
  await assert.rejects(service.check(a.id), error => error.code === 'identity-changed');
  const p = service.report().profiles[0]; assert.deepEqual(p.last, reading); assert.equal(p.status, 'identity-changed');
});
test('restarting retains last reading age and account binding without claiming a fresh fetch', async t => {
  const { service, store, directory } = await fixture(t, { version: async () => '0.0.1', makeClient: () => fakeClient() });
  const a = await store.create('openai', 'A'); const value = await service.check(a.id);
  await service.close();
  const restarted = new AccountProof({ store: new ProofStore(directory) }); await restarted.load(); t.after(() => restarted.close());
  assert.equal(restarted.report().profiles[0].status, 'remembered');
  assert.equal(restarted.report().profiles[0].last.retrievedAt, value.retrievedAt);
  assert.equal(restarted.store.profiles[0].identityBinding, a.identityBinding);
});
test('manual evidence is explicit and export contains only aliases, scopes, times and user-reported outcomes', async t => {
  const { service } = await fixture(t);
  await service.observe('claude', 'ordinary-website-logout', 'pending');
  await assert.rejects(service.observe('claude', 'paste token here', 'secret'));
  const file = await service.exportReport(); const report = JSON.parse(await readFile(file));
  assert.equal(report.checks.find(c => c.provider === 'claude' && c.check === 'ordinary-website-logout').evidence, 'user-reported; not automatically verified');
  assert.ok(report.claudeProductGate.startsWith('blocked')); assert.equal(report.overallGate, 'pending real-account review');
});
test('Claude automated fresh-browser login fails closed unless the user explicitly selects the manual diagnostic', async t => {
  let calls = 0;
  const { service, store } = await fixture(t, { version: async () => '0.0.1', cli: async () => { calls++; return { code: 0 }; } });
  const a = await store.create('claude', 'A');
  await assert.rejects(service.login(a.id), error => error.code === 'login-unsupported'); assert.equal(calls, 0);
});
test('real Claude PTY sessions read only /usage for each isolated fixture profile', async t => {
  const { service, store } = await fixture(t);
  const a = await profileFixture(store, 'claude', 'A', 'a@fixture.test', 32);
  const b = await profileFixture(store, 'claude', 'B', 'b@fixture.test', 68);
  const first = await service.check(a.id), second = await service.check(b.id);
  assert.deepEqual([first.meters[0].usedPercent, second.meters[0].usedPercent], [32, 68]);
  assert.equal(first.meters[1].usedPercent, 0); assert.equal(first.providerObservedAt, null);
  assert.ok(!JSON.stringify(service.report()).includes('proof-fixture.json'));
});
test('CLI process failures and timeouts do not expose raw output', async () => {
  await assert.rejects(runCli('/definitely-missing/cli', ['auth', 'status']), /Could not start/);
  await assert.rejects(runCli(process.execPath, ['-e', 'process.stderr.write("NEVER_EXPORT_FIXTURE_TOKEN");setTimeout(()=>{},10000)'], { timeout: 30 }), error => /timed out/.test(error.message) && !error.message.includes('TOKEN'));
});

test('OpenAI login completion is scoped, supports early notifications, and cleans up listeners', async () => {
  const client = new EventEmitter(); const waiter = codexLoginWaiter(client);
  client.emit('notification', { method: 'account/login/completed', params: { loginId: 'other-login', success: false } });
  client.emit('notification', { method: 'account/login/completed', params: { loginId: 'our-login', success: true } });
  waiter.setId('our-login'); await waiter.promise; waiter.dispose();
  assert.equal(client.listenerCount('notification'), 0); assert.equal(client.listenerCount('stopped'), 0);
  const abort = new AbortController(); const cancelled = codexLoginWaiter(client, abort.signal);
  abort.abort(); await assert.rejects(cancelled.promise, error => error.code === 'cancelled'); cancelled.dispose();
});
test('each OpenAI login uses a new browser directory, never returns its auth URL, and disallows simultaneous sign-ins', async t => {
  const launched = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  let current;
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => {
    const client = fakeClient(); const request = client.request;
    client.request = async method => method === 'account/login/start' ? { loginId: 'our-login', authUrl: 'https://auth.openai.com/authorize?state=NEVER_EXPORT_AUTH_STATE' } : request(method);
    current = client; return client;
  }, launchBrowser: async value => { launched.push(value.directory); await gate; current.emit('notification', { method: 'account/login/completed', params: { loginId: 'our-login', success: true } }); } });
  const p = await store.create('openai', 'A'); const login = service.login(p.id);
  await assert.rejects(service.login(p.id), /current operation/); release();
  const first = await login; const second = await service.login(p.id);
  assert.notEqual(launched[0], launched[1]); assert.ok(first.meters.length && second.meters.length);
  assert.ok(!JSON.stringify(service.report()).includes('NEVER_EXPORT_AUTH_STATE'));
});
test('shutdown aborts first-party login and rejects late results before releasing the profile lock', async t => {
  let launched;
  const started = new Promise(resolve => { launched = resolve; });
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => {
    const client = fakeClient();
    client.request = async method => method === 'account/login/start' ? { loginId: 'pending', authUrl: 'https://auth.openai.com/authorize?state=fictional' } : {};
    return client;
  }, launchBrowser: async () => { launched(); } });
  const p = await store.create('openai', 'A'); const login = service.login(p.id); const rejected = assert.rejects(login);
  await started; await service.close(); await rejected;
  assert.equal(service.report().profiles[0].last, null); assert.equal(service.clients.size, 0);
});
test('CLI cancellation kills the owned process and uses a sanitized error', async () => {
  const abort = new AbortController();
  const running = runCli(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { signal: abort.signal });
  abort.abort(); await assert.rejects(running, /cancelled/);
});
test('an empty upstream quota response preserves the previous dated reading', async t => {
  let now = 1800000000000, empty = false;
  const { service, store } = await fixture(t, { now: () => now, version: async () => '0.0.1', makeClient: () => {
    const client = fakeClient(); const request = client.request;
    client.request = async method => method === 'account/rateLimits/read' && empty ? {} : request(method);
    return client;
  } });
  const a = await store.create('openai', 'A'); const reading = await service.check(a.id);
  now += 121000; empty = true; await service.check(a.id);
  assert.deepEqual(service.report().profiles[0].last, reading);
  assert.equal(service.report().profiles[0].status, 'quota-unavailable');
});
test('logout is profile scoped, acknowledged by the official CLI and preserves last readings', async t => {
  let logoutCalls = 0, failLogout = true;
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => {
    const client = fakeClient(); const request = client.request;
    client.request = async method => {
      if (method !== 'account/logout') return request(method);
      logoutCalls++; if (failLogout) throw new Error('NEVER_EXPORT_FIXTURE_TOKEN'); return {};
    }; return client;
  } });
  const a = await store.create('openai', 'A'); const reading = await service.check(a.id);
  await assert.rejects(service.logout(a.id)); assert.ok(store.get(a.id).identityBinding);
  failLogout = false; await service.logout(a.id);
  assert.equal(logoutCalls, 2); assert.deepEqual(service.report().profiles[0].last, reading);
  assert.equal(service.report().profiles[0].status, 'needs-sign-in');
});
test('persisted evidence and cooldown survive restart without a provider request', async t => {
  const { service, store, directory } = await fixture(t, { version: async () => '0.0.1', makeClient: () => fakeClient() });
  const a = await store.create('openai', 'A'); await service.check(a.id);
  await service.observe('openai', 'provider-values-match', 'fail'); await service.close();
  const restarted = new AccountProof({ store: new ProofStore(directory) }); await restarted.load();
  try {
    assert.equal(restarted.report().checks.find(c => c.provider === 'openai' && c.check === 'provider-values-match').result, 'fail');
    await assert.rejects(restarted.check(a.id), error => error.code === 'cooldown');
    assert.equal(restarted.report().versions.openai, '0.0.1');
  } finally { await restarted.close(); }
});
test('real PTY onboarding prompts are rejected without automatically accepting trust', async t => {
  const { service, store } = await fixture(t);
  const a = await profileFixture(store, 'claude', 'A', 'a@fixture.test', 32);
  const context = await service.context(a);
  await writeFile(path.join(context.home, 'proof-fixture.json'), JSON.stringify({ email: 'a@fixture.test', used: 32, mode: 'onboarding' }));
  await assert.rejects(probeClaudeUsage({ ...context, timeout: 5000 }), error => error.code === 'needs-setup');
});
test('real PTY unknown panels time out without converting context percentages into quotas', async t => {
  const { service, store } = await fixture(t);
  const a = await profileFixture(store, 'claude', 'A', 'a@fixture.test', 32);
  const context = await service.context(a);
  await writeFile(path.join(context.home, 'proof-fixture.json'), JSON.stringify({ email: 'a@fixture.test', used: 32, mode: 'unknown-panel' }));
  await assert.rejects(probeClaudeUsage({ ...context, timeout: 2000 }), error => error.code === 'unsupported-panel' && !error.message.includes('NEVER_EXPORT'));
});
test('auth generation change while a read is in flight cannot install a stale result', async t => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const begun = new Promise(resolve => { started = resolve; });
  const { service, store } = await fixture(t, { version: async () => '0.0.1', makeClient: () => {
    const client = fakeClient(); const request = client.request;
    client.request = async method => { if (method === 'account/rateLimits/read') { started(); await gate; } return request(method); };
    return client;
  } });
  const a = await store.create('openai', 'A'); const task = service.check(a.id);
  const rejected = assert.rejects(task, error => error.code === 'identity-changed');
  await begun; a.generation++; release(); await rejected;
  assert.equal(service.report().profiles[0].last, null);
});
test('a terminal result waits for asynchronous exit acknowledgment rather than only calling kill', async () => {
  let onExit, killed = false, resolved = false; const control = [];
  const child = { onExit: listener => { onExit = listener; return { dispose() {} }; }, write: value => control.push(value), kill() { killed = true; } };
  const stopping = stopProbeTerminal(child, false, 1000).then(value => { resolved = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(control[0], '\x03'); assert.equal(killed, false); assert.equal(resolved, false);
  onExit(); assert.equal(await stopping, true);
});
test('unconfirmed terminal shutdown rejects successful-looking results and retains the recovery lock', async t => {
  const { service, store, directory } = await fixture(t, { version: async () => '0.0.1',
    claudeIdentity: async () => ({ binding: 'fictional-account', display: 'A', confidence: 'fixture', plan: null }),
    claudeUsage: async () => { const error = new Error('stop unconfirmed'); error.code = 'terminal-stop-unconfirmed'; throw error; } });
  const a = await store.create('claude', 'A'); await assert.rejects(service.check(a.id));
  await service.close();
  assert.ok((await readFile(path.join(directory, 'proof.lock'), 'utf8')).length);
  await assert.rejects(new ProofStore(directory).load(), /already running/);
  assert.equal(service.report().profiles[0].last, null);
});
