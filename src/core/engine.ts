import { type Account, type Meter, type ProviderId, type Store, accountName, alertThresholds, isFresh, remainingPercent } from './model';

export interface Snapshot {
  identity: string;
  kind: Account['kind'];
  displayName: string;
  plan: string | null;
  meters: Meter[];
}

export async function accountId(provider: ProviderId, identity: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}\u0000${provider}\u0000${identity}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${provider}:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function applySnapshot(store: Store, provider: ProviderId, id: string, snapshot: Omit<Snapshot, 'identity'>, now: number): Store {
  const previous = store.accounts.find(account => account.id === id);
  const localMeters = (previous?.meters ?? []).filter(meter => meter.evidence === 'observed');
  const incomingIds = new Set(snapshot.meters.map(meter => meter.id));
  const account: Account = {
    id, provider, kind: snapshot.kind,
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
  return {
    ...store,
    accounts: [...store.accounts.filter(item => item.id !== id).map(item => (
      item.provider === provider && !item.companionProfile ? { ...item, connection: 'inactive' as const } : item
    )), account],
    providers: { ...store.providers, [provider]: {
      enabled: true, status: 'active', activeAccountId: id, checkedAt: now,
      message: snapshot.meters.some(meter => meter.evidence === 'reported') ? null : 'Only activity observed in this browser is available.',
      failures: 0, nextRetryAt: null,
    } },
  };
}

export function markProvider(store: Store, provider: ProviderId, status: Exclude<Store['providers'][ProviderId]['status'], 'checking' | 'active'>, message: string, now: number): Store {
  return {
    ...store,
    accounts: store.accounts.map(account => account.provider === provider && !account.companionProfile && account.connection === 'active'
      ? { ...account, connection: status === 'disabled' ? 'inactive' as const : status }
      : account),
    providers: { ...store.providers, [provider]: {
      ...store.providers[provider], status, activeAccountId: null, checkedAt: now, message,
    } },
  };
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
    source: 'This browser only. Request count is not an account quota.',
  };
  return { ...store,
    accounts: store.accounts.map(item => item.id === id ? { ...item, meters: [...item.meters.filter(m => m.id !== meter.id), meter] } : item),
    observationLedger: [...store.observationLedger, eventId].slice(-300),
  };
}

export interface LimitAlert { id: string; title: string; message: string; accountId: string; meterId: string; }
export function collectAlerts(store: Store, now: number): { store: Store; alerts: LimitAlert[] } {
  if (!store.settings.desktopAlerts) return { store, alerts: [] };
  const ledger = structuredClone(store.alertLedger);
  const alerts: LimitAlert[] = [];
  for (const account of store.accounts) {
    if (account.alertsMuted) continue;
    for (const meter of account.meters) {
      if (meter.evidence !== 'reported' || !isFresh(account, meter, now, store.settings.refreshMinutes)) continue;
      const remaining = remainingPercent(meter);
      if (remaining === null) continue;
      const key = `${account.id}/${meter.id}`;
      const window = meter.resetsAt === null ? 'unknown' : String(meter.resetsAt);
      const prior = ledger[key];
      const entry = prior?.window === window ? { window, sent: [...prior.sent] } : { window, sent: [] as number[] };
      const configured = alertThresholds(account, store.settings);
      const thresholds = [...new Set([configured.warning, configured.critical])].sort((a, b) => a - b);
      // A quota with no published reset can rearm after a meaningful recovery.
      if (meter.resetsAt === null) entry.sent = entry.sent.filter(threshold => remaining < threshold + 5);
      const crossed = thresholds.filter(threshold => remaining <= threshold && !entry.sent.includes(threshold));
      if (crossed.length) {
        const threshold = crossed[0]!;
        alerts.push({ id: `limit:${key}:${window}:${threshold}`, accountId: account.id, meterId: meter.id,
          title: `${accountName(account)} is running low`,
          message: `${meter.label}: ${Math.round(remaining)}% left${meter.resetsAt ? `. Resets ${new Date(meter.resetsAt).toLocaleString()}` : ''}.`,
        });
        // One alert at the most severe crossed level, rather than two at once.
        entry.sent = [...new Set([...entry.sent, ...thresholds.filter(value => remaining <= value)])];
      }
      ledger[key] = entry;
    }
  }
  return { store: { ...store, alertLedger: ledger }, alerts };
}

export function badge(store: Store, now: number): { text: string; color: string } {
  const readings = store.accounts.flatMap(account => account.meters.filter(meter => meter.evidence === 'reported'
    && isFresh(account, meter, now, store.settings.refreshMinutes)).map(meter => remainingPercent(meter))).filter((value): value is number => value !== null);
  if (!readings.length) return { text: '', color: '#64748b' };
  const lowest = Math.min(...readings);
  return { text: `${Math.round(lowest)}%`, color: lowest <= store.settings.criticalRemaining ? '#dc5a52' : lowest <= store.settings.warningRemaining ? '#b97819' : '#237c64' };
}
