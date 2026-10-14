import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from './demo';
import { selectAccounts } from './overview';

const now = 1_800_000_000_000;
test('low filter excludes saved, expired, unknown and observed readings', () => {
  const store = demoState(now);
  const saved = store.accounts.find(account => account.connection === 'inactive')!;
  saved.meters[0].usedPercent = 99;
  assert.deepEqual(selectAccounts(store.accounts, store.settings, now, '', true, 'remaining').map(account => account.id), ['demo-gpt-work']);
  const active = store.accounts.find(account => account.id === 'demo-gpt-work')!;
  active.meters[0].evidence = 'observed';
  assert.equal(selectAccounts(store.accounts, store.settings, now, '', true, 'default').length, 0);
  active.meters[0].evidence = 'reported';
  active.meters[0].resetsAt = now;
  assert.equal(selectAccounts(store.accounts, store.settings, now, '', true, 'default').length, 0);
  active.meters[0].resetsAt = now + 3600_000;
  active.meters[0].usedPercent = null;
  assert.equal(selectAccounts(store.accounts, store.settings, now, '', true, 'default').length, 0);
});
test('search finds nickname or meter label and retains all matching account meters', () => {
  const store = demoState(now);
  assert.equal(selectAccounts(store.accounts, store.settings, now, ' personal ', false, 'name').length, 2);
  const weekly = selectAccounts(store.accounts, store.settings, now, 'weekly', false, 'name');
  assert.equal(weekly.length, 3);
  assert.equal(weekly.reduce((sum, account) => sum + account.meters.length, 0), 5);
});
test('remaining and reset sorting use fresh readings without mutating stored order', () => {
  const store = demoState(now);
  const before = store.accounts.map(account => account.id);
  for (const sort of ['remaining', 'reset'] as const) {
    assert.equal(selectAccounts(store.accounts, store.settings, now, '', false, sort)[0].id, 'demo-gpt-work');
  }
  assert.deepEqual(store.accounts.map(account => account.id), before);
  assert.equal(selectAccounts(store.accounts, store.settings, now + 86400_000, '', true, 'remaining').length, 0);
});
test('low filter respects each account warning threshold', () => {
  const store = demoState(now);
  store.accounts[0].alertRemaining = 50;
  assert.equal(selectAccounts(store.accounts, store.settings, now, '', true, 'default').length, 2);
});
