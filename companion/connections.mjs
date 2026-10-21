import { EventEmitter } from 'node:events';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppServer } from './app-server.mjs';
import { parseLimits } from './limits.mjs';
import { openAuthBrowser } from './auth-browser.mjs';
import { safeAuthUrl } from './protocol.mjs';
import { profileEnvironment } from './proof/runtime.mjs';
import { atomicJson, privateDirectory, uuid } from './proof/store.mjs';
import { codexLoginWaiter } from './proof/codex-login.mjs';

export const capabilities = { protocol: 2, version: '3.1.0-preview', providers: [
  { provider: 'openai', available: true, scope: 'work-codex', isolatedLogin: true, activeRefresh: true, liveVerified: false, reason: 'Live account, cross-device, logout and renewal checks are pending.' },
  { provider: 'claude', available: false, scope: 'subscription', isolatedLogin: false, activeRefresh: false, liveVerified: false, reason: 'Separate automatic browser sign-in, fresh quota checks and permitted monitoring need validation. Website tracking is available.' },
] };
const aliases = value => typeof value === 'string' && value.length <= 60 && !/[\x00-\x1f\x7f]/.test(value);
const time = value => Number.isFinite(value) && value >= 0 && value <= 8.64e15;
const failure = code => Object.assign(new Error('Account action could not complete. Credentials and dated readings were retained.'), { code });
function identity(info) {
  const a = info?.account;
  if (a?.type !== 'chatgpt' || typeof a.email !== 'string' || a.email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(a.email)) throw failure('needs-sign-in');
  return { binding: a.email.trim().toLowerCase(), display: a.email,
    plan: typeof a.planType === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(a.planType) ? a.planType : null };
}
const empty = id => ({ id, provider: 'openai', alias: '', generation: 0, binding: null,
  authState: 'needs-sign-in', plan: null, updatedAt: 0, meters: [], lastAttemptAt: null,
  providerObservedAt: null, nextRetryAt: null, failures: 0, errorCode: null, status: 'signed-out' });
function savedProfile(p) {
  if (!uuid(p?.id) || p.provider !== 'openai' || !aliases(p.alias) || !Number.isSafeInteger(p.generation) || p.generation < 0 ||
    p.binding !== null && !/^[a-f0-9]{64}$/.test(p.binding) || !time(p.updatedAt) ||
    p.lastAttemptAt !== null && !time(p.lastAttemptAt) || p.nextRetryAt !== null && !time(p.nextRetryAt) ||
    !Number.isSafeInteger(p.failures) || p.failures < 0 || !Array.isArray(p.meters) || p.meters.length > 30) throw failure('invalid-cache');
  // Re-normalize persisted meters with the same allowlist as upstream responses.
  const meters = p.meters.map(m => {
    if (!m || !/^[a-zA-Z0-9_-]{1,70}-(primary|secondary)$/.test(m.id) || typeof m.label !== 'string' || m.label.length > 120 ||
      m.scope !== 'work-codex' || typeof m.usedPercent !== 'number' || !Number.isFinite(m.usedPercent) || m.usedPercent < 0 || m.usedPercent > 1000 ||
      m.resetsAt !== null && !time(m.resetsAt)) throw failure('invalid-cache');
    return { id: m.id, label: m.label, scope: 'work-codex', evidence: 'reported', usedPercent: m.usedPercent,
      used: null, total: null, unit: 'percent', resetsAt: m.resetsAt, source: 'OpenAI Codex App Server · account/rateLimits/read' };
  });
  return { ...empty(p.id), alias: p.alias, generation: p.generation, binding: p.binding, plan: typeof p.plan === 'string' && /^[\w-]{1,80}$/.test(p.plan) ? p.plan : null,
    updatedAt: p.updatedAt, meters, lastAttemptAt: p.lastAttemptAt, nextRetryAt: p.nextRetryAt, failures: p.failures,
    // Restart never makes old readings current. Explicit logout stays signed out.
    authState: p.authState === 'disconnected' ? 'disconnected' : p.authState === 'needs-sign-in' ? 'needs-sign-in' : 'unavailable',
    status: ['disconnected', 'needs-sign-in'].includes(p.authState) ? 'signed-out' : 'unavailable' };
}

export class Connections extends EventEmitter {
  constructor({ directory, executable = 'codex', makeClient = options => new AppServer(options), now = Date.now, launchAuth = openAuthBrowser }) {
    super(); Object.assign(this, { directory, executable, makeClient, now, launchAuth });
    this.profiles = new Map(); this.operations = new Map(); this.logins = new Map(); this.clients = new Set();
    this.saving = Promise.resolve(); this.indexSaving = Promise.resolve(); this.slots = []; this.running = 0; this.stopping = false;
  }
  async load() {
    await privateDirectory(this.directory);
    const file = path.join(this.directory, 'connections-v2.json');
    try {
      const text = await readFile(file, 'utf8');
      if (Buffer.byteLength(text) > 512 * 1024) throw failure('invalid-cache');
      const state = JSON.parse(text);
      if (state.version !== 2 || !uuid(state.salt) || !Array.isArray(state.profiles) || state.profiles.length > 20) throw failure('invalid-cache');
      this.salt = state.salt;
      for (const p of state.profiles) { const profile = savedProfile(p); if (this.profiles.has(profile.id)) throw failure('invalid-cache'); this.profiles.set(profile.id, profile); }
    } catch (error) {
      if (error.code !== 'ENOENT') throw failure('invalid-cache');
      let ids = [];
      try { ids = JSON.parse(await readFile(path.join(this.directory, 'profiles.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw failure('invalid-cache'); }
      if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length) throw failure('invalid-cache');
      this.salt = randomUUID();
      for (const id of ids) this.profiles.set(id, { ...empty(id), authState: 'unavailable', status: 'unavailable' });
      await this.save(); // Existing accounts/<uuid> directories and extension IDs stay untouched.
    }
  }
  save() {
    const payload = { version: 2, salt: this.salt, profiles: [...this.profiles.values()].map(p => ({
      id: p.id, provider: p.provider, alias: p.alias, generation: p.generation, binding: p.binding,
      authState: p.authState, plan: p.plan, updatedAt: p.updatedAt, meters: p.meters,
      lastAttemptAt: p.lastAttemptAt, nextRetryAt: p.nextRetryAt, failures: p.failures,
    })) };
    this.saving = this.saving.catch(() => {}).then(() => atomicJson(path.join(this.directory, 'connections-v2.json'), payload));
    return this.saving;
  }
  async changed() { await this.save(); if (!this.stopping) this.emit('snapshot', this.snapshot()); }
  duplicate(p) { return !!p.binding && [...this.profiles.values()].some(other => other.id !== p.id && other.binding === p.binding && other.authState !== 'disconnected'); }
  snapshot() {
    return { type: 'snapshot', protocol: 2, profiles: [...this.profiles.values()].map(p => ({
      id: p.id, provider: p.provider, alias: p.alias, status: p.status, authState: p.authState,
      plan: p.plan, updatedAt: p.updatedAt, meters: p.meters.map(m => ({ ...m })),
      displayIdentity: p.displayIdentity ?? null, identityConfidence: p.binding ? 'email-only' : 'unverified',
      providerSubject: null, workspaceIdentity: null, capability: 'work-codex',
      lastAttemptAt: p.lastAttemptAt, providerObservedAt: null, nextRetryAt: p.nextRetryAt,
      failures: p.failures, errorCode: p.errorCode, possibleDuplicate: this.duplicate(p),
    })) };
  }
  get(id) { const p = this.profiles.get(id); if (!p) throw failure('unknown-profile'); return p; }
  hash(value) { return createHmac('sha256', this.salt).update('openai\0').update(value).digest('hex'); }
  verify(p, before, after, generation) {
    if (this.stopping || p.generation !== generation || this.hash(before.binding) !== this.hash(after.binding) || p.binding && p.binding !== this.hash(after.binding)) throw failure('identity-changed');
  }
  serial(id, task) {
    const prior = this.operations.get(id) ?? Promise.resolve();
    const work = prior.catch(() => {}).then(async () => {
      if (this.stopping || this.requiresRecovery) throw failure('service-unavailable');
      // At most two owned provider processes, even across separate profiles.
      if (this.running >= 2) await new Promise(resolve => this.slots.push(resolve));
      else this.running++;
      try { if (this.stopping || this.requiresRecovery) throw failure('service-unavailable'); return await task(); }
      finally { const next = this.slots.shift(); if (next) next(); else this.running--; }
    });
    this.operations.set(id, work);
    void work.finally(() => { if (this.operations.get(id) === work) this.operations.delete(id); }).catch(() => {});
    return work;
  }
  async withClient(p, task) {
    const home = path.join(this.directory, 'accounts', p.id);
    await privateDirectory(path.join(this.directory, 'accounts')); await privateDirectory(home);
    await writeFile(path.join(home, 'config.toml'), 'cli_auth_credentials_store = "auto"\n', { mode: 0o600 });
    const client = this.makeClient({ executable: this.executable, home, environment: profileEnvironment('openai', home) });
    this.clients.add(client);
    try { await client.ready; return await task(client); }
    finally {
      const child = client.child; let timer;
      const stopped = child?.pid && child.exitCode === null && !child.signalCode
        ? new Promise(resolve => { child.once('exit', () => resolve(true)); timer = setTimeout(() => resolve(false), 5000); }) : Promise.resolve(true);
      client.close(); const confirmed = await stopped; clearTimeout(timer); this.clients.delete(client);
      if (!confirmed) { this.requiresRecovery = true; throw failure('shutdown-unconfirmed'); }
    }
  }
  async add(provider = 'openai', alias = '') {
    if (provider !== 'openai') throw failure('provider-unavailable');
    if (!aliases(alias) || this.profiles.size >= 20 || this.stopping) throw failure('invalid-request');
    const p = { ...empty(randomUUID()), alias };
    this.profiles.set(p.id, p); await this.changed();
    this.beginLogin(p.id); return { profile: p.id, started: true };
  }
  beginLogin(id) {
    const p = this.get(id);
    if (this.logins.has(id) || this.operations.has(id)) throw failure('busy');
    if (p.nextRetryAt && p.nextRetryAt > this.now()) throw failure('cooldown');
    const abort = new AbortController();
    const entry = { abort, task: null }; this.logins.set(id, entry);
    const task = this.serial(id, async () => {
      const generation = ++p.generation; p.authState = 'signing-in'; p.status = 'unavailable'; p.errorCode = null;
      // Auth retries cannot be used as a quota-refresh bypass.
      p.nextRetryAt = this.now() + 120_000; await this.changed();
      try {
        await this.withClient(p, async client => {
          let loginId; const waiter = codexLoginWaiter(client, abort.signal);
          try {
            if (abort.signal.aborted) throw failure('cancelled');
            const login = await client.request('account/login/start', { type: 'chatgpt' });
            if (!safeAuthUrl(login?.authUrl) || typeof login.loginId !== 'string') throw failure('login-failed');
            loginId = login.loginId; waiter.setId(loginId);
            if (abort.signal.aborted) throw failure('cancelled');
            await this.launchAuth({ directory: path.join(this.directory, 'accounts', id, 'sign-in-browser', `attempt-${generation}`), url: login.authUrl });
            await waiter.promise;
            if (abort.signal.aborted) throw failure('cancelled');
            p.authState = 'verifying'; await this.changed();
            const who = identity(await client.request('account/read', { refreshToken: false }));
            this.verify(p, who, who, generation);
            // Bind only after first-party completion, never from a nickname.
            p.binding = this.hash(who.binding); p.displayIdentity = who.display; p.plan = who.plan;
            if (this.duplicate(p)) { p.authState = 'duplicate'; p.errorCode = 'possible-duplicate'; p.status = 'unavailable'; return; }
            await this.read(p, client, generation, abort.signal);
          } catch (error) {
            if (loginId) await client.request('account/login/cancel', { loginId }).catch(() => {});
            throw error;
          } finally { waiter.dispose(); }
        });
      } catch (error) { this.setFailure(p, abort.signal.aborted ? failure('cancelled') : error); }
      await this.changed();
    });
    entry.task = task;
    void task.finally(() => { if (this.logins.get(id) === entry) this.logins.delete(id); }).catch(() => {});
    return { profile: id, started: true };
  }
  async cancel(id) {
    const p = this.get(id), login = this.logins.get(id);
    if (login) { login.abort.abort(); await login.task; }
    return { profile: p.id, cancelled: true };
  }
  setFailure(p, error) {
    const codes = ['needs-sign-in', 'identity-changed', 'cancelled', 'login-failed', 'shutdown-unconfirmed', 'throttled'];
    p.errorCode = codes.includes(error?.code) ? error.code : 'unavailable';
    p.authState = ['needs-sign-in', 'identity-changed', 'cancelled', 'login-failed'].includes(p.errorCode) ? 'needs-sign-in' : 'unavailable';
    p.status = p.authState === 'needs-sign-in' ? 'signed-out' : 'unavailable'; p.failures++;
    const backoff = this.now() + Math.min(30 * 60_000, 120_000 * 2 ** Math.min(p.failures - 1, 5));
    p.nextRetryAt = Math.max(backoff, time(error?.retryAt) ? error.retryAt : 0, p.nextRetryAt ?? 0);
  }
  async read(p, client, generation, signal) {
    p.lastAttemptAt = this.now();
    // Persist throttle reservation before the provider request, including crashes.
    p.nextRetryAt = this.now() + 120_000; await this.changed();
    const before = identity(await client.request('account/read', { refreshToken: false }));
    this.verify(p, before, before, generation);
    const result = await client.request('account/rateLimits/read');
    const after = identity(await client.request('account/read', { refreshToken: false }));
    this.verify(p, before, after, generation);
    if (signal?.aborted) throw failure('cancelled');
    p.binding = this.hash(after.binding); p.displayIdentity = after.display; p.plan = after.plan;
    if (this.duplicate(p)) { p.authState = 'duplicate'; p.status = 'unavailable'; p.errorCode = 'possible-duplicate'; return; }
    const meters = parseLimits(result);
    p.authState = 'connected'; p.status = meters.length ? 'active' : 'unavailable';
    p.errorCode = meters.length ? null : 'quota-unavailable'; p.failures = 0;
    if (meters.length) { p.meters = meters; p.updatedAt = this.now(); }
    // Absent quotas retain old values and timestamps; no inferred observation time.
  }
  refresh(id) {
    const p = this.get(id);
    if (this.operations.has(id) || this.logins.has(id) || p.authState === 'disconnected' || p.authState === 'needs-sign-in' || p.authState === 'duplicate' || (p.nextRetryAt ?? 0) > this.now()) return Promise.resolve();
    return this.serial(id, async () => {
      if ((p.nextRetryAt ?? 0) > this.now() || p.authState === 'disconnected') return;
      try { await this.withClient(p, client => this.read(p, client, p.generation)); }
      catch (error) { this.setFailure(p, error); }
      await this.changed();
    });
  }
  async refreshAll() { await Promise.allSettled([...this.profiles.keys()].map(id => this.refresh(id))); }
  async rename(id, alias) { if (!aliases(alias)) throw failure('invalid-request'); this.get(id).alias = alias; await this.changed(); return {}; }
  async disconnect(id) {
    await this.cancel(id);
    return this.serial(id, async () => {
      const p = this.get(id); if (p.authState === 'disconnected') return {};
      const generation = ++p.generation; await this.save();
      try {
        await this.withClient(p, async client => {
          // A revoked/expired authorization may already be signed out. Official
          // logout can still clear this profile; never revoke a different identity.
          const raw = await client.request('account/read', { refreshToken: false });
          if (raw?.account) { const who = identity(raw); this.verify(p, who, who, generation); }
          await client.request('account/logout');
        });
        p.authState = 'disconnected'; p.status = 'signed-out'; p.displayIdentity = null; p.errorCode = null;
        await this.changed(); return {};
      } catch (error) { this.setFailure(p, error); await this.changed(); throw failure('logout-unconfirmed'); }
    });
  }
  async handle(request) {
    switch (request.method) {
      case 'capabilities': return structuredClone(capabilities);
      case 'status': case 'list': return this.snapshot();
      case 'add': case 'start': return this.add(request.provider ?? 'openai', request.alias ?? '');
      case 'cancel': return this.cancel(request.profile);
      case 'reconnect': return this.beginLogin(request.profile);
      case 'rename': return this.rename(request.profile, request.alias);
      case 'disconnect': return this.disconnect(request.profile);
      case 'remove': await this.disconnect(request.profile); this.profiles.delete(request.profile); await this.changed(); return {};
      case 'refresh': if (request.profile) void this.refresh(request.profile).catch(() => {}); else void this.refreshAll(); return this.snapshot();
      default: throw failure('invalid-request');
    }
  }
  async close() {
    this.stopping = true; for (const login of this.logins.values()) login.abort.abort();
    for (const client of this.clients) client.close();
    await Promise.allSettled([...this.operations.values()]); await this.saving;
  }
}
