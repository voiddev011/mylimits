import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore, websiteConnection, type Store } from "../core/model";
import { applySnapshot } from "../core/engine";
import {
  EXPIRY_ALARM,
  EXPIRY_PERIOD,
  type ExpiryAlert,
} from "../core/signin-expiry";
import { vaultId } from "../core/connection-id";
import { createExpiryWatchdog } from "./expiry-watchdog";
function fixture() {
  let clock = 1800000000000,
    store = emptyStore("watchdog-test"),
    permission = true,
    policy = true,
    failure = false,
    creates = 0,
    clears = 0;
  let alarm: { periodInMinutes: number; delayInMinutes: number } | undefined;
  const sent: ExpiryAlert[] = [];
  const slot = "10000000-0000-4000-8000-000000000001",
    id = vaultId("chatgpt", slot);
  store.connections.push({
    ...websiteConnection("chatgpt"),
    id,
    kind: "vault",
    profileId: slot,
    enabled: true,
    status: "active",
    savedSignIn: { method: "private", notAfter: clock + 47 * 3600000 },
  });
  store = applySnapshot(
    store,
    "chatgpt",
    "account",
    { kind: "account", displayName: "Work", plan: "plus", meters: [] },
    clock,
    { connectionId: id },
  );
  store.settings.desktopAlerts = true;
  let queue: Promise<unknown> = Promise.resolve();
  const port = {
    readStore: async () => structuredClone(store),
    updateStore<T>(
      fn: (s: Store) => Promise<{ store: Store; value: T }>,
    ): Promise<T> {
      const task = queue.then(async () => {
        const r = await fn(structuredClone(store));
        store = structuredClone(r.store);
        return r.value;
      });
      queue = task.catch(() => {});
      return task;
    },
    enabled: () => policy,
    now: () => clock,
    permitted: async () => permission,
    notify: async (alert: ExpiryAlert) => {
      if (failure) throw Error("FICTIONAL_DELIVERY_FAILURE");
      sent.push(alert);
    },
    alarms: {
      get: async (name: string) => {
        assert.equal(name, EXPIRY_ALARM);
        return alarm;
      },
      create: async (
        name: string,
        value: { periodInMinutes: number; delayInMinutes: number },
      ) => {
        assert.equal(name, EXPIRY_ALARM);
        creates++;
        alarm = value;
      },
      clear: async (name: string) => {
        assert.equal(name, EXPIRY_ALARM);
        clears++;
        alarm = undefined;
      },
    },
  };
  return {
    port,
    read: () => store,
    sent,
    advance: (h: number) => {
      clock += h * 3600000;
    },
    permission: (v: boolean) => {
      permission = v;
    },
    policy: (v: boolean) => {
      policy = v;
    },
    failure: (v: boolean) => {
      failure = v;
    },
    metrics: () => ({ creates, clears, alarm }),
  };
}
test("watchdog installs one daily alarm, coalesces checks and persists both warnings across worker recreation", async () => {
  const f = fixture(),
    watch = createExpiryWatchdog(f.port);
  await Promise.all([watch.check(), watch.check(), watch.check()]);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.metrics(), {
    creates: 1,
    clears: 0,
    alarm: { periodInMinutes: EXPIRY_PERIOD, delayInMinutes: EXPIRY_PERIOD },
  });
  await createExpiryWatchdog(f.port).check();
  assert.equal(f.sent.length, 1);
  assert.equal(f.metrics().creates, 1);
  await f.port.alarms.clear(EXPIRY_ALARM);
  await createExpiryWatchdog(f.port).check();
  assert.equal(f.metrics().creates, 2);
  assert.equal(f.sent.length, 1);
  f.advance(23);
  await createExpiryWatchdog(f.port).check();
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[1]!.message, /24 hours/);
});
test("failed delivery preserves prior ledger and retries only the undelivered threshold", async () => {
  const f = fixture(),
    watch = createExpiryWatchdog(f.port);
  f.failure(true);
  await watch.check();
  assert.deepEqual(f.read().alertLedger, {});
  f.failure(false);
  await watch.check();
  assert.equal(f.sent.length, 1);
  const prior = structuredClone(f.read().alertLedger);
  f.advance(23);
  f.failure(true);
  await watch.check();
  assert.deepEqual(f.read().alertLedger, prior);
  f.failure(false);
  await watch.check();
  await watch.check();
  assert.equal(f.sent.length, 2);
});
test("permission removal, provider-off and last-source removal clear the alarm without notifications", async () => {
  for (const mode of [
    "permission",
    "policy",
    "disconnect",
    "settings",
    "expired",
    "unknown",
  ] as const) {
    const f = fixture(),
      watch = createExpiryWatchdog(f.port);
    await watch.check();
    f.sent.length = 0;
    if (mode === "permission") f.permission(false);
    if (mode === "policy") f.policy(false);
    if (mode === "disconnect") f.read().connections.pop();
    if (mode === "settings") f.read().settings.desktopAlerts = false;
    if (mode === "expired") f.advance(48);
    if (mode === "unknown")
      f.read().connections.at(-1)!.savedSignIn!.notAfter = null;
    await watch.check();
    assert.equal(f.sent.length, 0);
    assert.equal(f.metrics().clears, 1);
    assert.equal(f.metrics().alarm, undefined);
  }
});
test("quiet-hour delay does not reset daily alarm and regular checks deliver after quiet hours", async () => {
  const f = fixture(),
    date = new Date(f.port.now()),
    hour = date.getHours();
  const clock = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  f.read().settings.quietHours = {
    enabled: true,
    start: clock(hour),
    end: clock(hour + 1),
  };
  const watch = createExpiryWatchdog(f.port);
  await watch.check();
  assert.equal(f.sent.length, 0);
  assert.deepEqual(f.read().alertLedger, {});
  f.advance(1);
  await watch.check();
  assert.equal(f.sent.length, 1);
  assert.equal(f.metrics().creates, 1);
});
test("a disconnect queued before delivery invalidates the earlier eligibility read", async () => {
  const f = fixture(),
    update = f.port.updateStore.bind(f.port);
  f.port.updateStore = (fn) => {
    f.read().connections.at(-1)!.enabled = false;
    return update(fn);
  };
  await createExpiryWatchdog(f.port).check();
  assert.equal(f.sent.length, 0);
  assert.deepEqual(f.read().alertLedger, {});
});
test("a check requested during an in-flight disconnect reconciles the last-source alarm", async () => {
  const f = fixture();
  let release!: () => void, entered!: () => void;
  const wait = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
  const permitted = f.port.permitted;
  let calls = 0;
  f.port.permitted = async () => {
    if (++calls === 1) {
      entered();
      await wait;
    }
    return permitted();
  };
  const watch = createExpiryWatchdog(f.port),
    first = watch.check();
  await ready;
  f.read().connections.pop();
  const second = watch.check();
  release();
  await Promise.all([first, second]);
  assert.equal(f.sent.length, 0);
  assert.equal(f.metrics().alarm, undefined);
  assert.equal(f.metrics().clears, 1);
});
