import { createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppServer } from '../app-server.mjs';
import { parseLimits } from '../limits.mjs';
import { openAuthBrowser } from '../auth-browser.mjs';
import { safeAuthUrl } from '../protocol.mjs';
import { atomicJson } from './store.mjs';
import { profileEnvironment, findCli, cliVersion, runCli } from './runtime.mjs';
import { ProbeError, readClaudeIdentity, probeClaudeUsage } from './claude.mjs';
import { codexLoginWaiter } from './codex-login.mjs';

export const manualChecks = ['two-distinct-accounts', 'primary-browser-unchanged', 'provider-values-match',
  'other-device-change', 'ordinary-website-logout', 'global-revocation', 'restart-and-renewal'];
const errorCodes = new Set(['needs-sign-in', 'unsupported-auth', 'unverified-profile', 'unverified-identity',
  'unsupported-format', 'unavailable', 'missing-terminal', 'terminal-unavailable', 'cancelled', 'unsupported-panel',
  'needs-setup', 'output-limit', 'cli-stopped', 'identity-changed', 'cooldown', 'login-unsupported', 'login-failed']);

function codexIdentity(info) {
  const account = info?.account;
  if (account?.type !== 'chatgpt' || typeof account.email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(account.email)) {
    throw new ProbeError('needs-sign-in', 'The isolated Codex profile needs a ChatGPT sign-in.');
  }
  return { binding: account.email.trim().toLowerCase(), display: account.email,
    confidence: 'email-only; workspace identity unavailable',
    plan: typeof account.planType === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(account.planType) ? account.planType : null };
}

function codexMeters(response) {
  return parseLimits(response).map(meter => {
    const slot = meter.id.endsWith('-primary') ? 'primary' : 'secondary';
    const id = meter.id.slice(0, -(slot.length + 1));
    const minutes = (response?.rateLimitsByLimitId?.[id] ?? response?.rateLimits)?.[slot]?.windowDurationMins;
    return { ...meter, ...(Number.isFinite(minutes) && minutes > 0 ? { windowMinutes: minutes } : {}) };
  });
}

function safeReading(reading) {
  if (!reading || !Number.isSafeInteger(reading.generation) || reading.generation < 1 || !Number.isFinite(reading.retrievedAt) || !Number.isFinite(reading.fetchStartedAt) ||
    reading.fetchStartedAt < 0 || reading.retrievedAt < reading.fetchStartedAt ||
    !['openai-app-server', 'claude-cli-panel'].includes(reading.source) || !Array.isArray(reading.meters) || reading.meters.length > 30) return null;
  const meters = [];
  for (const meter of reading.meters) {
    if (!meter || !/^[a-zA-Z0-9_-]{1,100}$/.test(meter.id) || typeof meter.label !== 'string' || meter.label.length > 120 ||
      /[@\r\n]/.test(meter.label) || !['work-codex', 'claude-subscription'].includes(meter.scope) ||
      typeof meter.usedPercent !== 'number' || !Number.isFinite(meter.usedPercent) || meter.usedPercent < 0 || meter.usedPercent > 1000) return null;
    meters.push({ id: meter.id, label: meter.label, scope: meter.scope, usedPercent: meter.usedPercent,
      resetsAt: Number.isFinite(meter.resetsAt) && meter.resetsAt > 0 ? meter.resetsAt : null,
      ...(Number.isFinite(meter.windowMinutes) && meter.windowMinutes > 0 ? { windowMinutes: meter.windowMinutes } : {}) });
  }
  return { generation: reading.generation, fetchStartedAt: reading.fetchStartedAt, retrievedAt: reading.retrievedAt,
    providerObservedAt: null, source: reading.source, meters,
    upstreamFreshness: 'not independently verified; compare with provider and other-device usage' };
}

export class AccountProof {
  constructor({ store, now = Date.now, locate = findCli, makeClient = options => new AppServer(options),
    launchBrowser = openAuthBrowser, claudeIdentity = readClaudeIdentity, claudeUsage = probeClaudeUsage,
    version = cliVersion, cli = runCli }) {
    Object.assign(this, { store, now, locate, makeClient, launchBrowser, claudeIdentity, claudeUsage, version, cli });
    this.pending = new Map(); this.clients = new Set(); this.snapshots = new Map(); this.identities = new Map();
    this.cooldowns = new Map(); this.versions = new Map(); this.observations = []; this.authBusy = false;
    this.closing = false; this.abort = new AbortController(); this.saving = Promise.resolve();
  }
  async load() {
    await this.store.load();
    try {
      const text = await readFile(path.join(this.store.directory, 'readings.json'), 'utf8');
      if (Buffer.byteLength(text) > 512 * 1024) throw new Error('Oversized cache');
      const cache = JSON.parse(text);
      if (cache.version !== 1 || !Array.isArray(cache.profiles)) throw new Error('Invalid cache');
      for (const profile of this.store.profiles) {
        const saved = cache.profiles.find(p => p.id === profile.id);
        const history = Array.isArray(saved?.history) ? saved.history.map(safeReading).filter(Boolean).slice(-20) : [];
        if (history.length) this.snapshots.set(profile.id, { status: 'remembered', history, last: history.at(-1) });
        if (Number.isFinite(saved?.nextCheckAt)) this.cooldowns.set(profile.id, saved.nextCheckAt);
      }
      this.observations = Array.isArray(cache.observations) ? cache.observations.filter(item =>
        ['openai', 'claude'].includes(item?.provider) && manualChecks.includes(item.check) &&
        ['pass', 'fail', 'pending'].includes(item.result) && Number.isFinite(item.recordedAt))
        .slice(-100).map(({ provider, check, result, recordedAt }) => ({ provider, check, result, recordedAt, evidence: 'user-reported; not automatically verified' })) : [];
      for (const provider of ['openai', 'claude']) if (/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(cache.versions?.[provider] ?? '')) this.versions.set(provider, cache.versions[provider]);
    } catch (error) {
      if (error.code !== 'ENOENT') { await this.store.close(); throw new Error('Diagnostic readings cache is invalid; credentials were not changed.'); }
    }
  }
  async context(profile) {
    const paths = await this.store.paths(profile);
    const env = profileEnvironment(profile.provider, paths.home);
    const executable = await this.locate(profile.provider);
    const version = await this.version(executable, { env, cwd: paths.workspace, signal: this.abort.signal });
    if (this.closing) throw new ProbeError('cancelled', 'Diagnostic is shutting down.');
    this.versions.set(profile.provider, version);
    if (profile.provider === 'openai') {
      // A proof-owned home; do not consult the user's ambient Codex config.
      await writeFile(path.join(paths.home, 'config.toml'), 'cli_auth_credentials_store = "auto"\n', { mode: 0o600 });
    }
    return { ...paths, env, executable, signal: this.abort.signal };
  }
  binding(profile, identity) { return createHmac('sha256', this.store.salt).update(profile.provider).update('\0').update(identity.binding).digest('hex'); }
  verify(profile, before, after, generation) {
    if (this.closing || profile.generation !== generation || this.binding(profile, before) !== this.binding(profile, after) ||
      profile.identityBinding && profile.identityBinding !== this.binding(profile, after)) {
      throw new ProbeError('identity-changed', 'The profile identity changed. The reading was rejected; create a new profile for a different account.');
    }
  }
  async withCodex(context, task) {
    const client = this.makeClient({ executable: context.executable, home: context.home, environment: context.env });
    this.clients.add(client);
    try { await client.ready; return await task(client); }
    finally { this.clients.delete(client); client.close(); }
  }
  login(id, { manualClaudeBrowser = false } = {}) {
    if (this.authBusy || this.pending.size || this.closing) return Promise.reject(new Error('Wait for the current operation before starting sign-in.'));
    let profile;
    try { profile = this.store.get(id); } catch (error) { return Promise.reject(error); }
    if (profile.provider === 'claude' && !manualClaudeBrowser) return Promise.reject(new ProbeError('login-unsupported', 'Automatic isolated Claude sign-in is not verified. Use the explicit manual CLI login option for this diagnostic.'));
    this.authBusy = true;
    const task = this.performLogin(profile).finally(() => { this.authBusy = false; });
    this.loginPending = task;
    return task.then(() => this.check(id));
  }
  async performLogin(profile) {
    try {
      profile.generation++; await this.store.save();
      const context = await this.context(profile);
      if (profile.provider === 'openai') {
        await this.withCodex(context, async client => {
          let loginId;
          const waiter = codexLoginWaiter(client, this.abort.signal);
          try {
            const login = await client.request('account/login/start', { type: 'chatgpt' });
            if (!safeAuthUrl(login?.authUrl) || typeof login.loginId !== 'string') throw new ProbeError('login-failed', 'Codex returned an unsupported login response.');
            loginId = login.loginId;
            waiter.setId(loginId);
            if (this.closing) throw new ProbeError('cancelled', 'Sign-in cancelled.');
            await this.launchBrowser({ directory: path.join(context.browser, `attempt-${profile.generation}`), url: login.authUrl });
            await waiter.promise;
          } catch (error) {
            if (loginId) await client.request('account/login/cancel', { loginId }).catch(() => {});
            throw error;
          } finally { waiter.dispose(); }
        });
      } else {
        // No invented --no-browser flag or unverified BROWSER workaround. This
        // diagnostic can explicitly run first-party auth, but isolated browser
        // launching remains a separate blocked product acceptance criterion.
        const result = await this.cli(context.executable, ['auth', 'login'], { env: context.env, cwd: context.workspace, inherit: true, timeout: 180_000, signal: this.abort.signal });
        if (result.code !== 0) throw new ProbeError('login-failed', 'Claude Code sign-in did not complete.');
      }
      this.cooldowns.delete(profile.id);
    } catch (error) {
      this.snapshots.set(profile.id, { ...this.snapshots.get(profile.id), status: 'needs-sign-in' });
      await this.save();
      throw error;
    }
  }
  check(id) {
    if (this.pending.has(id)) return this.pending.get(id);
    if (this.authBusy || this.closing) return Promise.reject(new Error('Finish sign-in or restart the diagnostic before checking.'));
    const profile = this.store.get(id);
    if ((this.cooldowns.get(id) ?? 0) > this.now()) return Promise.reject(new ProbeError('cooldown', 'This account is cooling down. Wait before checking again.'));
    const task = this.read(profile).finally(() => this.pending.delete(id));
    this.pending.set(id, task); return task;
  }
  async read(profile) {
    const generation = profile.generation;
    const fetchStartedAt = this.now();
    const previous = this.snapshots.get(profile.id);
    try {
      const context = await this.context(profile);
      let before, after, result;
      if (profile.provider === 'openai') {
        await this.withCodex(context, async client => {
          before = codexIdentity(await client.request('account/read', { refreshToken: false }));
          this.verify(profile, before, before, generation);
          result = { meters: codexMeters(await client.request('account/rateLimits/read')), source: 'openai-app-server' };
          after = codexIdentity(await client.request('account/read', { refreshToken: false }));
        });
      } else {
        before = await this.claudeIdentity(context);
        this.verify(profile, before, before, generation);
        result = await this.claudeUsage({ ...context, signal: this.abort.signal });
        after = await this.claudeIdentity(context);
      }
      this.verify(profile, before, after, generation);
      const reading = safeReading({ ...result, generation, fetchStartedAt, retrievedAt: this.now() });
      if (!reading) throw new ProbeError('unsupported-format', 'The provider returned an unsupported quota shape.');
      if (!profile.identityBinding) { profile.identityBinding = this.binding(profile, after); await this.store.save(); }
      this.verify(profile, before, after, generation);
      this.identities.set(profile.id, { display: after.display, confidence: after.confidence, plan: after.plan });
      this.snapshots.set(profile.id, { status: reading.meters.length ? 'reading-available' : 'quota-unavailable',
        last: reading.meters.length ? reading : previous?.last ?? null,
        history: reading.meters.length ? [...(previous?.history ?? []), reading].slice(-20) : previous?.history ?? [] });
      this.cooldowns.set(profile.id, this.now() + (profile.provider === 'openai' ? 120_000 : 300_000));
      await this.save(); return reading;
    } catch (error) {
      const code = errorCodes.has(error.code) ? error.code : 'unavailable';
      this.snapshots.set(profile.id, { ...previous, status: code });
      // Manual refresh cannot bypass cooldown, even after an error. No token rotation.
      this.cooldowns.set(profile.id, this.now() + (profile.provider === 'openai' ? 120_000 : 300_000));
      await this.save();
      throw new ProbeError(code, error instanceof ProbeError ? error.message : 'The provider check failed. Verify the CLI installation and sign-in; details are intentionally not logged.');
    }
  }
  logout(id) {
    if (this.authBusy || this.pending.size || this.closing) return Promise.reject(new Error('Wait for the current operation before signing out.'));
    const profile = this.store.get(id);
    this.authBusy = true;
    const task = (async () => {
      const generation = ++profile.generation; await this.store.save();
      const context = await this.context(profile);
      if (profile.provider === 'openai') await this.withCodex(context, async client => {
        if (profile.identityBinding) {
          const identity = codexIdentity(await client.request('account/read', { refreshToken: false }));
          this.verify(profile, identity, identity, generation);
        }
        await client.request('account/logout');
      });
      else {
        if (profile.identityBinding) {
          const identity = await this.claudeIdentity(context); this.verify(profile, identity, identity, generation);
        }
        const result = await this.cli(context.executable, ['auth', 'logout'], { env: context.env, cwd: context.workspace, signal: this.abort.signal });
        if (result.code !== 0) throw new ProbeError('unavailable', 'Official CLI logout did not confirm success. Retry before deleting local profiles.');
      }
      this.snapshots.set(id, { ...this.snapshots.get(id), status: 'needs-sign-in' });
      this.identities.delete(id); await this.save();
    })().catch(async error => {
      this.snapshots.set(id, { ...this.snapshots.get(id), status: 'logout-unconfirmed' });
      await this.save();
      throw new ProbeError('unavailable', 'Official CLI logout was not confirmed. Credentials and dated readings were retained.');
    }).finally(() => { this.authBusy = false; });
    this.loginPending = task; return task;
  }
  async observe(provider, check, result) {
    if (!['openai', 'claude'].includes(provider) || !manualChecks.includes(check) || !['pass', 'fail', 'pending'].includes(result)) throw new Error('Unknown evidence check.');
    this.observations.push({ provider, check, result, recordedAt: this.now(), evidence: 'user-reported; not automatically verified' });
    this.observations = this.observations.slice(-100);
    await this.save();
  }
  report() {
    const groups = new Map();
    return { version: 1, generatedAt: this.now(), platform: process.platform, arch: process.arch, node: process.versions.node,
      stage: 'connector proof; not a released extension capability', overallGate: 'pending real-account review',
      liveVerification: 'No automated test establishes real account isolation, upstream freshness, logout survival or renewal.',
      claudeProductGate: 'blocked: permitted monitoring/distribution and automatic isolated browser sign-in need confirmation',
      versions: Object.fromEntries(this.versions),
      profiles: this.store.profiles.map(profile => {
        const snapshot = this.snapshots.get(profile.id);
        if (profile.identityBinding && !groups.has(profile.identityBinding)) groups.set(profile.identityBinding, `identity-${groups.size + 1}`);
        return { id: profile.id, provider: profile.provider, alias: profile.alias, generation: profile.generation,
          identityGroup: groups.get(profile.identityBinding) ?? null,
          identityConfidence: this.identities.get(profile.id)?.confidence ?? 'not checked this run',
          status: snapshot?.status ?? 'not-checked', nextCheckAt: this.cooldowns.get(profile.id) ?? null,
          last: snapshot?.last ?? null, history: snapshot?.history ?? [] };
      }),
      checks: ['openai', 'claude'].flatMap(provider => manualChecks.map(check =>
        [...this.observations].reverse().find(item => item.provider === provider && item.check === check) ?? { provider, check, result: 'pending' })),
    };
  }
  async save() {
    // Snapshot now; serialize atomic renames from independent profile completions.
    const payload = { version: 1, profiles: this.report().profiles.map(({ id, history, nextCheckAt }) => ({ id, history, nextCheckAt })),
      observations: [...this.observations], versions: Object.fromEntries(this.versions) };
    this.saving = this.saving.catch(() => {}).then(() => atomicJson(path.join(this.store.directory, 'readings.json'), payload));
    return this.saving;
  }
  async exportReport() {
    const file = path.join(this.store.directory, 'redacted-report.json');
    await atomicJson(file, this.report()); return file;
  }
  async close() {
    if (this.closing) return;
    this.closing = true; this.abort.abort();
    for (const client of this.clients) client.close();
    await Promise.allSettled([this.loginPending, ...this.pending.values()]); await this.saving;
    await this.store.close();
  }
}
