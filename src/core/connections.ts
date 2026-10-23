import { accountName, type Account, type ConnectionRecord, type Connection, type Store, type UsageSnapshot } from './model';
import { UsageSnapshotSchema } from './schema';
export function legacyStatus(status: ConnectionRecord['status']): Connection {
  return status === 'needs-auth' ? 'signed-out' : status === 'needs-tab' ? 'waiting-for-tab' : status === 'disabled' ? 'inactive' : status === 'checking' ? 'active' : status;
}
// Accounts contain a materialized read projection, rebuilt only by this reconciler.
// Connection snapshots remain the authority for source-bound readings.
export function projectAccounts(store: Store): Store {
  const accounts = store.accounts.map(account => {
    const sources = store.connections.filter(c => c.accountId === account.id);
    const readings = store.snapshots.filter(s => s.accountId === account.id);
    if (!readings.length) return account;
    const live = (s: UsageSnapshot) => sources.some(c => c.id === s.connectionId && c.workspaceId === s.workspaceId && c.enabled && ['active','checking'].includes(c.status));
    const sorted = [...readings].sort((a,b) => Number(live(b))-Number(live(a)) || b.observedAt-a.observedAt);
    const chosen = sorted[0]!;
    const connection = sources.find(c => c.id === chosen.connectionId);
    const seen = new Set<string>();
    const meters = sorted.filter(s => live(chosen) ? live(s) : true).flatMap(s => s.meters.map(m => ({ ...m, observedAt: m.observedAt ?? s.observedAt, connectionId: s.connectionId })))
      .filter(m => { const key = `${m.scope}/${m.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
    return { ...account, meters, workspaceId: chosen.workspaceId, updatedAt: chosen.observedAt,
      connection: connection ? legacyStatus(connection.status) : 'inactive' as const };
  });
  return { ...store, accounts };
}
export function acceptSnapshot(store: Store, raw: UsageSnapshot, generation: number, now: number): { store: Store; accepted: boolean } {
  const snapshot = UsageSnapshotSchema.parse(raw,{jitless:true});
  const conn = store.connections.find(c => c.id === snapshot.connectionId);
  if (!conn?.enabled || conn.generation !== generation || conn.provider !== snapshot.providerId
    || snapshot.observedAt > now + 60_000 || snapshot.receivedAt > now + 60_000
    || !store.accounts.some(a => a.id === snapshot.accountId && a.provider === snapshot.providerId)) return { store, accepted: false };
  const old = store.snapshots.find(s => s.connectionId === conn.id && s.accountId === snapshot.accountId && s.workspaceId === snapshot.workspaceId);
  if (old && old.observedAt >= snapshot.observedAt) return { store, accepted: false };
  const next: Store = { ...store, snapshots: [...store.snapshots.filter(s => s !== old), snapshot].slice(-400),
    connections: store.connections.map(c => c.id === conn.id ? { ...c, accountId: snapshot.accountId, workspaceId: snapshot.workspaceId,
      status: 'active', lastSuccessAt: snapshot.observedAt, nextRetryAt: null, failures: 0, authFailures:0, message: null,
      generation: c.accountId && c.accountId !== snapshot.accountId ? c.generation + 1 : c.generation } : c) };
  // A website rebind leaves prior readings remembered, while other independent sources remain active.
  return { store: projectAccounts(next), accepted: true };
}
export function changeConnection(store: Store, id: string, patch: Partial<ConnectionRecord>, invalidate = false): Store {
  return projectAccounts({ ...store, connections: store.connections.map(c => c.id === id ? { ...c, ...patch, generation: c.generation + (invalidate ? 1 : 0) } : c) });
}
export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a,b) => Number(!!b.pinned)-Number(!!a.pinned) || (a.order ?? 0)-(b.order ?? 0) || accountName(a).localeCompare(accountName(b)));
}
