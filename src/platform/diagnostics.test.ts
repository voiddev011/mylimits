import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestDiagnostics, REQUEST_DIAGNOSTICS_KEY, REQUEST_DIAGNOSTICS_LIMIT, responseMetadata, sanitizeDiagnostic,
  type DiagnosticInput, type DiagnosticStorage } from './diagnostics';

const NOW = 1792700000000;
const input: DiagnosticInput = { provider: 'claude', path: '/api/organizations/private-workspace/usage?token=PRIVATE',
  transport: 'background', status: 403, lastSuccessAt: NOW - 60000 };
class Memory implements DiagnosticStorage {
  values: Record<string, unknown> = {};
  async get(key: string) { return { [key]: structuredClone(this.values[key]) }; }
  async set(values: Record<string, unknown>) { Object.assign(this.values, structuredClone(values)); }
}

test('request diagnostics redact headers, bodies, identities, URL queries and unknown fields at construction', () => {
  const secret = 'DO_NOT_COPY_CREDENTIAL';
  const response = new Response(JSON.stringify({ accessToken: secret }), { status: 403, headers: {
    'Content-Type': `text/html; secret=${secret}`, 'CF-Mitigated': 'challenge', 'Retry-After': '120',
    'Set-Cookie': `sessionKey=${secret}`, Authorization: `Bearer ${secret}`,
  } });
  const entry = sanitizeDiagnostic({ ...input, ...responseMetadata(response), headers: { Authorization: secret }, body: secret,
    cookieNames: ['sessionKey', secret], cookies: [{ name: 'sessionKey', value: secret }], error: secret }, NOW)!;
  assert.equal(entry.path, '/api/organizations/:organization/usage');
  assert.equal(entry.contentType, 'text/html'); assert.equal(entry.cfMitigated, 'challenge'); assert.equal(entry.retryAfter, '120');
  assert.deepEqual(entry.cookieNames, ['sessionKey']); assert.equal(entry.timeSinceLastSuccessMs, 60000);
  assert.equal(entry.sessionCookieState, 'unknown'); assert.equal(entry.tabAvailable, null);
  const saved = JSON.stringify(entry);
  for (const forbidden of [secret, 'private-workspace', 'PRIVATE', 'accessToken', 'Set-Cookie', 'Authorization', 'ciphertext']) assert.ok(!saved.includes(forbidden));
});

test('diagnostics accept only known providers, transports, endpoints and safe retry metadata', () => {
  assert.equal(sanitizeDiagnostic({ ...input, provider: 'secret-user' }, NOW), null);
  assert.equal(sanitizeDiagnostic({ ...input, transport: 'secret-user' }, NOW), null);
  const entry = sanitizeDiagnostic({ ...input, path: 'https://example.test/private', status: 999, contentType: 'SECRET',
    cfMitigated: 'SECRET', retryAfter: 'SECRET', lastSuccessAt: NOW + 1 }, NOW)!;
  assert.equal(entry.path, '/redacted'); assert.equal(entry.status, 0); assert.equal(entry.contentType, 'other');
  assert.equal(entry.retryAfter, null); assert.equal(entry.cfMitigated, null); assert.equal(entry.timeSinceLastSuccessMs, null);
  assert.equal(sanitizeDiagnostic({ ...input, retryAfter: 'Fri, 23 Oct 2026 12:00:00 GMT' }, NOW)!.retryAfter, 'Fri, 23 Oct 2026 12:00:00 GMT');
  assert.deepEqual(sanitizeDiagnostic({ ...input, provider: 'chatgpt', path: '/api/auth/session', cookieNames: [
    '__Secure-next-auth.session-token.0', '__Secure-next-auth.session-token.1', 'sessionKey', 'sessionKey=SECRET',
  ] }, NOW)!.cookieNames, ['__Secure-next-auth.session-token.0', '__Secure-next-auth.session-token.1']);
});

test('parallel request records are serialized, bounded to 200 and survive a service-worker instance restart', async () => {
  const storage = new Memory(); let clock = NOW;
  const buffer = createRequestDiagnostics({ storage, now: () => clock++ });
  await Promise.all(Array.from({ length: 215 }, () => buffer.record(input)));
  const entries = await buffer.list(); assert.equal(entries.length, REQUEST_DIAGNOSTICS_LIMIT); assert.equal(entries[0]!.at, NOW + 15);
  assert.equal(entries.at(-1)!.at, NOW + 214);
  const restarted = createRequestDiagnostics({ storage, now: () => clock++ });
  assert.deepEqual(await restarted.list(), entries);
  entries[0]!.cookieNames.push('MUTATED');
  assert.ok(!JSON.stringify(await buffer.list()).includes('MUTATED'));
});

test('unavailable session storage uses bounded memory and never falls back to persistent local storage', async () => {
  for (const storage of [undefined, { get: async () => { throw new Error('Unavailable'); }, set: async () => { throw new Error('Unavailable'); } }]) {
    const buffer = createRequestDiagnostics({ storage, now: () => NOW });
    await buffer.record(input); assert.equal((await buffer.list()).length, 1);
  }
  const storage = new Memory(); storage.set = async () => { throw new Error('Quota exceeded'); };
  const buffer = createRequestDiagnostics({ storage, now: () => NOW });
  await buffer.record(input); await buffer.record({ ...input, transport: 'page', status: 0, tabAvailable: false, pageFallbackRan: true });
  assert.equal((await buffer.list()).length, 2);
  assert.equal((await buffer.list())[1]!.tabAvailable, false);
});

test('session-storage reads are sanitized too, and discard corrupt or unknown entries', async () => {
  const storage = new Memory();
  storage.values[REQUEST_DIAGNOSTICS_KEY] = [{ ...input, at: NOW, body: 'STORED_SECRET', contentType: 'STORED_SECRET', retryAfter: 'STORED_SECRET' },
    null, { ...input, at: -1 }, { provider: 'BAD' }];
  const buffer = createRequestDiagnostics({ storage });
  const entries = await buffer.list(); assert.equal(entries.length, 1); assert.ok(!JSON.stringify(entries).includes('STORED_SECRET'));
  await buffer.record(input); assert.ok(!JSON.stringify(storage.values).includes('STORED_SECRET'));
});

test('a missing or future last-success time stays unknown instead of suggesting successful freshness', async () => {
  const buffer = createRequestDiagnostics({ now: () => NOW });
  await buffer.record({ ...input, lastSuccessAt: null }); await buffer.record({ ...input, lastSuccessAt: NOW + 100 });
  assert.deepEqual((await buffer.list()).map(e => e.timeSinceLastSuccessMs), [null, null]);
});
