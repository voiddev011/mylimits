import { changeConnection } from './connections';
import type { Account, AccountSetup, ConnectionRecord, ProviderId, Store } from './model';
import { vaultId,websiteId } from './connection-id';

export function setupConnectionId(setup:AccountSetup):string|null{
 if(setup.method!=='private')return websiteId(setup.provider);
 if(!setup.slotId)return null;
 try{return vaultId(setup.provider,setup.slotId);}catch{return null;}
}

/** Setup stores labels and identity references only, never credentials. */
export function startAccountSetup(store: Store, provider: ProviderId, mode: AccountSetup['mode'], nickname: string, id: string, now: number,options:Pick<AccountSetup,'method'|'slotId'>={}): Store {
  const method=options.method??'ambient';
  if(method==='ambient'&&store.accountSetup?.method==='private')throw new Error('Finish or cancel saved sign-in setup first.');
  if (provider === 'gemini' || method==='ambient'&&store.providers[provider].readingMode === 'activity') {
    throw new Error('This source observes browser activity, not separate account identities. Choose account quota tracking first.');
  }
  const connectionId=method==='private'&&options.slotId?vaultId(provider,options.slotId):websiteId(provider);
  const connection=store.connections.find(c=>c.id===connectionId&&c.provider===provider);
  if(method==='private'&&(!options.slotId||connection?.kind!=='vault'))throw new Error('Saved sign-in setup is not available for this slot.');
  if (method==='ambient'&&mode === 'another' && !store.providers[provider].activeAccountId) {
    throw new Error('Detect your current account first, then add another.');
  }
  // A different Claude account may have an entirely different workspace list.
  // Invalidate in-flight work without bypassing a persisted retry/cooldown.
  const next = mode === 'another' ? changeConnection(store, connectionId, {workspaceId:null}, true) : store;
  return { ...next, accountSetup: { id, provider, mode, nickname: nickname.trim(), startedAt: now,
    previousAccountId: method==='ambient'?store.providers[provider].activeAccountId:connection?.accountId??null,method,...(method==='private'?{slotId:options.slotId}:{}) } };
}

export function setupCandidate(store: Pick<Store, 'accounts' | 'providers' | 'accountSetup'> & { connections: Pick<ConnectionRecord,'id'|'accountId'|'enabled'|'status'|'lastSuccessAt'>[] }): Account | null {
  const setup = store.accountSetup;
  if (!setup) return null;
  if(setup.method==='private'&&setup.phase==='awaiting-confirmation'&&setup.candidate){
    const c=setup.candidate;
    return {id:c.accountId,provider:setup.provider,kind:'account',alias:setup.nickname,defaultName:c.name,plan:c.plan,connection:'inactive',meters:[],createdAt:setup.startedAt,updatedAt:c.verifiedAt,alertRemaining:null,alertsMuted:false};
  }
  const connection = store.connections.find(c => c.id === setupConnectionId(setup));
  const account = store.accounts.find(a => a.id === connection?.accountId && a.provider === setup.provider && a.kind === 'account');
  if (!connection?.enabled || connection.status !== 'active' || !account || account.connection !== 'active'
    || (setup.method!=='private'&&store.providers[setup.provider].activeAccountId !== account.id)
    || (connection.lastSuccessAt ?? 0) < setup.startedAt
    || (setup.mode === 'another' && account.id === setup.previousAccountId)) return null;
  return account;
}

export function saveAccountSetup(store: Store, setupId: string, accountId: string): Store {
  const setup = store.accountSetup;
  const candidate = setupCandidate(store);
  if (!setup || setup.method==='private'&&!!setup.phase || setup.id !== setupId || !candidate || candidate.id !== accountId) {
    throw new Error('The detected account changed or is not ready. Check the website account and refresh again.');
  }
  return { ...store, accountSetup: null, accounts: store.accounts.map(a => a.id === accountId
    ? { ...a, alias: setup.nickname || a.alias } : a) };
}
