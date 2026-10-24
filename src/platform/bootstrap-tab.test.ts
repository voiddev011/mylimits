import test from "node:test";
import assert from "node:assert/strict";
import {
  createTabRecovery,
  RECOVERY_COUNTERS_KEY,
  RECOVERY_TABS_KEY,
  RECOVERY_COOLDOWN_MS,
} from "./bootstrap-tab";
import { isNormalTab, pickNormalTab } from "../core/browser-tabs";
import { responseError } from "../providers/errors";

const NOW = Date.UTC(2026, 9, 23, 10);
type Tab = {
  id: number;
  windowId: number;
  incognito: boolean;
  active: boolean;
  status: string;
  url: string;
};
class Memory {
  values: Record<string, unknown> = {};
  fail = false;
  async get(key: string) {
    if (this.fail) throw Error("Unavailable");
    return { [key]: structuredClone(this.values[key]) };
  }
  async set(value: Record<string, unknown>) {
    if (this.fail) throw Error("Unavailable");
    Object.assign(this.values, structuredClone(value));
  }
}
function event<T extends (...args: any[]) => void>() {
  const listeners = new Set<T>();
  return {
    listeners,
    addListener: (f: T) => {
      listeners.add(f);
    },
    removeListener: (f: T) => {
      listeners.delete(f);
    },
    emit: (...args: Parameters<T>) => {
      for (const f of listeners) f(...args);
    },
  };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const local = new Memory(),
    session = new Memory();
  const timers = new Map<number, { run: () => void; ms: number }>();
  let sequence = 0,
    nextId = 10;
  const updates =
      event<(id: number, info: { status?: string }, tab: Tab) => void>(),
    removed = event<(id: number) => void>(),
    activated = event<(info: { tabId: number }) => void>();
  const f = {
    clock: NOW,
    loading: false,
    failCreate: false,
    failRemove: false,
    windows: [{ id: 1, incognito: false, focused: true }],
    created: [] as number[],
    closed: [] as number[],
    tabs: new Map<number, Tab>([
      [
        1,
        {
          id: 1,
          windowId: 1,
          incognito: false,
          active: true,
          status: "complete",
          url: "https://example.test/",
        },
      ],
    ]),
  };
  const port = {
    local,
    session,
    tabs: {
      get: async (id: number) => {
        const tab = f.tabs.get(id);
        if (!tab) throw Error("Missing tab");
        return { ...tab };
      },
      create: async (properties: {
        url: string;
        active: false;
        windowId: number;
      }) => {
        if (f.failCreate) throw Error("No window");
        const tab = {
          id: nextId++,
          windowId: properties.windowId,
          incognito: false,
          active: false,
          status: f.loading ? "loading" : "complete",
          url: properties.url,
        };
        f.tabs.set(tab.id, tab);
        f.created.push(tab.id);
        return { ...tab };
      },
      remove: async (id: number) => {
        if (f.failRemove) throw Error("Cannot close");
        f.tabs.delete(id);
        f.closed.push(id);
        removed.emit(id);
      },
      onUpdated: updates,
      onRemoved: removed,
      onActivated: activated,
    },
    windows: { getAll: async () => f.windows },
    now: () => f.clock,
    schedule: (run: () => void, ms: number) => {
      const id = ++sequence;
      timers.set(id, { run, ms });
      return id;
    },
    cancel: (id: unknown) => {
      timers.delete(id as number);
    },
  };
  const manager = createTabRecovery(port);
  return {
    f,
    port,
    local,
    session,
    manager,
    timers,
    updates,
    activated,
    tick: async (ms: number) => {
      for (const [id, timer] of [...timers])
        if (timer.ms === ms) {
          timers.delete(id);
          timer.run();
        }
      await settle();
    },
  };
}

test("page selection and tab signals reject private, container, unknown and owned tab contexts", () => {
  const normal = { id: 1, incognito: false, active: false },
    privateTab = { id: 2, incognito: true, active: true };
  assert.equal(pickNormalTab([privateTab, normal])!.id, 1);
  assert.equal(pickNormalTab([privateTab]), undefined);
  assert.equal(
    pickNormalTab([normal], () => true),
    undefined,
  );
  assert.equal(
    isNormalTab({ incognito: false, cookieStoreId: "firefox-container-1" }),
    false,
  );
  assert.equal(isNormalTab({}), false);
  assert.equal(
    isNormalTab({ incognito: false, cookieStoreId: "firefox-default" }),
    true,
  );
});
test("one recorded inactive tab handles a full callback and cleanup closes only that tab", async () => {
  const x = fixture();
  let calls = 0;
  const work = x.manager.withTemporaryTab(
    "claude",
    async (id) => {
      calls++;
      assert.ok(x.manager.owns(id));
      assert.equal(
        (x.session.values[RECOVERY_TABS_KEY] as unknown[]).length,
        1,
      );
      return ["identity", "quota", "identity"];
    },
    { enabled: true, cookieState: "unknown" },
  );
  await settle();
  assert.deepEqual(x.f.created, [10]);
  assert.equal(calls, 0);
  await x.tick(3000);
  assert.deepEqual(await work, ["identity", "quota", "identity"]);
  assert.deepEqual(x.f.closed, [10]);
  assert.ok(x.f.tabs.has(1));
  assert.deepEqual(x.session.values[RECOVERY_TABS_KEY], []);
  assert.equal(x.timers.size, 0);
});
test("owned tabs close on quota errors and the loading wait times out with all listeners removed", async () => {
  const x = fixture();
  const work = x.manager.withTemporaryTab(
    "claude",
    async () => {
      throw Error("No quota");
    },
    { enabled: true, cookieState: "present" },
  );
  const failed = assert.rejects(work, /Open website/);
  await settle();
  await x.tick(3000);
  await failed;
  assert.deepEqual(x.f.closed, [10]);
  const y = fixture();
  y.f.loading = true;
  const pending = y.manager.withTemporaryTab("claude", async () => 1, {
    enabled: true,
    cookieState: "unknown",
  });
  const timeout = assert.rejects(
    pending,
    (e: any) => e.code === "recovery-timeout",
  );
  await settle();
  await y.tick(20000);
  await timeout;
  assert.deepEqual(y.f.closed, [10]);
  assert.equal(y.updates.listeners.size, 0);
  assert.equal(y.timers.size, 0);
});
test("loading completion waits for the three-second settle before any quota callback", async () => {
  const x = fixture();
  x.f.loading = true;
  let calls = 0;
  const work = x.manager.withTemporaryTab(
    "claude",
    async () => {
      calls++;
      return 1;
    },
    { enabled: true, cookieState: "unknown" },
  );
  await settle();
  const tab = x.f.tabs.get(10)!;
  tab.status = "complete";
  x.updates.emit(10, { status: "complete" }, tab);
  await settle();
  assert.equal(calls, 0);
  await x.tick(3000);
  assert.equal(await work, 1);
  assert.equal(calls, 1);
});
test("off, absent-cookie, private-only windows and unavailable persistent storage create no tabs", async () => {
  for (const condition of [
    "off",
    "absent",
    "windows",
    "local",
    "session",
  ] as const) {
    const x = fixture();
    if (condition === "windows")
      x.f.windows = [{ id: 2, incognito: true, focused: true }];
    if (condition === "local") x.local.fail = true;
    if (condition === "session") x.session.fail = true;
    await assert.rejects(
      x.manager.withTemporaryTab("claude", async () => 1, {
        enabled: condition !== "off",
        cookieState: condition === "absent" ? "absent" : "unknown",
      }),
    );
    assert.equal(x.f.created.length, 0, condition);
  }
});
test("persistent cooldown and daily cap survive worker recreation; midnight never bypasses the cooldown", async () => {
  const x = fixture();
  for (let i = 0; i < 8; i++) {
    const work = x.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    });
    await settle();
    await x.tick(3000);
    await work;
    const restarted = createTabRecovery(x.port);
    await assert.rejects(
      restarted.withTemporaryTab("claude", async () => 1, {
        enabled: true,
        cookieState: "unknown",
      }),
      (e: any) => e.code === "recovery-cooldown",
    );
    x.f.clock += RECOVERY_COOLDOWN_MS;
  }
  await assert.rejects(
    x.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    }),
    (e: any) => e.code === "recovery-daily-limit",
  );
  assert.equal(x.f.created.length, 8);
  x.f.clock = Date.UTC(2026, 9, 24, 0, 1);
  const next = x.manager.withTemporaryTab("claude", async () => 2, {
    enabled: true,
    cookieState: "unknown",
  });
  await settle();
  await x.tick(3000);
  assert.equal(await next, 2);
  x.f.clock = Date.UTC(2026, 9, 25, 0, 1);
  x.local.values[RECOVERY_COUNTERS_KEY] = {
    claude: {
      day: "2026-10-24",
      attempts: 8,
      lastAttemptAt: x.f.clock - 60000,
    },
  };
  await assert.rejects(
    x.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    }),
    (e: any) => e.code === "recovery-cooldown",
  );
});
test("same-provider attempts cannot overlap and concurrent providers preserve both budget entries", async () => {
  const x = fixture();
  const a = x.manager.withTemporaryTab("claude", async () => 1, {
    enabled: true,
    cookieState: "unknown",
  });
  await settle();
  await assert.rejects(
    x.manager.withTemporaryTab("claude", async () => 2, {
      enabled: true,
      cookieState: "unknown",
    }),
    (e: any) => e.code === "recovery-busy",
  );
  const b = x.manager.withTemporaryTab("chatgpt", async () => 3, {
    enabled: true,
    cookieState: "unknown",
  });
  await settle();
  await x.tick(3000);
  assert.deepEqual(await Promise.all([a, b]), [1, 3]);
  assert.deepEqual(
    Object.keys(x.local.values[RECOVERY_COUNTERS_KEY] as object).sort(),
    ["chatgpt", "claude"],
  );
});
test("startup cleans owned tabs, leaves active or unrelated tabs alone and fails closed on unclosed ownership", async () => {
  const x = fixture();
  x.f.tabs.set(10, {
    id: 10,
    windowId: 1,
    incognito: false,
    active: false,
    status: "complete",
    url: "https://claude.ai",
  });
  x.session.values[RECOVERY_TABS_KEY] = [
    { id: 10, windowId: 1, provider: "claude", createdAt: NOW },
  ];
  await x.manager.initialize();
  assert.deepEqual(x.f.closed, [10]);
  assert.ok(x.f.tabs.has(1));
  const y = fixture();
  y.session.values[RECOVERY_TABS_KEY] = [
    { id: 1, windowId: 1, provider: "claude", createdAt: NOW },
  ];
  await y.manager.initialize();
  assert.deepEqual(y.f.closed, []);
  assert.ok(y.f.tabs.has(1));
  const z = fixture();
  z.f.tabs.set(10, {
    id: 10,
    windowId: 1,
    incognito: false,
    active: false,
    status: "complete",
    url: "https://claude.ai",
  });
  z.session.values[RECOVERY_TABS_KEY] = [
    { id: 10, windowId: 1, provider: "claude", createdAt: NOW },
  ];
  z.f.failRemove = true;
  await z.manager.initialize();
  await assert.rejects(
    z.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    }),
  );
  assert.equal(z.f.created.length, 0);
});
test("abort and user activation stop callbacks; a user-activated recovery tab is left open", async () => {
  for (const user of [false, true]) {
    const x = fixture();
    let called = false;
    const controller = new AbortController();
    const work = x.manager.withTemporaryTab(
      "claude",
      async () => {
        called = true;
        return 1;
      },
      { enabled: true, cookieState: "unknown", signal: controller.signal },
    );
    const canceled = assert.rejects(work, (e: any) => e.code === "cancelled");
    await settle();
    if (user) {
      x.f.tabs.get(10)!.active = true;
      x.activated.emit({ tabId: 10 });
    } else controller.abort();
    await canceled;
    assert.equal(called, false);
    assert.equal(x.f.tabs.has(10), user);
    assert.deepEqual(x.session.values[RECOVERY_TABS_KEY], []);
  }
});
test("creation failure consumes a persisted attempt and corrupt counters cannot reset limits", async () => {
  const x = fixture();
  x.f.failCreate = true;
  await assert.rejects(
    x.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    }),
  );
  assert.equal(
    (x.local.values[RECOVERY_COUNTERS_KEY] as any).claude.attempts,
    1,
  );
  const y = fixture();
  y.local.values[RECOVERY_COUNTERS_KEY] = {
    claude: { day: "broken", attempts: 0, lastAttemptAt: 0 },
  };
  await assert.rejects(
    y.manager.withTemporaryTab("claude", async () => 1, {
      enabled: true,
      cookieState: "unknown",
    }),
    (e: any) => e.code === "recovery-storage",
  );
  assert.equal(y.f.created.length, 0);
});
test("plain 401, 429 and invalid quota data cannot request a recovery tab", () => {
  for (const response of [
    { status: 401 },
    { status: 429 },
    { status: 200, parseFailed: true },
  ])
    assert.equal(responseError(response, "Claude")!.canRecoverWithTab, false);
  for (const response of [
    { status: 0 },
    { status: 403 },
    { status: 200, contentType: "text/html" },
  ])
    assert.equal(responseError(response, "Claude")!.canRecoverWithTab, true);
});
