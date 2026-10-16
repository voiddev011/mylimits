import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore } from './model';
import { enableWebsite } from './actions';
import { applySnapshot } from './engine';
import { startAccountSetup, saveAccountSetup, setupCandidate } from './account-setup';
import { StoreSchema } from './schema';
import { toPublicState } from './public';

const now = 1_800_000_000_000;
const setupId = '1f30feba-2b2a-4c19-8ebc-cd35bc96ff71';
const snapshot = {kind:'account' as const,displayName:'Verified Claude account',plan:null,meters:[]};
const initial = () => applySnapshot(enableWebsite(emptyStore('fixture'), 'claude', true), 'claude', 'account-a', snapshot, now);

test('another-account setup survives storage and never renames the original login', () => {
  let store = initial(); store.accounts[0]!.alias = 'Personal';
  store = startAccountSetup(store, 'claude', 'another', 'Work', setupId, now + 1);
  store = StoreSchema.parse(JSON.parse(JSON.stringify(store)));
  store = applySnapshot(store, 'claude', 'account-a', snapshot, now + 2);
  assert.equal(setupCandidate(store), null);
  assert.throws(() => saveAccountSetup(store, setupId, 'account-a'), /changed or is not ready/);
  assert.equal(store.accounts[0]!.alias, 'Personal');
  assert.equal(toPublicState(store).accountSetup!.nickname, 'Work');
});

test('a verified second account can be named while the first keeps its nickname and reading date', () => {
  let store = initial(); store.accounts[0]!.alias = 'Personal';
  store = startAccountSetup(store, 'claude', 'another', 'Work', setupId, now + 1);
  store = applySnapshot(store, 'claude', 'account-b', snapshot, now + 2);
  assert.equal(setupCandidate(store)!.id, 'account-b');
  const saved = saveAccountSetup(store, setupId, 'account-b');
  assert.equal(saved.accountSetup, null);
  assert.equal(saved.accounts.length, 2);
  assert.equal(saved.accounts.find(a => a.id === 'account-b')!.alias, 'Work');
  assert.equal(saved.accounts.find(a => a.id === 'account-a')!.alias, 'Personal');
  assert.equal(saved.accounts.find(a => a.id === 'account-a')!.updatedAt, now);
  assert.equal(saved.accounts.find(a => a.id === 'account-a')!.connection, 'inactive');
});

test('saving rejects an old setup, a switched identity, a disabled connection and stale pre-setup readings', () => {
  const store = startAccountSetup(initial(), 'claude', 'detect', 'Renamed', setupId, now + 1);
  assert.equal(setupCandidate(store), null);
  const checked = applySnapshot(store, 'claude', 'account-b', snapshot, now + 2);
  assert.throws(() => saveAccountSetup(checked, 'different-setup', 'account-b'));
  assert.throws(() => saveAccountSetup(checked, setupId, 'account-a'));
  assert.equal(setupCandidate(enableWebsite(checked, 'claude', false)), null);
  checked.connections[0]!.status = 'needs-auth';
  assert.equal(setupCandidate(checked), null);
});

test('local activity cannot masquerade as another account; current account must be detected first', () => {
  assert.throws(() => startAccountSetup(emptyStore('test'), 'gemini', 'detect', '', setupId, now), /browser activity/);
  assert.throws(() => startAccountSetup(emptyStore('test'), 'chatgpt', 'another', '', setupId, now), /Detect your current account first/);
  const store = emptyStore('test'); store.providers.grok.readingMode = 'activity';
  assert.throws(() => startAccountSetup(store, 'grok', 'another', '', setupId, now), /browser activity/);
});

test('blank setup nickname preserves an existing alias and old V2 stores stay compatible', () => {
  let store = initial(); store.accounts[0]!.alias = 'Keep me';
  assert.equal(StoreSchema.parse(store).accountSetup, undefined);
  store = startAccountSetup(store, 'claude', 'detect', '', setupId, now + 1);
  store = applySnapshot(store, 'claude', 'account-a', snapshot, now + 2);
  assert.equal(saveAccountSetup(store, setupId, 'account-a').accounts[0]!.alias, 'Keep me');
});

test('another account clears the previous workspace and invalidates reads without bypassing backoff', () => {
  const store = initial();
  const connection = store.connections.find(c => c.id === 'website:claude')!;
  connection.workspaceId = 'previous-workspace'; connection.nextRetryAt = now + 60_000;
  const next = startAccountSetup(store, 'claude', 'another', 'Work', setupId, now + 1);
  const current = next.connections.find(c => c.id === connection.id)!;
  assert.equal(current.workspaceId, null);
  assert.equal(current.generation, connection.generation + 1);
  assert.equal(current.nextRetryAt, connection.nextRetryAt);
  assert.equal(current.lastAttemptAt, connection.lastAttemptAt);
});
