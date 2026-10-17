import { mkdir, open, readFile, rename, unlink, lstat, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export const aliasValid = value => typeof value === 'string' && /^[\p{L}\p{N} _.-]{1,40}$/u.test(value) && !value.includes('@');

export async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Diagnostic directory must be a real private directory.');
  if (process.platform !== 'win32') {
    if (info.uid !== process.getuid()) throw new Error('Diagnostic directory must be owned by the current user.');
    if (info.mode & 0o077) await chmod(directory, 0o700);
  }
}
export async function atomicJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  const handle = await open(tmp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); } finally { await handle.close(); }
  try { await rename(tmp, file); } finally { await unlink(tmp).catch(() => {}); }
}

export class ProofStore {
  constructor(directory) { this.directory = directory; this.profiles = []; this.salt = null; this.saving = Promise.resolve(); }
  async load() {
    await privateDirectory(this.directory);
    // One diagnostic process owns all profile CLI writers. Fail closed after a
    // crash; the documented explicit unlock requires checking no process remains.
    try { this.lock = await open(path.join(this.directory, 'proof.lock'), 'wx', 0o600); }
    catch { throw new Error('Diagnostic is already running, or a stale proof.lock needs manual recovery.'); }
    await this.lock.writeFile(String(process.pid));
    try {
      const state = JSON.parse(await readFile(path.join(this.directory, 'profiles.json'), 'utf8'));
      if (state.version !== 1 || !uuid(state.salt) || !Array.isArray(state.profiles) || state.profiles.length > 8 ||
        state.profiles.some(p => !uuid(p.id) || !['openai', 'claude'].includes(p.provider) || !aliasValid(p.alias) || !Number.isSafeInteger(p.generation) || p.generation < 1 ||
        p.identityBinding !== null && !/^[a-f0-9]{64}$/.test(p.identityBinding)) || new Set(state.profiles.map(p => p.id)).size !== state.profiles.length) throw new Error('Invalid index');
      this.salt = state.salt;
      this.profiles = state.profiles.map(({ id, provider, alias, generation, identityBinding }) => ({ id, provider, alias, generation, identityBinding }));
    } catch (error) {
      if (error.code !== 'ENOENT') { await this.close(); throw new Error('Diagnostic profile index is invalid; no credentials were changed.'); }
      this.salt = randomUUID(); await this.save();
    }
  }
  get(id) { const profile = this.profiles.find(p => p.id === id); if (!profile) throw new Error('Unknown diagnostic profile.'); return profile; }
  async create(provider, alias) {
    if (!['openai', 'claude'].includes(provider) || !aliasValid(alias) || this.profiles.length >= 8) throw new Error('Choose OpenAI/Claude and a short nickname without an email address; at most eight proof profiles.');
    const profile = { id: randomUUID(), provider, alias, generation: 1, identityBinding: null };
    await this.paths(profile); this.profiles.push(profile); await this.save(); return profile;
  }
  async paths(profile) {
    if (!this.profiles.includes(profile) && !uuid(profile.id)) throw new Error('Invalid profile.');
    const root = path.join(this.directory, 'profiles', profile.id);
    const home = path.join(root, profile.provider === 'openai' ? 'codex' : 'claude');
    const workspace = path.join(root, 'empty-workspace');
    for (const dir of [path.join(this.directory, 'profiles'), root, home, workspace]) await privateDirectory(dir);
    return { root, home, workspace, browser: path.join(root, 'sign-in-browser') };
  }
  async save() {
    const state = structuredClone({ version: 1, salt: this.salt, profiles: this.profiles });
    this.saving = this.saving.catch(() => {}).then(() => atomicJson(path.join(this.directory, 'profiles.json'), state));
    return this.saving;
  }
  async close() {
    if (!this.lock) return;
    await this.saving;
    await this.lock.close(); this.lock = null;
    await unlink(path.join(this.directory, 'proof.lock')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
