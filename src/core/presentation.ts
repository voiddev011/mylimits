import { accountStatus, type Account, type Settings,type ConnectionKind } from './model';
import type { PublicState } from './public';

/** Account order and nicknames can change; privacy labels follow creation order. */
export function privateAccountName(accounts: Account[], id: string): string {
  const ordered = [...accounts].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return `Account ${ordered.findIndex(a => a.id === id) + 1}`;
}
export function privatePresentation(store: PublicState): PublicState {
  const copy = structuredClone(store);
  copy.accounts = copy.accounts.map(account => ({ ...account,
    alias: privateAccountName(store.accounts, account.id), defaultName: privateAccountName(store.accounts, account.id),
    meters: account.meters.map((meter, index) => ({ ...meter, label: `Limit ${index + 1}`, source: 'Provider reading' })),
  }));
  copy.workspaces = copy.workspaces.map((workspace, index) => ({ ...workspace, name: `Workspace ${index + 1}` }));
  copy.connections = copy.connections.map(connection => ({ ...connection, message: null }));
  for (const provider of Object.values(copy.providers)) provider.message = null;
  if (copy.accountSetup) copy.accountSetup.nickname = '';
  return copy;
}
export function needsAttention(account: Account, settings: Settings, now: number): boolean {
  return account.kind !== 'browser' && accountStatus(account, now, settings.refreshMinutes) !== 'Current';
}
export function accountStatusText(account:Account,store:PublicState,now:number):string{
  const recovering=store.connections.some(c=>c.kind==='website'&&c.accountId===account.id&&c.enabled&&c.status==='checking'&&c.message==='Retrying in the background');
  return recovering?'Retrying in the background':accountStatus(account,now,store.settings.refreshMinutes);
}
export function connectionSource(kind:ConnectionKind):string{
 return kind==='website'?'Browser login':kind==='vault'?'Saved sign-in':kind==='companion'?'Companion':kind==='independent-local'?'Desktop':kind==='cloud'?'Hosted':'Saved reading';
}
export function accountSource(account:Account,store:PublicState):string{
 const sources=store.connections.filter(c=>c.accountId===account.id);
 const source=sources.find(c=>c.enabled&&['active','checking'].includes(c.status)&&account.meters.some(m=>m.connectionId===c.id))
  ??sources.find(c=>c.enabled&&['active','checking'].includes(c.status))
  ??sources.find(c=>account.meters.some(m=>m.connectionId===c.id))??sources[0];
 return source?connectionSource(source.kind):'Saved reading';
}
/** Strict allowlist: no identifiers, names, free-form errors, URLs or readings. */
export function diagnostics(store: PublicState, version: string, now: number) {
  return { version, generatedAt: new Date(now).toISOString(), storageVersion: store.version,
    accountCount: store.accounts.length,
    connections: store.connections.map(connection => ({ provider: connection.provider, kind: connection.kind,
      status: connection.status, enabled: connection.enabled, failures: connection.failures,
      retryPending: (connection.nextRetryAt ?? 0) > now })),
    textSize: store.settings.textSize ?? 'standard', privacyMode: store.settings.privacyMode ?? false,
  };
}
