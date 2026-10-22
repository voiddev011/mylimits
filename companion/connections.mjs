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
import { createClaudeAdapter } from './claude-adapter.mjs';
import { codexLoginWaiter } from './proof/codex-login.mjs';

export const capabilities = { protocol: 2, version: '3.4.0-preview', identityConfirmation: true, providers: [
  { provider: 'openai', available: true, scope: 'work-codex', isolatedLogin: true, activeRefresh: true, liveVerified: false, reason: 'Live account, cross-device, logout and renewal checks are pending.' },
  { provider: 'claude', available: true, scope: 'subscription', isolatedLogin: true, activeRefresh: true, liveVerified: false, reason: 'Experimental official Claude Code adapter. Account freshness/logout/renewal require manual acceptance; publication review remains separate.' },
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
const empty = (id, provider = 'openai') => ({ id, provider, alias: '', generation: 0, binding: null, confirmed: false,
  authState: 'needs-sign-in', plan: null, updatedAt: 0, meters: [], lastAttemptAt: null,
  providerObservedAt: null, nextRetryAt: null, failures: 0, errorCode: null, status: 'signed-out' });
function savedProfile(p) {
  if (!uuid(p?.id) || !['openai','claude'].includes(p.provider) || !aliases(p.alias) || !Number.isSafeInteger(p.generation) || p.generation < 0 ||
    p.binding !== null && !/^[a-f0-9]{64}$/.test(p.binding) || !time(p.updatedAt) ||
    p.lastAttemptAt !== null && !time(p.lastAttemptAt) || p.nextRetryAt !== null && !time(p.nextRetryAt) ||
    !Number.isSafeInteger(p.failures) || p.failures < 0 || !Array.isArray(p.meters) || p.meters.length > 30 ||
    p.confirmed !== undefined && typeof p.confirmed !== 'boolean' ||
    p.displayIdentity != null && (typeof p.displayIdentity !== 'string' || p.displayIdentity.length > 254 || /[\x00-\x1f\x7f]/.test(p.displayIdentity))) throw failure('invalid-cache');
  // Re-normalize persisted meters with the same allowlist as upstream responses.
  const meters = p.meters.map(m => {
    if (!m || !(p.provider === 'openai' ? /^[a-zA-Z0-9_-]{1,70}-(primary|secondary)$/.test(m.id) : ['session','week-all','week-sonnet','week-opus'].includes(m.id)) || typeof m.label !== 'string' || m.label.length > 120 ||
      m.scope !== (p.provider === 'openai' ? 'work-codex' : 'subscription') || typeof m.usedPercent !== 'number' || !Number.isFinite(m.usedPercent) || m.usedPercent < 0 || m.usedPercent > 1000 ||
      m.resetsAt !== null && !time(m.resetsAt)) throw failure('invalid-cache');
    return { id: m.id, label: m.label, scope: m.scope, evidence: 'reported', usedPercent: m.usedPercent,
      used: null, total: null, unit: 'percent', resetsAt: m.resetsAt, source: p.provider === 'openai' ? 'OpenAI Codex App Server · account/rateLimits/read' : 'Claude Code · /usage panel' };
  });
  return { ...empty(p.id,p.provider), alias: p.alias, generation: p.generation, binding: p.binding, plan: typeof p.plan === 'string' && /^[\w-]{1,80}$/.test(p.plan) ? p.plan : null,
    updatedAt: p.updatedAt, meters, lastAttemptAt: p.lastAttemptAt, nextRetryAt: p.nextRetryAt, failures: p.failures,
    // Restart never makes old readings current. Explicit logout stays signed out.
    authState: p.authState === 'awaiting-confirmation' && p.confirmed === false ? 'awaiting-confirmation' : p.authState === 'disconnected' ? 'disconnected' : p.authState === 'needs-sign-in' ? 'needs-sign-in' : 'unavailable',
    confirmed: typeof p.confirmed === 'boolean' ? p.confirmed : true,
    displayIdentity: typeof p.displayIdentity === 'string' && p.displayIdentity.length <= 254 ? p.displayIdentity : null,
    identityConfidence: p.identityConfidence==='email-and-organization'?'email-and-organization':'email-only', workspaceIdentity: typeof p.workspaceIdentity==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.workspaceIdentity)?p.workspaceIdentity:null,
    status: ['disconnected', 'needs-sign-in'].includes(p.authState) ? 'signed-out' : 'unavailable' };
}

export class Connections extends EventEmitter {
  constructor({ directory, executable = 'codex', makeClient = options => new AppServer(options), now = Date.now, launchAuth = openAuthBrowser, claudeAdapter = createClaudeAdapter() }) {
    super(); Object.assign(this, { directory, executable, makeClient, now, launchAuth, claudeAdapter });
    this.profiles = new Map(); this.operations = new Map(); this.logins = new Map(); this.clients = new Set(); this.providerAborts = new Map();
    this.saving = Promise.resolve(); this.indexSaving = Promise.resolve(); this.slots = []; this.running = 0; this.stopping = false;
  }
  async load() {
    await privateDirectory(this.directory);
    const file = path.join(this.directory, 'connections-v2.json');
    try {
      const text = await readFile(file, 'utf8');
      if (Buffer.byteLength(text) > 512 * 1024) throw failure('invalid-cache');
      const state = JSON.parse(text);
      if (state.version !== 2 || state.revision !== undefined && state.revision !== 1 || !uuid(state.salt) || !Array.isArray(state.profiles) || state.profiles.length > 20) throw failure('invalid-cache');
      this.salt = state.salt;
      for (const p of state.profiles) { const profile = savedProfile(p); if (this.profiles.has(profile.id)) throw failure('invalid-cache'); this.profiles.set(profile.id, profile); }
      if (state.revision === undefined) {
        // Metadata-only backup; never copy/open first-party credential stores.
        try { await writeFile(path.join(this.directory,'connections-pre-desktop.json'),text,{flag:'wx',mode:0o600}); }
        catch (error) { if(error.code!=='EEXIST')throw error; }
        await this.save();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw failure('invalid-cache');
      let ids = [];
      try { ids = JSON.parse(await readFile(path.join(this.directory, 'profiles.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw failure('invalid-cache'); }
      if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length) throw failure('invalid-cache');
      this.salt = randomUUID();
      for (const id of ids) this.profiles.set(id, { ...empty(id), confirmed: true, authState: 'unavailable', status: 'unavailable' });
      await this.save(); // Existing accounts/<uuid> directories and extension IDs stay untouched.
    }
  }
  save() {
    const payload = { version: 2, revision: 1, salt: this.salt, profiles: [...this.profiles.values()].map(p => ({
      id: p.id, provider: p.provider, alias: p.alias, generation: p.generation, binding: p.binding,
      confirmed: p.confirmed, displayIdentity: p.displayIdentity ?? null,
      authState: p.authState, plan: p.plan, updatedAt: p.updatedAt, meters: p.meters,
      lastAttemptAt: p.lastAttemptAt, nextRetryAt: p.nextRetryAt, failures: p.failures,
      identityConfidence:p.identityConfidence??null, workspaceIdentity:p.workspaceIdentity??null,
    })) };
    this.saving = this.saving.catch(() => {}).then(() => atomicJson(path.join(this.directory, 'connections-v2.json'), payload));
    return this.saving;
  }
  async changed() { await this.save(); if (!this.stopping) this.emit('snapshot', this.snapshot()); }
  duplicate(p) { return !!p.binding && [...this.profiles.values()].some(other => other.id !== p.id && other.binding === p.binding && other.authState !== 'disconnected'); }
  snapshot() {
    return { type: 'snapshot', protocol: 2, profiles: [...this.profiles.values()].map(p => ({
      id: p.id, provider: p.provider, alias: p.alias, status: p.status, authState: p.authState,
      authorizationGeneration: p.generation,
      plan: p.plan, updatedAt: p.updatedAt, meters: p.meters.map(m => ({ ...m })),
      displayIdentity: p.displayIdentity ?? null, identityConfidence: p.binding ? p.identityConfidence ?? 'email-only' : 'unverified',
      providerSubject: null, workspaceIdentity: p.workspaceIdentity ?? null, capability: p.provider === 'openai' ? 'work-codex' : 'subscription',
      lastAttemptAt: p.lastAttemptAt, providerObservedAt: null, nextRetryAt: p.nextRetryAt,
      failures: p.failures, errorCode: p.errorCode, possibleDuplicate: this.duplicate(p),
    })) };
  }
  get(id) { const p = this.profiles.get(id); if (!p) throw failure('unknown-profile'); return p; }
  hash(value, provider = 'openai') { return createHmac('sha256', this.salt).update(provider + '\0').update(value).digest('hex'); }
  verify(p, before, after, generation) {
    if (this.stopping || p.generation !== generation || this.hash(before.binding,p.provider) !== this.hash(after.binding,p.provider) || p.binding && p.binding !== this.hash(after.binding,p.provider)) throw failure('identity-changed');
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
    try { await writeFile(path.join(home, 'config.toml'), 'cli_auth_credentials_store = "auto"\n', { flag:'wx',mode:0o600 }); }
    catch (error) { if(error.code!=='EEXIST')throw error; }
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
  interval(p) { return p.provider === 'claude' ? 300_000 : 120_000; }
  captureIdentity(p,who) {
    p.binding=this.hash(who.binding,p.provider);p.displayIdentity=who.display;p.plan=who.plan;
    p.identityConfidence=who.confidence==='email-and-organization'?'email-and-organization':'email-only';
    p.workspaceIdentity=who.organizationId??null;
  }
  async withClaude(p,task,signal) {
    const abort=new AbortController();this.providerAborts.set(p.id,abort);
    const cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted||this.stopping)abort.abort();
    try {
      const context=await this.claudeAdapter.context(path.join(this.directory,'accounts',p.id),p.generation,abort.signal);
      return await task(context);
    } finally {signal?.removeEventListener('abort',cancel);this.providerAborts.delete(p.id);}
  }
  async readClaude(p,context,generation) {
    p.lastAttemptAt=this.now();p.nextRetryAt=this.now()+this.interval(p);await this.changed();
    const before=await this.claudeAdapter.identity(context);this.verify(p,before,before,generation);
    const result=await this.claudeAdapter.usage(context);
    const after=await this.claudeAdapter.identity(context);this.verify(p,before,after,generation);
    if(context.signal?.aborted)throw failure('cancelled');this.captureIdentity(p,after);
    if(this.duplicate(p)){p.authState='duplicate';p.errorCode='possible-duplicate';p.status='unavailable';return;}
    if(!Array.isArray(result?.meters)||result.meters.length>30)throw failure('unsupported-format');
    const meters=result.meters.map(m=>{
      if(!['session','week-all','week-sonnet','week-opus'].includes(m.id)||typeof m.label!=='string'||m.label.length>120||typeof m.usedPercent!=='number'||!Number.isFinite(m.usedPercent)||m.usedPercent<0||m.usedPercent>100)throw failure('unsupported-format');
      return {id:m.id,label:m.label,scope:'subscription',evidence:'reported',usedPercent:m.usedPercent,used:null,total:null,unit:'percent',resetsAt:time(m.resetsAt)&&m.resetsAt>0?m.resetsAt:null,source:'Claude Code · /usage panel'};
    });
    p.authState='connected';p.status=meters.length?'active':'unavailable';p.errorCode=meters.length?null:'quota-unavailable';p.failures=0;
    if(meters.length){p.meters=meters;p.updatedAt=this.now();}
  }
  setup(id) {
    const p=this.get(id);if(p.provider!=='claude'||p.authState!=='needs-setup')throw failure('invalid-request');
    if(this.operations.has(id))throw failure('busy');
    void this.serial(id,async()=>{
      try{p.errorCode='setup-open';await this.changed();await this.withClaude(p,context=>this.claudeAdapter.onboarding(context));
        // A setup window is not a successful reading. The next eligible check
        // still respects the existing provider cooldown.
        p.authState='unavailable';p.errorCode=null;
      }catch(error){this.setFailure(p,error);}await this.changed();
    }).catch(()=>{});
    return {profile:id,started:true};
  }
  async add(provider = 'openai', alias = '') {
    if (!['openai','claude'].includes(provider)) throw failure('provider-unavailable');
    if (provider === 'claude' && !(await this.claudeAdapter.readiness()).available) throw failure('provider-unavailable');
    if (!aliases(alias) || this.profiles.size >= 20 || this.stopping) throw failure('invalid-request');
    const p = { ...empty(randomUUID(),provider), alias };
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
      p.nextRetryAt = this.now() + this.interval(p); await this.changed();
      try {
        if (p.provider === 'claude') {
          await this.withClaude(p, async context => {
            await this.claudeAdapter.login(context);
            if(abort.signal.aborted) throw failure('cancelled');
            p.authState='verifying'; await this.changed();
            const who=await this.claudeAdapter.identity(context); this.verify(p,who,who,generation); this.captureIdentity(p,who);
            if(this.duplicate(p)){p.authState='duplicate';p.errorCode='possible-duplicate';p.status='unavailable';return;}
            if (!p.confirmed) { p.authState='awaiting-confirmation'; return; }
            await this.readClaude(p,context,generation);
          },abort.signal);
        } else await this.withClient(p, async client => {
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
            this.captureIdentity(p, who);
            if (this.duplicate(p)) { p.authState = 'duplicate'; p.errorCode = 'possible-duplicate'; p.status = 'unavailable'; return; }
            if (!p.confirmed) { p.authState = 'awaiting-confirmation'; return; }
            await this.read(p, client, generation, abort.signal);
          } catch (error) {
            if (loginId) await client.request('account/login/cancel', { loginId }).catch(() => {});
            throw error;
          } finally { waiter.dispose(); }
        });
      } catch (error) {
        // Cancellation must not downgrade an unconfirmed shutdown into an
        // ordinary signed-out state and release the service for more writers.
        const shutdownFailed = ['shutdown-unconfirmed','terminal-stop-unconfirmed'].includes(error?.code);
        this.setFailure(p, shutdownFailed ? error : abort.signal.aborted ? failure('cancelled') : error);
      }
      await this.changed();
    });
    entry.task = task;
    void task.finally(() => { if (this.logins.get(id) === entry) this.logins.delete(id); }).catch(() => {});
    return { profile: id, started: true };
  }
  async cancel(id) {
    const p = this.get(id), login = this.logins.get(id);
    if (login) { login.abort.abort(); await login.task; }
    else if(this.providerAborts.has(id)){this.providerAborts.get(id).abort();await this.operations.get(id);}
    else if (p.authState === 'awaiting-confirmation') {
      p.generation++; p.authState = 'needs-sign-in'; p.displayIdentity = null;
      p.errorCode = 'cancelled'; await this.changed();
    }
    return { profile: p.id, cancelled: true };
  }
  async confirm(id, generation, alias) {
    const p = this.get(id);
    if (!Number.isSafeInteger(generation) || generation !== p.generation ||
        p.authState !== 'awaiting-confirmation' || this.operations.has(id)) throw failure('stale-confirmation');
    if (alias !== undefined && !aliases(alias)) throw failure('invalid-request');
    return this.serial(id, async () => {
      if (p.generation !== generation || p.authState !== 'awaiting-confirmation') throw failure('stale-confirmation');
      if (alias !== undefined) p.alias = alias;
      try {
        // Re-read the CLI-owned identity, not the label shown by the UI.
        // This one collection belongs to the original sign-in operation; it
        // does not start a second authorization or bypass refresh cooldowns.
        if (p.provider === 'claude') await this.withClaude(p, async c => {
          const who = await this.claudeAdapter.identity(c); this.verify(p,who,who,generation);
          p.confirmed = true; await this.save(); await this.readClaude(p,c,generation);
        });
        else await this.withClient(p, async c => {
          const who = identity(await c.request('account/read',{refreshToken:false})); this.verify(p,who,who,generation);
          p.confirmed = true; await this.save(); await this.read(p,c,generation);
        });
      } catch (error) { this.setFailure(p, error); }
      await this.changed(); return {};
    });
  }
  setFailure(p, error) {
    const codes = ['needs-sign-in', 'identity-changed', 'cancelled', 'login-failed', 'shutdown-unconfirmed', 'terminal-stop-unconfirmed', 'needs-setup', 'unsupported-cli', 'unsupported-auth', 'unverified-profile', 'unverified-identity', 'unsupported-panel', 'unsupported-format', 'missing-browser-router', 'browser-route-unconfirmed', 'setup-interrupted', 'missing-setup-terminal', 'throttled'];
    p.errorCode = codes.includes(error?.code) ? error.code : 'unavailable';
    if(['terminal-stop-unconfirmed','shutdown-unconfirmed'].includes(p.errorCode)) this.requiresRecovery=true;
    if (p.errorCode === 'identity-changed') p.confirmed = false;
    p.authState = ['needs-setup','missing-setup-terminal','setup-interrupted'].includes(p.errorCode) ? 'needs-setup' : ['needs-sign-in', 'identity-changed', 'cancelled', 'login-failed'].includes(p.errorCode) ? 'needs-sign-in' : 'unavailable';
    p.status = p.authState === 'needs-sign-in' ? 'signed-out' : 'unavailable'; p.failures++;
    const backoff = this.now() + Math.min(30 * 60_000, this.interval(p) * 2 ** Math.min(p.failures - 1, 5));
    p.nextRetryAt = Math.max(backoff, time(error?.retryAt) ? error.retryAt : 0, p.nextRetryAt ?? 0);
  }
  async read(p, client, generation, signal) {
    p.lastAttemptAt = this.now();
    // Persist throttle reservation before the provider request, including crashes.
    p.nextRetryAt = this.now() + this.interval(p); await this.changed();
    const before = identity(await client.request('account/read', { refreshToken: false }));
    this.verify(p, before, before, generation);
    const result = await client.request('account/rateLimits/read');
    const after = identity(await client.request('account/read', { refreshToken: false }));
    this.verify(p, before, after, generation);
    if (signal?.aborted) throw failure('cancelled');
    p.binding = this.hash(after.binding,p.provider); p.displayIdentity = after.display; p.plan = after.plan;
    if (this.duplicate(p)) { p.authState = 'duplicate'; p.status = 'unavailable'; p.errorCode = 'possible-duplicate'; return; }
    const meters = parseLimits(result);
    p.authState = 'connected'; p.status = meters.length ? 'active' : 'unavailable';
    p.errorCode = meters.length ? null : 'quota-unavailable'; p.failures = 0;
    if (meters.length) { p.meters = meters; p.updatedAt = this.now(); }
    // Absent quotas retain old values and timestamps; no inferred observation time.
  }
  refresh(id, manual = false) {
    const p = this.get(id);
    if (this.operations.has(id) || this.logins.has(id) || !p.confirmed || p.authState === 'awaiting-confirmation' || p.authState === 'disconnected' || p.authState === 'needs-sign-in' || p.authState === 'needs-setup' && !manual || p.authState === 'duplicate' || (p.nextRetryAt ?? 0) > this.now()) return Promise.resolve();
    return this.serial(id, async () => {
      if ((p.nextRetryAt ?? 0) > this.now() || p.authState === 'disconnected') return;
      try { if(p.provider==='claude') await this.withClaude(p,context=>this.readClaude(p,context,p.generation));
        else await this.withClient(p, client => this.read(p, client, p.generation)); }
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
        if(p.provider==='claude') await this.withClaude(p,async context=>{
          let who; try{who=await this.claudeAdapter.identity(context);}catch(error){if(error.code!=='needs-sign-in')throw error;}
          if(who)this.verify(p,who,who,generation);
          await this.claudeAdapter.logout(context);
        });
        else await this.withClient(p, async client => {
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
      case 'capabilities': { const result=structuredClone(capabilities); const ready=await this.claudeAdapter.readiness();
        const claude=result.providers.find(p=>p.provider==='claude'); claude.available=ready.available; if(!ready.available)claude.reason=ready.reason; return result; }
      case 'status': case 'list': return this.snapshot();
      case 'add': case 'start': return this.add(request.provider ?? 'openai', request.alias ?? '');
      case 'cancel': return this.cancel(request.profile);
      case 'confirm': return this.confirm(request.profile, request.generation, request.alias);
      case 'setup': return this.setup(request.profile);
      case 'reconnect': return this.beginLogin(request.profile);
      case 'rename': return this.rename(request.profile, request.alias);
      case 'disconnect': return this.disconnect(request.profile);
      case 'remove': await this.disconnect(request.profile); this.profiles.delete(request.profile); await this.changed(); return {};
      case 'refresh': if (request.profile) void this.refresh(request.profile,true).catch(() => {}); else void this.refreshAll(); return this.snapshot();
      default: throw failure('invalid-request');
    }
  }
  async close() {
    this.stopping = true; for(const abort of this.providerAborts.values())abort.abort(); for (const login of this.logins.values()) login.abort.abort();
    for (const client of this.clients) client.close();
    await Promise.allSettled([...this.operations.values()]); await this.saving;
  }
}
