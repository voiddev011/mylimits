import { browser } from 'wxt/browser';
import { z } from 'zod';
import { nativeRuntime } from '../core/native-runtime';
import { MeterSchema } from '../core/schema';
import { CapabilitiesSchema, NativeSnapshotSchema, type Capabilities, type NativeProfile } from '../core/independent';
import type { CompanionProfile } from '../core/companion';
const HOST = 'com.mylimits.openai';
const KEY = 'mylimits:companion-enabled';
const LegacySnapshotSchema = z.object({ type: z.literal('snapshot'), profiles: z.array(z.object({
  possibleDuplicate: z.boolean().optional(), id: z.string().uuid(), status: z.enum(['active', 'signed-out', 'unavailable']), plan: z.string().max(80).nullable(),
  updatedAt: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER), meters: z.array(MeterSchema).max(30),
})).max(20) });
let port: ReturnType<typeof browser.runtime.connectNative> | undefined;
let generation = 0;
let capabilities: Capabilities | null = null;
let profiles: NativeProfile[] = [];
let onSnapshot: (profiles: CompanionProfile[] | null) => Promise<void> = async () => {};
let delivery = Promise.resolve();
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const unavailable = () => new Error('MyLimits Desktop is unavailable. Open or install Desktop, then retry. Website tracking works without it.');
const errors: Record<string,string> = {
  cooldown: 'This account must wait before another attempt. Check its retry time.',
  busy: 'This account already has an operation in progress.',
  'provider-unavailable': 'Independent connections for this provider are not available yet.',
  'logout-unconfirmed': 'Sign-out was not confirmed. Credentials and dated readings were retained; retry disconnect.',
  'service-unavailable': 'Restart the account helper before trying again.',
  'stale-confirmation': 'This sign-in changed or expired. Check the account again before confirming.',
};
export function listenCompanion(listener: typeof onSnapshot) { onSnapshot = listener; }
function accept(raw: unknown) {
  const current = NativeSnapshotSchema.safeParse(raw);
  if (current.success) {
    profiles = current.data.profiles;
    const normalized = profiles.map(({ displayIdentity: _display, id, status, plan, updatedAt, meters, ...independent }) => ({ id, status, plan, updatedAt, meters, possibleDuplicate: independent.possibleDuplicate, independent }));
    delivery = delivery.catch(() => {}).then(() => onSnapshot(normalized));
  } else {
    if (raw && typeof raw === 'object' && 'protocol' in raw) throw new Error('Unsupported account helper response. Update the helper.');
    const old = LegacySnapshotSchema.safeParse(raw);
    if (!old.success) throw new Error('The account helper returned an unsupported response. Update the helper.');
    // Old helpers can retain dated values; they cannot establish v2 account proof.
    delivery = delivery.catch(() => {}).then(() => onSnapshot(old.data.profiles.map(p => ({ ...p, status: 'unavailable' }))));
  }
  return delivery;
}
export async function companionStatus() {
  const enabled = !!(await browser.storage.local.get(KEY))[KEY];
  let issue: string | null = null;
  if (enabled) {
    try {
      const result = await companionRequest('capabilities');
      const parsed = CapabilitiesSchema.safeParse(result);
      if (parsed.success) { capabilities = parsed.data; await accept(await companionRequest('status')); }
      else { capabilities = null; issue = 'Update the helper to enable independent account connections.'; }
    } catch { issue = port ? 'Update or restart the helper, then retry.' : unavailable().message; }
  }
  if(capabilities&&!capabilities.identityConfirmation)issue='Update MyLimits Desktop to confirm independent accounts safely.';
  return { enabled, connected: !!port, compatible: capabilities?.protocol === 2 && capabilities.identityConfirmation===true && !!port, capabilities, profiles, issue };
}
export async function connectCompanion() {
  if (port) return;
  if (!(await browser.storage.local.get(KEY))[KEY] || !await browser.permissions.contains({ permissions: ['nativeMessaging'] })) return;
  const stamp = ++generation;
  const chrome = (globalThis as unknown as { chrome?: { runtime?: typeof browser.runtime } }).chrome;
  const runtime = nativeRuntime(chrome?.runtime, browser.runtime);
  const connection = runtime.connectNative(HOST); port = connection;
  connection.onMessage.addListener(raw => {
    if (stamp !== generation) return;
    if (raw?.type === 'snapshot') { void accept(raw).catch(() => {}); return; }
    if (typeof raw?.id !== 'string') return;
    const entry = pending.get(raw.id);
    if (!entry) return;
    pending.delete(raw.id); clearTimeout(entry.timer);
    if (raw.ok === true) entry.resolve(raw.data);
    else entry.reject(new Error(errors[raw.error] ?? 'Account action failed. Check the helper and sign-in status.'));
  });
  connection.onDisconnect.addListener(() => {
    void runtime.lastError;
    if (port !== connection) return;
    port = undefined; capabilities = null; profiles = [];
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(unavailable()); }
    pending.clear(); delivery = delivery.catch(() => {}).then(() => onSnapshot(null));
  });
}
export type CompanionMethod = 'status'|'capabilities'|'list'|'start'|'setup'|'cancel'|'confirm'|'reconnect'|'rename'|'disconnect'|'remove'|'refresh';
export async function companionRequest(method: CompanionMethod, profile?: string, extra: { provider?: 'openai'|'claude'; alias?: string; generation?: number } = {}): Promise<unknown> {
  await connectCompanion();
  if (!port) throw unavailable();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Helper request timed out. Retry its status; avoid starting duplicate sign-ins.')); }, 75_000);
    pending.set(id, { resolve, reject, timer });
    try { port!.postMessage({ id, method, ...(profile ? { profile } : {}), ...extra }); }
    catch { clearTimeout(timer); pending.delete(id); reject(unavailable()); }
  });
}
export async function refreshCompanion(refresh = false) {
  if (!(await browser.storage.local.get(KEY))[KEY]) return;
  await accept(await companionRequest(refresh ? 'refresh' : 'status'));
}
export async function enableCompanion(enabled: boolean) {
  if(enabled&&__MYLIMITS_BROWSER__==='firefox')throw new Error('Firefox native host setup is not supplied. Website tracking remains available.');
  if (enabled && !await browser.permissions.contains({ permissions: ['nativeMessaging'] })) throw new Error('Approve helper access first.');
  await browser.storage.local.set({ [KEY]: enabled });
  if (enabled) await refreshCompanion();
  else {
    const connection = port; port = undefined; generation++; capabilities = null; profiles = [];
    connection?.disconnect();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(unavailable()); }
    pending.clear(); delivery = delivery.catch(() => {}).then(() => onSnapshot(null)); await delivery;
  }
}
export async function addCompanionAccount(provider: 'openai'|'claude' = 'openai', alias = '') {
  const status = await companionStatus();
  if (!status.compatible) throw new Error('Install or update the account helper before adding an independent account.');
  if (!status.capabilities?.providers.find(p => p.provider === provider)?.available) throw new Error('Independent connections for this provider are unavailable. Website tracking remains available.');
  return z.object({ profile: z.string().uuid(), started: z.literal(true) }).strict().parse(await companionRequest('start', undefined, { provider, alias })).profile;
}
