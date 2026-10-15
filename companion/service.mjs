import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AppServer } from './app-server.mjs';
import { parseLimits } from './limits.mjs';
import { safeAuthUrl } from './protocol.mjs';

export class Companion extends EventEmitter {
  constructor({ directory, executable = 'codex', makeClient = options => new AppServer(options), now = Date.now }) {
    super(); this.directory = directory; this.executable = executable; this.makeClient = makeClient; this.now = now;
    this.profiles = new Map(); this.clients = new Map(); this.refreshing = new Map(); this.stopping = false;
  }
  async load() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    let ids = [];
    try { ids = JSON.parse(await readFile(path.join(this.directory, 'profiles.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Companion profile index is invalid.'); }
    if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))) throw new Error('Companion profile index is invalid.');
    for (const id of ids) this.profiles.set(id, { id, status: 'unavailable', plan: null, meters: [], updatedAt: 0 });
  }
  async persist() {
    const file = path.join(this.directory, 'profiles.json');
    await writeFile(file + '.tmp', JSON.stringify([...this.profiles.keys()]), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
  snapshot() { return { type: 'snapshot', profiles: [...this.profiles.values()].map(profile => ({ id: profile.id, status: profile.status, plan: profile.plan, meters: [...profile.meters], updatedAt: profile.updatedAt })) }; }
  changed() { if (!this.stopping) this.emit('snapshot', this.snapshot()); }
  async client(id) {
    if (!this.clients.has(id)) {
      const home = path.join(this.directory, 'accounts', id);
      await mkdir(home, { recursive: true, mode: 0o700 });
      // Prefer the OS credential store. Codex may fall back to an owner-only auth file.
      const config = path.join(home, 'config.toml');
      await writeFile(config, 'cli_auth_credentials_store = "auto"\n', { mode: 0o600 });
      const client = this.makeClient({ executable: this.executable, home });
      this.clients.set(id, client);
      client.on('notification', event => {
        if (event.method === 'account/login/completed') {
          const profile = this.profiles.get(id);
          if (profile) {
            profile.status = event.params?.success ? 'unavailable' : 'signed-out';
            if (event.params?.success) { delete profile.loginId; void this.refresh(id); }
            this.changed();
          }
        } else if (event.method === 'account/rateLimits/updated') void this.refresh(id);
      });
      client.on('stopped', () => {
        if (this.clients.get(id) !== client) return;
        this.clients.delete(id);
        const profile = this.profiles.get(id);
        if (profile) { profile.status = 'unavailable'; this.changed(); }
      });
    }
    const client = this.clients.get(id);
    await client.ready;
    return client;
  }
  async add() {
    if (this.profiles.size >= 20) throw new Error('At most 20 companion accounts are supported.');
    const id = randomUUID();
    const profile = { id, status: 'signed-out', plan: null, meters: [], updatedAt: 0 };
    this.profiles.set(id, profile); await this.persist();
    try {
      const client = await this.client(id);
      const login = await client.request('account/login/start', { type: 'chatgpt' });
      if (!safeAuthUrl(login?.authUrl) || typeof login.loginId !== 'string') throw new Error('OpenAI returned an unsupported sign-in response.');
      profile.loginId = login.loginId; this.changed();
      return { profile: id, authUrl: login.authUrl };
    } catch {
      // An interrupted login may have created local authorization. Keep the profile
      // visible so it can be explicitly cancelled/logged out instead of orphaned.
      profile.status = 'unavailable';
      this.clients.get(id)?.close(); this.clients.delete(id);
      this.changed(); throw new Error('Could not start OpenAI sign-in. Check Codex installation, then disconnect the unfinished profile before retrying.');
    }
  }
  async refresh(id) {
    if (this.refreshing.has(id)) return this.refreshing.get(id);
    const task = (async () => {
      const profile = this.profiles.get(id);
      if (!profile || profile.loginId || profile.removing || (profile.nextRetryAt ?? 0) > this.now()) return;
      try {
        const client = await this.client(id);
        const info = await client.request('account/read', { refreshToken: false });
        if (info?.account?.type !== 'chatgpt') { profile.status = 'signed-out'; return; }
        const result = await client.request('account/rateLimits/read');
        profile.meters = parseLimits(result);
        profile.plan = typeof info.account.planType === 'string' ? info.account.planType.slice(0, 80) : null;
        profile.updatedAt = this.now(); profile.status = 'active'; profile.failures = 0; profile.nextRetryAt = 0;
      } catch {
        profile.status = 'unavailable'; profile.failures = (profile.failures ?? 0) + 1;
        profile.nextRetryAt = this.now() + Math.min(15, 2 ** (profile.failures - 1)) * 60_000;
      }
      finally { this.changed(); }
    })();
    this.refreshing.set(id, task);
    try { await task; } finally { this.refreshing.delete(id); }
  }
  async refreshAll() { await Promise.allSettled([...this.profiles.keys()].map(id => this.refresh(id))); }
  async remove(id) {
    const profile = this.profiles.get(id);
    if (!profile) return {};
    // Wait out a reading before logout; never delete credentials when revocation failed.
    profile.removing = true;
    try {
    await this.refreshing.get(id);
    const client = await this.client(id);
    if (profile.loginId) await client.request('account/login/cancel', { loginId: profile.loginId });
    else await client.request('account/logout');
    this.clients.delete(id); client.close(); this.profiles.delete(id);
    await this.persist(); await rm(path.join(this.directory, 'accounts', id), { recursive: true, force: true }); this.changed(); return {};
    } finally { delete profile.removing; }
  }
  async handle(request) {
    if (request.method === 'status') return this.snapshot();
    if (request.method === 'add') return this.add();
    if (request.method === 'remove') return this.remove(request.profile);
    if (request.method === 'refresh') { await this.refreshAll(); return this.snapshot(); }
    throw new Error('Unsupported companion request.');
  }
  close() { this.stopping = true; for (const client of this.clients.values()) client.close(); this.clients.clear(); }
}
