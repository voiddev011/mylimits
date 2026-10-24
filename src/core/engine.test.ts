import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore, remainingPercent, isFresh, type Meter } from "./model";
import {
  accountId,
  applySnapshot,
  badge,
  collectAlerts,
  markProvider,
  type Snapshot,
} from "./engine";

const NOW = Date.parse("2026-10-14T10:00:00Z");
const meter = (
  usedPercent: number | null = 80,
  overrides: Partial<Meter> = {},
): Meter => ({
  id: "session",
  label: "Session",
  scope: "subscription",
  evidence: "reported",
  usedPercent,
  used: null,
  total: null,
  unit: "percent",
  resetsAt: NOW + 3600_000,
  source: "Test fixture",
  ...overrides,
});
const snapshot = (meters = [meter()]): Omit<Snapshot, "identity"> => ({
  kind: "account",
  displayName: "Claude account",
  plan: "pro",
  meters,
});
function withAccount(meters = [meter()]) {
  const store = applySnapshot(
    emptyStore("test-salt"),
    "claude",
    "claude:first",
    snapshot(meters),
    NOW,
  );
  store.settings.desktopAlerts = true;
  return store;
}

test("switching accounts retains nicknames and readings under the correct identity", () => {
  let store = withAccount();
  store.accounts[0]!.alias = "Claude Work";
  store.accounts[0]!.alertRemaining = 30;
  store = applySnapshot(
    store,
    "claude",
    "claude:second",
    snapshot([meter(10)]),
    NOW + 1000,
  );
  assert.equal(
    store.accounts.find((account) => account.id === "claude:first")!.connection,
    "inactive",
  );
  assert.equal(
    store.accounts.find((account) => account.id === "claude:second")!.alias,
    "",
  );
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(45)]),
    NOW + 2000,
  );
  assert.equal(store.accounts.length, 2);
  const work = store.accounts.find((account) => account.id === "claude:first")!;
  assert.equal(work.alias, "Claude Work");
  assert.equal(work.alertRemaining, 30);
  assert.equal(work.meters[0]!.usedPercent, 45);
  assert.equal(
    store.accounts.find((account) => account.id === "claude:second")!.meters[0]!
      .usedPercent,
    10,
  );
});
test("identity keys differ by account, provider and installation salt", async () => {
  const first = await accountId("claude", "account-a", "install-a");
  assert.equal(first, await accountId("claude", "account-a", "install-a"));
  assert.notEqual(first, await accountId("claude", "account-b", "install-a"));
  assert.notEqual(first, await accountId("chatgpt", "account-a", "install-a"));
  assert.notEqual(first, await accountId("claude", "account-a", "install-b"));
  assert.ok(!first.includes("account-a"));
});
test("unknown quota stays unknown, while zero used is a valid reading", () => {
  assert.equal(remainingPercent(meter(null)), null);
  assert.equal(remainingPercent(meter(0)), 100);
  assert.equal(remainingPercent(meter(100)), 0);
  assert.equal(remainingPercent(meter(110)), 0);
  assert.equal(remainingPercent(meter(null, { used: 12, total: 20 })), 40);
});
test("one warning fires at the threshold and repeated refreshes do not repeat it", () => {
  assert.equal(emptyStore("defaults").settings.warningRemaining, 20);
  assert.equal(emptyStore("defaults").settings.criticalRemaining, 10);
  const first = collectAlerts(withAccount(), NOW);
  assert.equal(first.alerts.length, 1);
  assert.match(first.alerts[0]!.message, /20% left/);
  assert.equal(collectAlerts(first.store, NOW + 1000).alerts.length, 0);
});
test("first seeing a critical balance sends one critical alert, not two notifications", () => {
  const result = collectAlerts(withAccount([meter(98)]), NOW);
  assert.equal(result.alerts.length, 1);
  assert.match(result.alerts[0]!.message, /2% left/);
  assert.deepEqual(
    result.store.alertLedger[
      "claude:first/legacy/subscription/session"
    ]!.sent.sort((a, b) => a - b),
    [10, 20],
  );
});
test("critical warning can follow an earlier low-balance warning", () => {
  let store = collectAlerts(withAccount(), NOW).store;
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(96)]),
    NOW + 1000,
  );
  const result = collectAlerts(store, NOW + 1000);
  assert.equal(result.alerts.length, 1);
  assert.match(result.alerts[0]!.message, /4% left/);
});
test("a new reset window rearms notifications", () => {
  let store = collectAlerts(withAccount(), NOW).store;
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(81, { resetsAt: NOW + 7200_000 })]),
    NOW + 1000,
  );
  assert.equal(collectAlerts(store, NOW + 1000).alerts.length, 1);
});
test("stale, inactive, expired and observed-only readings do not produce quota alerts", () => {
  const fresh = withAccount();
  assert.equal(collectAlerts(fresh, NOW + 16 * 60_000).alerts.length, 0);
  fresh.accounts[0]!.connection = "inactive";
  assert.equal(collectAlerts(fresh, NOW).alerts.length, 0);
  assert.equal(
    collectAlerts(withAccount([meter(99, { resetsAt: NOW - 1 })]), NOW).alerts
      .length,
    0,
  );
  assert.equal(
    collectAlerts(
      withAccount([
        meter(null, { evidence: "observed", used: 900, unit: "requests" }),
      ]),
      NOW,
    ).alerts.length,
    0,
  );
});
test("alert preferences apply separately for each account", () => {
  const store = withAccount([meter(75)]);
  assert.equal(collectAlerts(store, NOW).alerts.length, 0);
  store.accounts[0]!.alertRemaining = 30;
  store.accounts[0]!.alias = "Work account";
  const result = collectAlerts(store, NOW);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]!.title, "Work account is running low");
  store.accounts[0]!.alertsMuted = true;
  assert.equal(collectAlerts(store, NOW).alerts.length, 0);
  store.accounts[0]!.alertsMuted = false;
  store.settings.desktopAlerts = false;
  assert.equal(collectAlerts(store, NOW).alerts.length, 0);
});
test("unknown reset windows rearm only after a meaningful recovery", () => {
  let store = collectAlerts(
    withAccount([meter(82, { resetsAt: null })]),
    NOW,
  ).store;
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(79, { resetsAt: null })]),
    NOW + 1000,
  );
  store = collectAlerts(store, NOW + 1000).store;
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(82, { resetsAt: null })]),
    NOW + 2000,
  );
  assert.equal(collectAlerts(store, NOW + 2000).alerts.length, 0);
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(70, { resetsAt: null })]),
    NOW + 3000,
  );
  store = collectAlerts(store, NOW + 3000).store;
  store = applySnapshot(
    store,
    "claude",
    "claude:first",
    snapshot([meter(82, { resetsAt: null })]),
    NOW + 4000,
  );
  assert.equal(collectAlerts(store, NOW + 4000).alerts.length, 1);
});
test("a per-account warning below the global critical threshold does not alert early", () => {
  const store = withAccount([meter(92)]);
  store.settings.criticalRemaining = 10;
  store.accounts[0]!.alertRemaining = 5;
  assert.equal(collectAlerts(store, NOW).alerts.length, 0);
  store.accounts[0]!.meters = [meter(96)];
  assert.equal(collectAlerts(store, NOW).alerts.length, 1);
});
test("failed refresh preserves the last reading and suppresses its badge", () => {
  const before = withAccount();
  const failed = markProvider(
    before,
    "claude",
    "error",
    "Refresh failed",
    NOW + 1000,
  );
  assert.deepEqual(failed.accounts[0]!.meters, before.accounts[0]!.meters);
  assert.equal(failed.accounts[0]!.updatedAt, NOW);
  assert.equal(failed.providers.claude.activeAccountId, null);
  assert.equal(badge(failed, NOW + 1000).text, "");
  assert.equal(collectAlerts(failed, NOW + 1000).alerts.length, 0);
});
test("badge reflects the most constrained fresh reported allowance, not summed percentages", () => {
  const store = withAccount([meter(30), meter(85, { id: "weekly" })]);
  assert.equal(badge(store, NOW).text, "15%");
  store.accounts[0]!.connection = "inactive";
  assert.equal(badge(store, NOW).text, "");
});
test("reset expiry is distinct from a fresh zero-usage reading", () => {
  const store = withAccount([meter(0, { resetsAt: NOW })]);
  assert.equal(
    isFresh(store.accounts[0]!, store.accounts[0]!.meters[0]!, NOW, 5),
    false,
  );
});

test("toolbar badge defaults to auto, supports off, and chosen meter respects display mode and thresholds", () => {
  const s = withAccount([
    meter(30),
    meter(95, { id: "week", label: "Weekly" }),
  ]);
  delete s.settings.badge; // Legacy settings have automatic behavior.
  assert.equal(badge(s, NOW).text, "5%");
  assert.equal(badge(s, NOW).color, "#dc5a52");
  s.settings.badge = { mode: "off" };
  assert.equal(badge(s, NOW).text, "");
  s.settings.badge = {
    mode: "meter",
    accountId: s.accounts[0]!.id,
    meterId: "session",
  };
  assert.equal(badge(s, NOW).text, "70%");
  assert.equal(badge(s, NOW).color, "#237c64");
  s.settings.displayMode = "used";
  assert.equal(badge(s, NOW).text, "30%");
  assert.match(badge(s, NOW).title, /Session: 30% used/);
  s.settings.badge.meterId = "week";
  assert.equal(badge(s, NOW).text, "95%");
  assert.equal(badge(s, NOW).color, "#dc5a52");
  s.accounts[0]!.meters[1]!.usedPercent = 85;
  assert.equal(badge(s, NOW).color, "#b97819");
});

test("chosen stale meter retains last value in grey but never projects expired reset values", () => {
  const s = withAccount([meter(62)]);
  s.settings.badge = {
    mode: "meter",
    accountId: s.accounts[0]!.id,
    meterId: "session",
  };
  s.accounts[0]!.connection = "inactive";
  assert.equal(badge(s, NOW).text, "38%");
  assert.equal(badge(s, NOW).color, "#64748b");
  assert.match(badge(s, NOW).title, /Last reading/);
  s.settings.displayMode = "used";
  assert.equal(badge(s, NOW).text, "62%");
  assert.equal(badge(s, NOW + 3600_000).text, "");
  assert.equal(badge(s, NOW + 3600_000).color, "#64748b");
  // Even an active account needs a new reading after the reset timestamp.
  s.accounts[0]!.connection = "active";
  assert.equal(badge(s, NOW + 3600_000).text, "");
  s.accounts[0]!.meters[0]!.resetsAt = null;
  assert.equal(badge(s, NOW + 3600_000).text, "62%");
  assert.equal(badge(s, NOW + 3600_000).color, "#64748b");
});

test("missing chosen account or meter falls back to auto, unavailable or projected readings stay empty", () => {
  const s = withAccount([meter(30)]);
  s.settings.badge = {
    mode: "meter",
    accountId: "deleted",
    meterId: "session",
  };
  assert.equal(badge(s, NOW).text, "70%");
  s.settings.badge.accountId = s.accounts[0]!.id;
  s.settings.badge.meterId = "deleted";
  assert.equal(badge(s, NOW).text, "70%");
  s.settings.badge.meterId = "session";
  s.accounts[0]!.meters[0]!.usedPercent = null;
  assert.equal(badge(s, NOW).text, "");
  s.accounts[0]!.meters[0]!.usedPercent = 0;
  s.accounts[0]!.meters[0]!.evidence = "estimated";
  assert.equal(badge(s, NOW).text, "");
});

test("toolbar tooltip hides both account and limit names in privacy mode", () => {
  const s = withAccount([meter(30, { label: "Secret weekly project" })]);
  s.accounts[0]!.alias = "Secret personal account";
  for (const mode of ["auto", "meter"] as const) {
    s.settings.badge = {
      mode,
      accountId: s.accounts[0]!.id,
      meterId: "session",
    };
    assert.match(badge(s, NOW).title, /Secret personal account/);
    s.settings.privacyMode = true;
    assert.equal(badge(s, NOW).title, "MyLimits · Limit: 70% remaining");
    assert.ok(!badge(s, NOW).title.includes("Secret"));
    s.settings.privacyMode = false;
  }
});
