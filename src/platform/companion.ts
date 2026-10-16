import { browser } from 'wxt/browser';
import { z } from 'zod';
import { nativeRuntime } from '../core/native-runtime';
import { MeterSchema } from '../core/schema';
import type { CompanionProfile } from '../core/companion';
const HOST = 'com.mylimits.openai';
const KEY = 'mylimits:companion-enabled';
const SnapshotSchema = z.object({ type: z.literal('snapshot'), profiles: z.array(z.object({
  id: z.string().uuid(), status: z.enum(['active', 'signed-out', 'unavailable']), plan: z.string().max(80).nullable(),
  updatedAt: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER), meters: z.array(MeterSchema).max(30),
})).max(20) });
let port: ReturnType<typeof browser.runtime.connectNative> | undefined;
let generation = 0;
let onSnapshot: (profiles: CompanionProfile[] | null) => Promise<void> = async () => {};
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const unavailable = () => new Error('OpenAI companion is unavailable. Install and start it, then retry in Websites.');
export function listenCompanion(listener: typeof onSnapshot) { onSnapshot = listener; }
export async function companionStatus() {
  return { enabled: !!(await browser.storage.local.get(KEY))[KEY], connected: !!port };
}
export async function connectCompanion() {
  if (port) return;
  if (!(await companionStatus()).enabled || !await browser.permissions.contains({ permissions: ['nativeMessaging'] })) return;
  const stamp = ++generation;
  const chrome = (globalThis as unknown as { chrome?: { runtime?: typeof browser.runtime } }).chrome;
  const runtime = nativeRuntime(chrome?.runtime, browser.runtime);
  const connection = runtime.connectNative(HOST); port = connection;
  connection.onMessage.addListener(raw => {
    if (stamp !== generation) return;
    if (raw?.type === 'snapshot') {
      const parsed = SnapshotSchema.safeParse(raw);
      if (parsed.success) void onSnapshot(parsed.data.profiles).catch(() => {});
      return;
    }
    if (typeof raw?.id !== 'string') return;
    const entry = pending.get(raw.id);
    if (!entry) return;
    pending.delete(raw.id); clearTimeout(entry.timer);
    if (raw.ok === true) entry.resolve(raw.data);
    else entry.reject(new Error('OpenAI action failed. Finish sign-in or check the companion. If disconnect failed, retry it before removing credentials.'));
  });
  connection.onDisconnect.addListener(() => {
    void runtime.lastError; // Consume Chrome's diagnostic without exposing host details.
    if (port !== connection) return;
    port = undefined;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(unavailable()); }
    pending.clear(); void onSnapshot(null).catch(() => {});
  });
}
export async function companionRequest(method: 'status' | 'add' | 'remove' | 'refresh', profile?: string): Promise<unknown> {
  await connectCompanion();
  if (!port) throw unavailable();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Companion request timed out. Check the local service.')); }, 75_000);
    pending.set(id, { resolve, reject, timer });
    try { port!.postMessage({ id, method, ...(profile ? { profile } : {}) }); }
    catch { clearTimeout(timer); pending.delete(id); reject(unavailable()); }
  });
}
export async function refreshCompanion() {
  const status = await companionStatus();
  if (!status.enabled) return;
  const raw = await companionRequest('status');
  const snapshot = SnapshotSchema.parse(raw);
  await onSnapshot(snapshot.profiles);
}
export async function enableCompanion(enabled: boolean) {
  if(enabled&&__MYLIMITS_BROWSER__==='firefox')throw new Error('Firefox native host setup is not supplied. Website tracking remains available.');
  if (enabled && !await browser.permissions.contains({ permissions: ['nativeMessaging'] })) throw new Error('Approve companion access first.');
  await browser.storage.local.set({ [KEY]: enabled });
  if (enabled) await refreshCompanion();
  else {
    const connection = port; port = undefined; generation++;
    connection?.disconnect();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(unavailable()); }
    pending.clear(); await onSnapshot(null);
  }
}
export async function addCompanionAccount() {
  const result = z.object({ profile: z.string().uuid(), authUrl: z.string().url() }).parse(await companionRequest('add'));
  const url = new URL(result.authUrl);
  if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname) || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Unsupported OpenAI sign-in URL.');
  await browser.tabs.create({ url: result.authUrl });
}
