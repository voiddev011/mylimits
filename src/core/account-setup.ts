import { changeConnection } from './connections';
import type { Account, AccountSetup, ConnectionRecord, ProviderId, Store } from './model';

/** Setup stores labels and identity references only, never credentials. */
export function startAccountSetup(store: Store, provider: ProviderId, mode: AccountSetup['mode'], nickname: string, id: string, now: number): Store {
  if (provider === 'gemini' || store.providers[provider].readingMode === 'activity') {
    throw new Error('This source observes browser activity, not separate account identities. Choose account quota tracking first.');
  }
  if (mode === 'another' && !store.providers[provider].activeAccountId) {
    throw new Error('Detect your current account first, then add another.');
  }
  // A different Claude account may have an entirely different workspace list.
  // Invalidate in-flight work without bypassing a persisted retry/cooldown.
  const next = mode === 'another' ? changeConnection(store, `website:${provider}`, {workspaceId:null}, true) : store;
  return { ...next, accountSetup: { id, provider, mode, nickname: nickname.trim(), startedAt: now,
    previousAccountId: store.providers[provider].activeAccountId } };
}

export function setupCandidate(store: Pick<Store, 'accounts' | 'providers' | 'accountSetup'> & { connections: Pick<ConnectionRecord,'id'|'accountId'|'enabled'|'status'|'lastSuccessAt'>[] }): Account | null {
  const setup = store.accountSetup;
  if (!setup) return null;
  const connection = store.connections.find(c => c.id === `website:${setup.provider}`);
  const account = store.accounts.find(a => a.id === connection?.accountId && a.provider === setup.provider && a.kind === 'account');
  if (!connection?.enabled || connection.status !== 'active' || !account || account.connection !== 'active'
    || store.providers[setup.provider].activeAccountId !== account.id
    || (connection.lastSuccessAt ?? 0) < setup.startedAt
    || (setup.mode === 'another' && account.id === setup.previousAccountId)) return null;
  return account;
}

export function saveAccountSetup(store: Store, setupId: string, accountId: string): Store {
  const setup = store.accountSetup;
  const candidate = setupCandidate(store);
  if (!setup || setup.id !== setupId || !candidate || candidate.id !== accountId) {
    throw new Error('The detected account changed or is not ready. Check the website account and refresh again.');
  }
  return { ...store, accountSetup: null, accounts: store.accounts.map(a => a.id === accountId
    ? { ...a, alias: setup.nickname || a.alias } : a) };
}
