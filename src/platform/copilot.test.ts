import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  parseCopilot,
  copilotIdentity,
  parseCopilotCredits,
  parseCopilotQuotas,
} from "../core/copilot";
import { readCopilot } from "./copilot";
import { createTokenVault, TOKEN_KEY } from "./token-vault";
import { createCopilotAccounts, CopilotAccountError } from "./copilot-accounts";
import { emptyStore } from "../core/model";
import { StoreSchema } from "../core/schema";
import { toPublicState } from "../core/public";
import { diagnostics } from "../core/presentation";
import { exportReadings, historyPoint } from "../core/history-data";
import { shouldRefresh } from "../core/scheduler";
import { meterValue } from "../core/meter-display";
import { projectRememberedReset } from "../core/reset-projection";
import type { Store } from "../core/model";
const now = Date.UTC(2026, 9, 24),
  secret = "github_pat_FAKE_TEST_SECRET_12345",
  slot = "10000000-0000-4000-8000-000000000001";
const usage = (items: unknown[] = []) => ({
  user: "alice",
  timePeriod: { year: 2026, month: 10 },
  usageItems: items,
});
const row = (n: number) => ({
  product: "Copilot",
  unitType: "requests",
  grossQuantity: n,
  netQuantity: 0,
});
const response = (
  v: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(v), { status, headers });
test("Copilot sums gross quantities, excludes other products, preserves unknown allowance and empty month", () => {
  const parsed = parseCopilot(
    { id: "1", login: "alice" },
    usage([row(4), row(1.5), { product: "Other", grossQuantity: 80 }]),
    now,
    null,
  );
  assert.equal(parsed.meters[0]!.used, 5.5);
  assert.equal(parsed.meters[0]!.total, null);
  assert.equal(parsed.meters[0]!.usedPercent, null);
  assert.equal(parsed.meters[0]!.resetsAt, Date.UTC(2026, 10, 1));
  assert.equal(
    parseCopilot({ id: "1", login: "alice" }, usage(), now, 50).meters[0]!
      .remaining,
    50,
  );
  assert.throws(() =>
    parseCopilot({ id: "1", login: "bob" }, usage(), now, 50),
  );
  assert.throws(() =>
    parseCopilot({ id: "1", login: "alice" }, usage([row(-1)]), now, 50),
  );
  assert.throws(() =>
    parseCopilot(
      { id: "1", login: "alice" },
      { ...usage(), timePeriod: { year: 2026, month: 9 } },
      now,
      50,
    ),
  );
  assert.throws(() => copilotIdentity({ login: "alice", id: NaN }));
});
test("official REST only, explicit month, required headers, identity verified around usage", async () => {
  const calls: string[] = [];
  const reading = await readCopilot(secret, 300, now, async (url, options) => {
    calls.push(url);
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    const h = options.headers as Record<string, string>;
    assert.equal(h.Authorization, `Bearer ${secret}`);
    assert.equal(h.Accept, "application/vnd.github+json");
    assert.equal(h["X-GitHub-Api-Version"], "2026-03-10");
    return response(
      url.includes("/ai_credit/")
        ? usage()
        : url.includes("/usage?")
          ? usage([row(20)])
          : { id: 1, login: "alice" },
    );
  });
  assert.equal(calls.length, 4);
  assert.match(calls[1]!, /ai_credit\/usage\?year=2026&month=10/);
  assert.match(calls[2]!, /year=2026&month=10&product=Copilot/);
  assert.equal(reading.meters[0]!.used, 20);
  let i = 0;
  await assert.rejects(
    readCopilot(secret, null, now, async () =>
      response(
        ++i === 1
          ? { id: 1, login: "alice" }
          : i === 2 || i === 3
            ? usage()
            : { id: 2, login: "bob" },
      ),
    ),
    /could not be verified/,
  );
});
test("401 stops authentication, permission errors guide Plan: read, rate limits retain deadline, errors never echo response or token", async () => {
  for (const status of [401, 403, 404, 429])
    await assert.rejects(
      readCopilot(secret, null, now, async () =>
        response({ message: secret }, status, {
          "retry-after": status === 429 ? "3600" : "",
        }),
      ),
      (e) => {
        assert.ok(e instanceof Error);
        assert.ok(!e.message.includes(secret));
        if (status === 401) assert.match(e.message, /expired or revoked/);
        if (status === 403 || status === 404)
          assert.match(e.message, /Plan: read/);
        if (status === 429)
          assert.equal(
            (e as Error & { retryAt: number }).retryAt,
            now + 3600000,
          );
        return true;
      },
    );
  await assert.rejects(
    readCopilot(secret, null, now, async () => {
      throw Error(secret);
    }),
    /could not be reached/,
  );
});
async function tokenFixture() {
  const data: Record<string, unknown> = {};
  let key: CryptoKey | undefined;
  const crypto = webcrypto as unknown as Crypto;
  const vault = createTokenVault({
    crypto,
    local: {
      get: async (k) => ({ [k]: data[k] }),
      set: async (v) => {
        Object.assign(data, v);
      },
      setAccessLevel: async () => {},
    },
    keys: {
      load: async () => key,
      create: async () =>
        (key = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        )),
    },
    lock: async (fn) => fn(),
  });
  return { data, vault, key: () => key };
}
test("PAT vault uses non-extractable AES-GCM, isolated storage, per-slot authenticated encryption and deletion", async () => {
  const f = await tokenFixture();
  await f.vault.put(slot, secret);
  assert.equal(await f.vault.get(slot), secret);
  assert.equal(f.key()!.extractable, false);
  assert.ok(!JSON.stringify(f.data).includes(secret));
  assert.deepEqual(Object.keys(f.data), [TOKEN_KEY]);
  const slots = f.data[TOKEN_KEY] as Record<string, unknown>;
  slots["20000000-0000-4000-8000-000000000002"] = slots[slot];
  await assert.rejects(
    f.vault.get("20000000-0000-4000-8000-000000000002"),
    /Encrypted token storage unavailable/,
  );
  await f.vault.delete(slot);
  await assert.rejects(f.vault.get(slot));
  assert.ok(
    !Object.hasOwn(slots, slot) ||
      !Object.hasOwn(f.data[TOKEN_KEY] as object, slot),
  );
});
test("pre-Copilot v2 state migrates additively and credentials remain outside state/public/diagnostics", async () => {
  const old = emptyStore("old");
  delete (old.providers as Partial<Store["providers"]>).copilot;
  const migrated = StoreSchema.parse(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.providers.copilot.enabled, false);
  assert.deepEqual(migrated.accounts, old.accounts);
  assert.ok(!migrated.connections.some((c) => c.id === "website:copilot"));
  const f = await tokenFixture();
  let store = migrated;
  let index = 0;
  let remote = 1;
  const service = createCopilotAccounts({
    readStore: async () => store,
    updateStore: async (fn) => {
      const result = fn(store);
      store = StoreSchema.parse(result.store);
      return result.value;
    },
    tokens: f.vault,
    uuid: () => `10000000-0000-4000-8000-${String(++index).padStart(12, "0")}`,
    now: () => now,
    cancel: () => {},
    accepted: async () => {},
    permitted: async () => true,
    lock: async (_, fn) => fn(),
    request: async (url) =>
      response(
        url.includes("/ai_credit/")
          ? usage()
          : url.includes("/usage?")
            ? usage([row(1)])
            : { id: remote, login: "alice" },
      ),
  });
  await service.connect(secret);
  remote = 2;
  await service.connect(secret + "SECOND");
  assert.equal(store.accounts.length, 2);
  assert.equal(store.connections.filter((c) => c.kind === "copilot").length, 2);
  for (const state of [
    exportReadings(
      store.accounts,
      store.snapshots.map(historyPoint),
      "json",
      now,
    ),
    exportReadings(
      store.accounts,
      store.snapshots.map(historyPoint),
      "csv",
      now,
    ),
    store,
    toPublicState(store),
    diagnostics(toPublicState(store), "test", now),
  ])
    assert.ok(!JSON.stringify(state).includes(secret));
  const [a, b] = store.connections.filter((c) => c.kind === "copilot");
  assert.equal(shouldRefresh(a!, "manual", now + 899999, 5), false);
  assert.equal(shouldRefresh(a!, "scheduled", now + 900000, 5), true);
  assert.equal(
    shouldRefresh({ ...a!, status: "needs-auth" }, "manual", now + 9999999, 5),
    false,
  );
  await assert.rejects(
    service.connect(secret, a!.id),
    /another GitHub account/,
  );
  await service.disconnect(a!.id);
  assert.ok(!store.connections.some((c) => c.id === a!.id));
  await assert.rejects(f.vault.get(a!.profileId!));
  assert.equal(await f.vault.get(b!.profileId!), secret + "SECOND");
});
test("token vault fails closed on corrupt storage and sanitizes browser/key-store errors", async () => {
  const f = await tokenFixture();
  f.data[TOKEN_KEY] = { [slot]: { iv: "bad", data: secret } };
  await assert.rejects(
    f.vault.get(slot),
    (e) =>
      e instanceof Error &&
      e.message === "Encrypted token storage unavailable.",
  );
  const v = createTokenVault({
    crypto: webcrypto as unknown as Crypto,
    local: {
      get: async () => {
        throw Error(secret);
      },
      set: async () => {
        throw Error(secret);
      },
      setAccessLevel: async () => {},
    },
    keys: {
      load: async () => {
        throw Error(secret);
      },
      create: async () => {
        throw Error(secret);
      },
    },
    lock: async (fn) => fn(),
  });
  for (const action of [
    () => v.get(slot),
    () => v.put(slot, secret),
    () => v.delete(slot),
  ])
    await assert.rejects(
      action(),
      (e) => e instanceof Error && !e.message.includes(secret),
    );
});

test("another token for the same GitHub identity reports a duplicate without overwriting the first account", async () => {
  const f = await tokenFixture();
  let state = emptyStore("duplicate-test"),
    i = 0;
  const service = createCopilotAccounts({
    readStore: async () => state,
    updateStore: async (fn) => {
      const result = fn(state);
      state = StoreSchema.parse(result.store);
      return result.value;
    },
    tokens: f.vault,
    uuid: () => `30000000-0000-4000-8000-${String(++i).padStart(12, "0")}`,
    now: () => now,
    cancel: () => {},
    accepted: async () => {},
    permitted: async () => true,
    lock: async (_, fn) => fn(),
    request: async (url) =>
      response(
        url.includes("/ai_credit/")
          ? usage()
          : url.includes("/usage?")
            ? usage([row(12)])
            : { id: 1, login: "alice" },
      ),
  });
  await service.connect(secret);
  state.accounts[0]!.alias = "Personal";
  const before = structuredClone(state),
    encrypted = structuredClone(f.data);
  await assert.rejects(
    service.connect(secret + "DUPLICATE"),
    (e) =>
      e instanceof CopilotAccountError &&
      e.code === "duplicate-account" &&
      !e.message.includes(secret),
  );
  assert.deepEqual(state, before);
  assert.deepEqual(f.data, encrypted);
  assert.equal(state.accounts.length, 1);
  assert.equal(
    await f.vault.get(
      state.connections.find((c) => c.kind === "copilot")!.profileId!,
    ),
    secret,
  );
});
test("simultaneous additions of one GitHub identity keep one connection and erase the losing token", async () => {
  let state = emptyStore("duplicate-race"),
    i = 0,
    writes = 0,
    accepted = 0;
  const tokens = new Map<string, string>();
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = createCopilotAccounts({
    readStore: async () => structuredClone(state),
    updateStore: async (fn) => {
      const result = fn(state);
      state = StoreSchema.parse(result.store);
      return result.value;
    },
    tokens: {
      put: async (slot, token) => {
        tokens.set(slot, token);
        if (++writes === 2) release();
        await ready;
      },
      delete: async (slot) => {
        tokens.delete(slot);
      },
    },
    uuid: () => `40000000-0000-4000-8000-${String(++i).padStart(12, "0")}`,
    now: () => now,
    cancel: () => {},
    accepted: async () => {
      accepted++;
    },
    permitted: async () => true,
    lock: async (_, fn) => fn(),
    request: async (url) =>
      response(
        url.includes("/ai_credit/")
          ? usage()
          : url.includes("/usage?")
            ? usage([row(12)])
            : { id: 1, login: "alice" },
      ),
  });
  const result = await Promise.allSettled([
    service.connect(secret),
    service.connect(secret + "OTHER"),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const error = result.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(error.reason instanceof CopilotAccountError);
  assert.equal(error.reason.code, "duplicate-account");
  assert.equal(state.accounts.length, 1);
  assert.equal(state.connections.filter((c) => c.kind === "copilot").length, 1);
  assert.equal(tokens.size, 1);
  assert.equal(accepted, 1);
  assert.ok(
    tokens.has(state.connections.find((c) => c.kind === "copilot")!.profileId!),
  );
});

test("AI credit reports use credit units, preserve missing quota, and never infer a Free zero from empty billing", () => {
  const identity = { id: "1", login: "alice" };
  const raw = usage([
    {
      product: "Copilot AI Credits",
      unitType: "ai-credits",
      grossQuantity: 12.5,
    },
    { product: "Other", unitType: "requests", grossQuantity: 999 },
  ]);
  const m = parseCopilotCredits(identity, raw, now).meters[0]!;
  assert.equal(m.used, 12.5);
  assert.equal(m.total, null);
  assert.equal(m.usedPercent, null);
  assert.equal(m.resetsAt, null);
  assert.equal(m.unit, "credits");
  assert.equal(
    parseCopilotCredits(identity, usage(), now).meters[0]!.used,
    null,
  );
  assert.equal(
    parseCopilotCredits(
      identity,
      usage([
        {
          product: "Copilot AI Credits",
          unitType: "ai-credits",
          grossQuantity: 0,
        },
      ]),
      now,
    ).meters[0]!.used,
    0,
  );
  assert.throws(() =>
    parseCopilotCredits(identity, { ...raw, user: "bob" }, now),
  );
  assert.throws(() =>
    parseCopilotCredits(
      identity,
      usage([
        {
          product: "Copilot AI Credits",
          unitType: "requests",
          grossQuantity: 12,
        },
      ]),
      now,
    ),
  );
  assert.throws(() =>
    parseCopilotCredits(
      identity,
      usage([
        {
          product: "Copilot AI Credits",
          unitType: "ai-credits",
          grossQuantity: -1,
        },
      ]),
      now,
    ),
  );
});
const quotaFixture = () => ({
  copilot_plan: "free",
  token_based_billing: true,
  quota_reset_date_utc: "2026-11-01T00:00:00Z",
  quota_snapshots: {
    chat: {
      entitlement: "100",
      credits_used: "12",
      quota_remaining: "88",
      percent_remaining: 88,
      unlimited: false,
    },
    completions: {
      entitlement: 2000,
      quota_remaining: 2000,
      percent_remaining: 100,
      unlimited: false,
    },
    premium_interactions: {
      entitlement: 0,
      percent_remaining: 100,
      unlimited: false,
    },
  },
});
test("experimental entitlement parser separates Free credits and completions, reads actual reset, and ignores unallocated quotas", () => {
  const snapshot = parseCopilotQuotas(
    { id: "1", login: "alice" },
    quotaFixture(),
  );
  assert.equal(snapshot.plan, "free");
  assert.equal(snapshot.meters.length, 2);
  const [credit, suggestions] = snapshot.meters;
  assert.equal(credit!.label, "Credits");
  assert.equal(credit!.usedPercent, 12);
  assert.equal(credit!.used, 12);
  assert.equal(credit!.total, 100);
  assert.equal(credit!.resetsAt, Date.UTC(2026, 10, 1));
  assert.equal(suggestions!.label, "Inline suggestions");
  assert.equal(suggestions!.usedPercent, 0);
  assert.equal(suggestions!.total, 2000);
});
test("quota parsing handles unlimited paid plans, legacy Free quotas, absent values and malformed identity without guessed quotas", () => {
  const identity = { id: "1", login: "alice" };
  const paid = parseCopilotQuotas(identity, {
    copilot_plan: "pro",
    quota_snapshots: { completions: { unlimited: true, entitlement: 0 } },
  }).meters[0]!;
  assert.equal(paid.unlimited, true);
  assert.equal(paid.total, null);
  assert.equal(paid.usedPercent, null);
  const legacy = parseCopilotQuotas(identity, {
    monthly_quotas: { chat: 50, completions: 2000 },
    limited_user_quotas: { chat: 30, completions: 1700 },
  });
  assert.equal(legacy.meters[0]!.usedPercent, 40);
  assert.equal(legacy.meters[1]!.usedPercent, 15);
  assert.equal(legacy.meters[0]!.resetsAt, null);
  const unknown = parseCopilotQuotas(identity, {
    quota_snapshots: { chat: { percent_remaining: 70 } },
  }).meters[0]!;
  assert.equal(unknown.usedPercent, 30);
  assert.equal(unknown.total, null);
  assert.equal(unknown.used, null);
  assert.throws(() => parseCopilotQuotas(identity, {}));
  assert.throws(() =>
    parseCopilotQuotas(identity, { ...quotaFixture(), id: 2 }),
  );
  assert.throws(() =>
    parseCopilotQuotas(identity, { ...quotaFixture(), login: "bob" }),
  );
  assert.throws(() =>
    parseCopilotQuotas(identity, {
      quota_snapshots: { chat: { percent_remaining: 101 } },
    }),
  );
});
test("quota access is opt-in, verifies identity around the read, never spoofs an IDE and never falls back after denial or throttling", async () => {
  const calls: string[] = [];
  const snapshot = await readCopilot(
    secret,
    300,
    now,
    async (url, opts) => {
      calls.push(new URL(url).pathname);
      const headers = new Headers(opts.headers);
      assert.equal(headers.has("Editor-Version"), false);
      assert.equal(headers.has("Editor-Plugin-Version"), false);
      assert.equal(headers.has("Cookie"), false);
      return response(
        url.endsWith("/copilot_internal/user")
          ? quotaFixture()
          : { id: 1, login: "alice" },
      );
    },
    undefined,
    true,
  );
  assert.deepEqual(calls, ["/user", "/copilot_internal/user", "/user"]);
  assert.equal(snapshot.meters[0]!.usedPercent, 12);
  for (const status of [401, 403, 404, 429]) {
    const attempted: string[] = [];
    await assert.rejects(
      readCopilot(
        secret,
        null,
        now,
        async (url) => {
          attempted.push(url);
          return url.endsWith("/user") && !url.includes("copilot_internal")
            ? response({ id: 1, login: "alice" })
            : response(
                { message: secret },
                status,
                status === 429 ? { "retry-after": "3600" } : {},
              );
        },
        undefined,
        true,
      ),
      (e) => {
        assert.ok(e instanceof Error && !e.message.includes(secret));
        if (status === 403 || status === 404)
          assert.match(e.message, /denied experimental quota access/);
        return true;
      },
    );
    assert.equal(attempted.length, 2);
    assert.ok(!attempted.some((u) => u.includes("/billing/")));
  }
  let userChecks = 0;
  await assert.rejects(
    readCopilot(
      secret,
      null,
      now,
      async (url) =>
        response(
          url.includes("copilot_internal")
            ? quotaFixture()
            : ++userChecks === 1
              ? { id: 1, login: "alice" }
              : { id: 2, login: "bob" },
        ),
      undefined,
      true,
    ),
  );
});
test("public billing reads current credits first and treats empty reports as unavailable, not zero", async () => {
  const called: string[] = [];
  const result = await readCopilot(secret, 300, now, async (url) => {
    called.push(url);
    return response(
      url.endsWith("/user")
        ? { id: 1, login: "alice" }
        : usage([
            {
              product: "Copilot AI Credits",
              unitType: "ai-credits",
              grossQuantity: 12,
            },
          ]),
    );
  });
  assert.equal(result.meters[0]!.id, "ai-credits");
  assert.equal(result.meters[0]!.total, null);
  assert.ok(
    !called.some(
      (url) =>
        url.includes("premium_request") || url.includes("copilot_internal"),
    ),
  );
  const empty = await readCopilot(secret, 50, now, async (url) =>
    response(url.endsWith("/user") ? { id: 1, login: "alice" } : usage()),
  );
  assert.equal(empty.meters[0]!.id, "ai-credits");
  assert.equal(empty.meters[0]!.used, null);
  assert.equal(empty.meters[0]!.total, null);
});

test("quota displays preserve unlimited and numeric credits without projecting an unlimited reset", () => {
  const paid = parseCopilotQuotas(
    { id: "1", login: "alice" },
    {
      quota_reset_date_utc: "2020-01-01T00:00:00Z",
      quota_snapshots: { completions: { unlimited: true, entitlement: 0 } },
    },
  ).meters[0]!;
  assert.equal(meterValue(paid), "Unlimited");
  assert.equal(projectRememberedReset(paid, true, now).projected, false);
  const credit = parseCopilotCredits(
    { id: "1", login: "alice" },
    usage([
      {
        product: "Copilot AI Credits",
        unitType: "ai-credits",
        grossQuantity: 12,
      },
    ]),
    now,
  ).meters[0]!;
  assert.equal(meterValue(credit), "12 credits used");
});
