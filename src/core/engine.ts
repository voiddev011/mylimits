import { privateAccountName } from './presentation';
import { isQuiet, alertKey, confirmedReset } from './alert-policy';
import { acceptSnapshot, projectAccounts } from './connections';
import { type Account, type Meter, type ProviderId, type Store, accountName, alertThresholds, isFresh, remainingPercent } from './model';

export interface Snapshot {
  identity: string;
  kind: Account['kind'];
  displayName: string;
  plan: string | null;
  meters: Meter[];
  workspace?: { identity: string; name: string };
  workspaces?: { identity: string; name: string }[];
}

export async function accountId(provider: ProviderId, identity: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}\u0000${provider}\u0000${identity}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${provider}:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function applySnapshot(store: Store, provider: ProviderId, id: string, snapshot: Omit<Snapshot, 'identity'>, now: number, options: { connectionId?: string; workspaceId?: string | null; observedAt?: number; generation?: number } = {}): Store {
  const previous = store.accounts.find(account => account.id === id);
  const localMeters = (previous?.meters ?? []).filter(meter => meter.evidence === 'observed');
  const incomingIds = new Set(snapshot.meters.map(meter => meter.id));
  const account: Account = {
    ...previous, id, provider, kind: snapshot.kind,
    alias: previous?.alias ?? '',
    defaultName: snapshot.displayName,
    plan: snapshot.plan,
    connection: 'active',
    meters: [...snapshot.meters, ...localMeters.filter(meter => !incomingIds.has(meter.id))],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    alertRemaining: previous?.alertRemaining ?? null,
    alertsMuted: previous?.alertsMuted ?? false,
  };
  const connectionId = options.connectionId ?? `website:${provider}`;
  const connection = store.connections.find(c => c.id === connectionId);
  if (!connection || (options.generation !== undefined && (!connection.enabled || connection.generation !== options.generation))) return store;
  const base: Store = { ...store, accounts: [...store.accounts.filter(a => a.id !== id), account],
    connections: store.connections.map(c => c.id === connectionId ? { ...c, enabled: true } : c),
    providers: connection.kind === 'website' ? { ...store.providers, [provider]: { ...store.providers[provider],enabled:true,status:'active',activeAccountId:id,checkedAt:now,
      message:snapshot.meters.some(m => m.evidence === 'reported') ? null : snapshot.kind === 'browser' ? 'Only activity observed in this browser is available.' : 'This plan did not report a quota. Remaining allowance is unknown.',failures:0,nextRetryAt:null } } : store.providers };
  const observedAt = options.observedAt ?? now;
  const result = acceptSnapshot(base, { schemaVersion:2,snapshotId:`${connectionId}:${id}:${observedAt}`,providerId:provider,accountId:id,connectionId,
    workspaceId:options.workspaceId ?? null,observedAt,receivedAt:now,connectorVersion:'website-v2.1',meters:account.meters.map(m=>({...m,observedAt:m.evidence==='observed'?(m.observedAt??previous?.updatedAt??observedAt):observedAt,connectionId})) }, connection.generation, now);
  return result.accepted ? result.store : store;

}

export function markProvider(store: Store, provider: ProviderId, status: Exclude<Store['providers'][ProviderId]['status'], 'checking' | 'active'>, message: string, now: number): Store {
  const next: Store = { ...store,
    connections:store.connections.map(c=>c.id===`website:${provider}`?{...c,status:status==='signed-out'?'needs-auth':status==='waiting-for-tab'?'needs-tab':status==='disabled'?'disabled':status==='inactive'?'disabled':status,enabled:status==='disabled'?false:c.enabled,message,lastAttemptAt:now}:c),
    accounts: store.accounts.map(account => account.provider === provider && !account.companionProfile && account.connection === 'active'
      ? { ...account, connection: status === 'disabled' ? 'inactive' as const : status } : account),
    providers: { ...store.providers, [provider]: { ...store.providers[provider], status, activeAccountId:null,checkedAt:now,message } } };
  return projectAccounts(next);

}

export function recordObservation(store: Store, provider: ProviderId, id: string, eventId: string, now: number): Store {
  if (store.observationLedger.includes(eventId) || store.providers[provider].activeAccountId !== id) return store;
  const account = store.accounts.find(item => item.id === id && item.connection === 'active');
  if (!account) return store;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const resetsAt = start.getTime() + 86_400_000;
  const existing = account.meters.find(meter => meter.id === 'browser-requests');
  const used = existing?.resetsAt === resetsAt ? (existing.used ?? 0) + 1 : 1;
  const meter: Meter = {
    id: 'browser-requests', label: 'Requests observed today (UTC)', scope: 'local', evidence: 'observed',
    usedPercent: null, used, total: null, unit: 'requests', resetsAt,
    source: 'This browser only. Request count is not an account quota.', observedAt: now, connectionId: `website:${provider}`,
  };
  return { ...store,
    accounts: store.accounts.map(item => item.id === id ? { ...item, meters: [...item.meters.filter(m => m.id !== meter.id), meter] } : item),
    snapshots: store.snapshots.map(s => s.accountId === id && s.connectionId === `website:${provider}` ? { ...s, snapshotId: `observation:${eventId}`, receivedAt: now, observedAt: s.meters.some(m => m.evidence === 'reported') ? s.observedAt : now, meters: [...s.meters.filter(m => m.id !== meter.id), meter] } : s),
    observationLedger: [...store.observationLedger, eventId].slice(-300),
  };
}

export interface LimitAlert { id: string; title: string; message: string; accountId: string; meterId: string; ledgerKey: string; kind: 'low' | 'reset'; }
export function collectAlerts(store: Store, now: number): { store: Store; alerts: LimitAlert[] } {
  if (!store.settings.desktopAlerts || isQuiet(store.settings, now)) return { store, alerts: [] };
  const ledger = structuredClone(store.alertLedger);
  const alerts: LimitAlert[] = [];
  const resetLedger = structuredClone(store.resetLedger);
  for (const account of store.accounts) {
    if (account.alertsMuted || (account.snoozedUntil ?? 0) > now) continue;
    for (const meter of account.meters) {
      if (meter.evidence !== 'reported' || !isFresh(account, meter, now, store.settings.refreshMinutes)) continue;
      const remaining = remainingPercent(meter);
      if (remaining === null) continue;
      const key = alertKey(account, meter);
      const window = meter.resetsAt === null ? 'unknown' : String(meter.resetsAt);
      const prior = ledger[key] ?? ledger[`${account.id}/${meter.id}`];
      const entry = prior?.window === window ? { window, sent: [...prior.sent] } : { window, sent: [] as number[] };
      const configured = alertThresholds(account, store.settings);
      const thresholds = [...new Set([configured.warning, configured.critical])].sort((a, b) => a - b);
      // A quota with no published reset can rearm after a meaningful recovery.
      if (meter.resetsAt === null) entry.sent = entry.sent.filter(threshold => remaining < threshold + 5);
      const crossed = thresholds.filter(threshold => remaining <= threshold && !entry.sent.includes(threshold));
      if (crossed.length) {
        const threshold = crossed[0]!;
        alerts.push({ id: `limit:${key}:${window}:${threshold}`, accountId: account.id, meterId: meter.id, ledgerKey: key, kind: 'low',
          title: `${(store.settings.privacyMode ? privateAccountName(store.accounts, account.id) : accountName(account))} is running low`,
          message: `${store.settings.privacyMode ? 'Limit' : meter.label}: ${Math.round(remaining)}% left${meter.resetsAt ? `. Resets ${new Date(meter.resetsAt).toLocaleString()}` : ''}.`,
        });
        // One alert at the most severe crossed level, rather than two at once.
        entry.sent = [...new Set([...entry.sent, ...thresholds.filter(value => remaining <= value)])];
      }
      ledger[key] = entry;
      const reset = { window: meter.windowId ?? (meter.resetsAt === null ? null : String(meter.resetsAt)), resetsAt: meter.resetsAt,
        observedAt: meter.observedAt ?? account.updatedAt, usedPercent: meter.usedPercent };
      if (store.settings.resetAlerts && confirmedReset(resetLedger[key], reset) && !crossed.length) alerts.push({
        id: `reset:${key}:${reset.window}`, accountId: account.id, meterId: meter.id, ledgerKey: key, kind: 'reset',
        title: `${(store.settings.privacyMode ? privateAccountName(store.accounts, account.id) : accountName(account))} reset confirmed`, message: `${store.settings.privacyMode ? 'Limit' : meter.label}: a fresh provider reading reports a new allowance window.`,
      });
      resetLedger[key] = reset;
    }
  }
  return { store: { ...store, alertLedger: Object.fromEntries(Object.entries(ledger).slice(-6000)), resetLedger: Object.fromEntries(Object.entries(resetLedger).slice(-6000)) }, alerts };
}

export function badge(store: Store, now: number): { text: string; color: string } {
  const readings = store.accounts.flatMap(account => account.meters.filter(meter => meter.evidence === 'reported'
    && isFresh(account, meter, now, store.settings.refreshMinutes)).map(meter => ({ account, remaining: remainingPercent(meter) }))).filter((r): r is {account:Account;remaining:number} => r.remaining !== null);
  if (!readings.length) return { text: '', color: '#64748b' };
  const lowest = readings.reduce((a,b) => a.remaining <= b.remaining ? a : b);
  const threshold = alertThresholds(lowest.account,store.settings);
  const value = store.settings.displayMode === 'used' ? 100-lowest.remaining : lowest.remaining;
  return { text: `${Math.round(value)}%`, color: lowest.remaining <= threshold.critical ? '#dc5a52' : lowest.remaining <= threshold.warning ? '#b97819' : '#237c64' };
}
