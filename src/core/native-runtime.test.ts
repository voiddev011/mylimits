import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeRuntime } from './native-runtime';
test('partial browser namespace falls back to Chrome native messaging', () => {
  const chrome: { connectNative?: () => string } = { connectNative: () => 'port' };
  assert.equal(nativeRuntime(chrome, {}), chrome);
  assert.equal(nativeRuntime(undefined, chrome), chrome);
});
test('missing native API explains reload instead of throwing a TypeError', () => {
  assert.throws(() => nativeRuntime({}, {}), /Reload MyLimits/);
});
