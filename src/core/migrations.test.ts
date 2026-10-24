import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore } from "./model";
import {
  initializeV2,
  migrateV1,
  STATE_V1,
  STATE_V2,
  ACTIVE_SCHEMA,
  BACKUP_V1,
} from "./migrations";
import { StoreSchema } from "./schema";
import { toPublicState } from "./public";
import { vaultId } from "./connection-id";
function legacy() {
  const s = emptyStore("keep-salt");
  const { cursor: _, copilot: _copilot, ...providers } = s.providers;
  return {
    ...s,
    providers: {
      ...providers,
      gemini: s.providers.claude,
      grok: s.providers.claude,
      perplexity: s.providers.claude,
    },
    version: 1,
    observationLedger: [],
    accounts: [
      {
        id: "old-hash",
        provider: "claude",
        kind: "account",
        alias: "Work",
        defaultName: "Account",
        plan: null,
        connection: "inactive",
        meters: [],
        createdAt: 1,
        updatedAt: 2,
        alertRemaining: 30,
        alertsMuted: true,
      },
    ],
  };
}
class Memory {
  values: Record<string, unknown> = {};
  writes = 0;
  fail = 0;
  async get(keys: string | string[]) {
    return Object.fromEntries(
      (typeof keys === "string" ? [keys] : keys).map((k) => [
        k,
        structuredClone(this.values[k]),
      ]),
    );
  }
  async set(items: Record<string, unknown>) {
    if (++this.writes === this.fail) throw new Error("quota exceeded");
    Object.assign(this.values, structuredClone(items));
  }
}
test("migration preserves old account identity, salt, aliases and preferences without inventing workspace", () => {
  const s = migrateV1(legacy());
  assert.equal(s.version, 2);
  assert.equal(s.installSalt, "keep-salt");
  assert.equal(s.accounts[0]!.id, "old-hash");
  assert.equal(s.accounts[0]!.alias, "Work");
  assert.equal(s.accounts[0]!.alertRemaining, 30);
  assert.equal(s.accounts[0]!.alertsMuted, true);
  assert.equal(s.accounts[0]!.workspaceId, null);
});
test("migration resumes after every interrupted storage write without duplicate snapshots or lost V1", async () => {
  for (let fail = 1; fail <= 5; fail++) {
    const m = new Memory();
    m.values[STATE_V1] = legacy();
    m.fail = fail;
    await assert.rejects(
      initializeV2(
        m,
        async () => {},
        () => "new",
      ),
    );
    assert.notEqual(m.values[ACTIVE_SCHEMA], 2);
    m.fail = 0;
    await initializeV2(
      m,
      async () => {},
      () => "wrong",
    );
    const s = m.values[STATE_V2] as ReturnType<typeof emptyStore>;
    assert.equal(s.accounts[0]!.alias, "Work");
    assert.equal(s.snapshots.length, 1);
    assert.deepEqual(m.values[BACKUP_V1], legacy());
    await initializeV2(
      m,
      async () => {},
      () => "wrong",
    );
    assert.equal((m.values[STATE_V2] as typeof s).snapshots.length, 1);
  }
});
test("history upgrade interruption leaves pointer uncommitted and can resume", async () => {
  const m = new Memory();
  m.values[STATE_V1] = legacy();
  await assert.rejects(
    initializeV2(
      m,
      async () => {
        throw new Error("database unavailable");
      },
      () => "new",
    ),
  );
  assert.equal(m.values[ACTIVE_SCHEMA], undefined);
  await initializeV2(
    m,
    async () => {},
    () => "new",
  );
  assert.equal(m.values[ACTIVE_SCHEMA], 2);
});
test("malformed, missing active state and unknown future versions fail without reset", async () => {
  const m = new Memory();
  m.values[STATE_V1] = { version: 1, installSalt: "keep" };
  await assert.rejects(
    initializeV2(
      m,
      async () => {},
      () => "x",
    ),
  );
  assert.equal(m.writes, 0);
  const n = new Memory();
  n.values[ACTIVE_SCHEMA] = 3;
  await assert.rejects(
    initializeV2(
      n,
      async () => {},
      () => "x",
    ),
  );
  assert.equal(n.writes, 0);
  const a = new Memory();
  a.values[ACTIVE_SCHEMA] = 2;
  await assert.rejects(
    initializeV2(
      a,
      async () => {},
      () => "x",
    ),
  );
  assert.equal(a.writes, 0);
});
test("V2 recovery setting defaults additively without changing IDs, aliases, snapshots or explicit opt-out", () => {
  const old = migrateV1(legacy());
  delete old.settings.autoRecoverTab;
  const parsed = StoreSchema.parse(old);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.settings.autoRecoverTab, true);
  assert.deepEqual(parsed.accounts, old.accounts);
  assert.deepEqual(parsed.snapshots, old.snapshots);
  assert.equal(parsed.installSalt, old.installSalt);
  assert.equal(
    StoreSchema.parse({
      ...old,
      settings: { ...old.settings, autoRecoverTab: false },
    }).settings.autoRecoverTab,
    false,
  );
});
test("V2 connection metadata adds vault and ambient setup defaults without exposing private profile fields", () => {
  const old = migrateV1(legacy()),
    parsed = StoreSchema.parse(old);
  assert.deepEqual(parsed.accounts, old.accounts);
  assert.deepEqual(parsed.snapshots, old.snapshots);
  const slot = "75cc9537-6b43-444a-8fbd-b383606b8d45";
  parsed.connections.push({
    ...parsed.connections[0]!,
    id: vaultId("claude", slot),
    kind: "vault",
    profileId: slot,
  });
  parsed.accountSetup = {
    id: "9696d962-eac8-41fa-a15c-a04e7c015c0d",
    provider: "claude",
    mode: "detect",
    nickname: "Keep alias",
    previousAccountId: null,
    startedAt: 1,
  };
  const next = StoreSchema.parse(parsed);
  assert.equal(next.version, 2);
  assert.equal(next.accountSetup!.method, "ambient");
  assert.ok(
    !(
      "profileId" in
      toPublicState(next).connections.find((c) => c.kind === "vault")!
    ),
  );
  assert.equal(
    StoreSchema.safeParse({
      ...next,
      accountSetup: { ...next.accountSetup, method: "private" },
    }).success,
    false,
  );
});
test("C10 V2 fields preserve identities, aliases and snapshots and default old auth counters additively", () => {
  const old = migrateV1(legacy()),
    raw = structuredClone(old);
  raw.connections.forEach((c) => {
    delete c.authFailures;
  });
  const parsed = StoreSchema.parse(raw);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.installSalt, old.installSalt);
  assert.deepEqual(parsed.accounts, old.accounts);
  assert.deepEqual(parsed.snapshots, old.snapshots);
  assert.ok(parsed.connections.every((c) => c.authFailures === 0));
  assert.equal(parsed.accountSetup, old.accountSetup);
  const slot = "75cc9537-6b43-444a-8fbd-b383606b8d45";
  parsed.accountSetup = {
    id: "9696d962-eac8-41fa-a15c-a04e7c015c0d",
    provider: "claude",
    mode: "detect",
    nickname: "Personal",
    previousAccountId: null,
    startedAt: 1,
    method: "private",
    slotId: slot,
    captureMethod: "private",
    phase: "awaiting-confirmation",
    candidate: {
      accountId: "verified-hash",
      name: "Fictional",
      plan: null,
      verifiedAt: 2,
    },
  };
  const next = StoreSchema.parse(parsed);
  assert.deepEqual(next.accountSetup, parsed.accountSetup);
  assert.deepEqual(next.snapshots, old.snapshots);
  assert.deepEqual(next.accounts, old.accounts);
});
test("C11 saved-sign-in metadata is additive and exposes only method/expiry while preserving history and aliases", () => {
  const old = migrateV1(legacy()),
    parsed = StoreSchema.parse(old);
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.accounts, old.accounts);
  assert.deepEqual(parsed.snapshots, old.snapshots);
  assert.equal(parsed.connections[0]!.savedSignIn, undefined);
  parsed.connections[0]!.savedSignIn = {
    method: "private",
    notAfter: 1800000000000,
  };
  const next = StoreSchema.parse(parsed);
  assert.deepEqual(next.accounts, old.accounts);
  assert.deepEqual(next.snapshots, old.snapshots);
  assert.deepEqual(toPublicState(next).connections[0]!.savedSignIn, {
    method: "private",
    notAfter: 1800000000000,
  });
  assert.equal(
    StoreSchema.safeParse({
      ...parsed,
      connections: [
        {
          ...parsed.connections[0],
          savedSignIn: {
            method: "private",
            notAfter: null,
            cookie: "FAKE_SECRET",
          },
        },
      ],
    }).success,
    false,
  );
});
