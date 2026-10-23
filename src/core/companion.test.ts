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

test('v2 metadata survives storage and preserves existing IDs, aliases and dated history', async () => {
 const {StoreSchema}=await import('./schema');
 const store=mergeCompanion(emptyStore('test'),[profile],now);
 store.accounts[0]!.alias='Existing alias';
 const independent={provider:'openai' as const,alias:'Service alias',authState:'connected' as const,identityConfidence:'email-only' as const,providerSubject:null,workspaceIdentity:null,capability:'work-codex' as const,lastAttemptAt:now,providerObservedAt:null,nextRetryAt:now+120000,failures:0,errorCode:null,possibleDuplicate:false};
 const next=StoreSchema.parse(mergeCompanion(store,[{...profile,independent}],now+1000));
 assert.equal(next.accounts[0]!.id,store.accounts[0]!.id);
 assert.equal(next.accounts[0]!.alias,'Existing alias');
 assert.equal(next.snapshots[0]!.observedAt,now);
 assert.equal(next.connections.find(c=>c.kind==='companion')!.independent!.providerObservedAt,null);
 assert.equal(next.connections.find(c=>c.kind==='companion')!.nextRetryAt,now+120000);
});
test('v2 disconnect retains remembered readings and reconnect restores same account', () => {
 const independent={provider:'openai' as const,alias:'Work',authState:'disconnected' as const,identityConfidence:'email-only' as const,providerSubject:null,workspaceIdentity:null,capability:'work-codex' as const,lastAttemptAt:now,providerObservedAt:null,nextRetryAt:null,failures:0,errorCode:null,possibleDuplicate:false};
 const store=mergeCompanion(emptyStore('test'),[profile],now);
 const disconnected=mergeCompanion(store,[{...profile,status:'signed-out',independent}],now+1000);
 assert.equal(disconnected.accounts[0]!.connection,'inactive');
 assert.equal(disconnected.accounts[0]!.updatedAt,now);
 const restored=mergeCompanion(disconnected,[{...profile,updatedAt:now+2000,independent:{...independent,authState:'connected'}}],now+2000);
 assert.equal(restored.accounts.length,1);assert.equal(restored.accounts[0]!.connection,'active');assert.equal(restored.accounts[0]!.updatedAt,now+2000);
});

test('mixed native providers preserve OpenAI namespace and create separate Claude accounts',()=>{
 const independent={provider:'claude' as const,alias:'Claude Work',authState:'connected' as const,identityConfidence:'email-and-organization' as const,providerSubject:null,workspaceIdentity:'claude-org',capability:'subscription' as const,lastAttemptAt:now,providerObservedAt:null,nextRetryAt:now+300000,failures:0,errorCode:null,possibleDuplicate:false};
 const claude={...profile,id:'6c7b581a-333d-4016-955e-98e84dcf22aa',independent,meters:profile.meters.map(m=>({...m,scope:'subscription' as const}))};
 const store=mergeCompanion(emptyStore('test'),[profile,claude],now);
 assert.equal(store.accounts.find(a=>a.id.startsWith('openai-companion:'))!.provider,'chatgpt');
 assert.equal(store.accounts.find(a=>a.id.startsWith('claude-companion:'))!.provider,'claude');
 assert.equal(store.accounts.find(a=>a.provider==='claude')!.alias,'Claude Work');
 assert.equal(store.connections.find(c=>c.provider==='claude'&&c.kind==='companion')!.independent!.workspaceIdentity,'claude-org');
});
test('native status delivery preserves an unknown attempt time instead of postponing eligible refresh',()=>{
 const independent={provider:'openai' as const,alias:'Work',authState:'connected' as const,identityConfidence:'email-only' as const,providerSubject:null,workspaceIdentity:null,capability:'work-codex' as const,lastAttemptAt:null,providerObservedAt:null,nextRetryAt:null,failures:0,errorCode:null,possibleDuplicate:false};
 const store=mergeCompanion(emptyStore('test'),[{...profile,independent}],now);
 const next=mergeCompanion(store,[{...profile,independent}],now+60000);
 assert.equal(next.connections.find(c=>c.kind==='companion')!.lastAttemptAt,null);
 assert.equal(next.accounts[0]!.updatedAt,now);
});
