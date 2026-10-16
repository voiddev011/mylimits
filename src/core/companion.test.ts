import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore, isFresh } from './model';
import { mergeCompanion, type CompanionProfile } from './companion';
import { applySnapshot, markProvider } from './engine';
const now = 1800000000000;
const profile: CompanionProfile = { id: '1f30feba-2b2a-4c19-8ebc-cd35bc96ff71', status: 'active', plan: 'plus', updatedAt: now, meters: [{ id: 'codex-primary', label: 'Codex · 5h', scope: 'work-codex', evidence: 'reported', usedPercent: 65, used: null, total: null, unit: 'percent', resetsAt: now + 3600000, source: 'OpenAI Codex App Server' }] };
test('companion account merge retains nicknames, settings and independent active accounts', () => {
  const profiles = [profile, { ...profile, id: '6c7b581a-333d-4016-955e-98e84dcf22aa' }];
  const store = mergeCompanion(emptyStore('test'), profiles, now);
  store.accounts[0]!.alias = 'My work'; store.accounts[0]!.alertRemaining = 30;
  const next = mergeCompanion(store, profiles.map(item => ({ ...item, updatedAt: now + 60000 })), now + 60000);
  assert.equal(next.accounts[0]!.alias, 'My work'); assert.equal(next.accounts[0]!.alertRemaining, 30);
  assert.ok(next.accounts.every(account => account.connection === 'active'));
});
test('website refresh or logout does not deactivate companion identities', () => {
  const store = mergeCompanion(emptyStore('test'), [profile], now);
  const refreshed = applySnapshot(store, 'chatgpt', 'website-id', { kind: 'account', displayName: 'Website account', plan: null, meters: [] }, now);
  const signedOut = markProvider(refreshed, 'chatgpt', 'signed-out', 'Website logout', now);
  assert.equal(signedOut.accounts.find(account => account.companionProfile)!.connection, 'active');
  assert.equal(signedOut.accounts.find(account => account.id === 'website-id')!.connection, 'signed-out');
});
test('companion failure preserves reading age and cannot produce a fresh balance', () => {
  const store = mergeCompanion(emptyStore('test'), [profile], now);
  const next = mergeCompanion(store, [{ ...profile, status: 'unavailable' }], now + 60000);
  assert.equal(next.accounts[0]!.updatedAt, now);
  assert.equal(isFresh(next.accounts[0]!, profile.meters[0]!, now + 60000, 5), false);
  assert.equal(mergeCompanion(next, [], now).accounts[0]!.connection, 'inactive');
});
test('a cold companion restart retains the prior dated reading until a new read succeeds', () => {
  const store = mergeCompanion(emptyStore('test'), [profile], now);
  const next = mergeCompanion(store, [{ ...profile, status: 'unavailable', updatedAt: 0, meters: [], plan: null }], now + 60000);
  assert.equal(next.accounts[0]!.updatedAt, now);
  assert.deepEqual(next.accounts[0]!.meters, store.accounts[0]!.meters);
  assert.equal(next.accounts[0]!.connection, 'unavailable');
});

test('late native snapshots cannot recreate a deliberately forgotten account',async()=>{
 const {forgetAccount}=await import('./actions');
 const connected=mergeCompanion(emptyStore('test'),[profile],now);
 const forgotten=forgetAccount(connected,connected.accounts[0]!.id);
 const late=mergeCompanion(forgotten,[{...profile,updatedAt:now+1000}],now+1000);
 assert.equal(late.accounts.length,0);assert.equal(late.snapshots.length,0);
});
