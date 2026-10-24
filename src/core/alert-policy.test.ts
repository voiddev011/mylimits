import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore } from "./model";
import { applySnapshot, collectAlerts, badge } from "./engine";
import { isQuiet, alertKey } from "./alert-policy";
const now = new Date(2026, 9, 15, 23, 0, 0).getTime();
function fixture(used = 90) {
  const s = applySnapshot(
    emptyStore("salt"),
    "claude",
    "a",
    {
      kind: "account",
      displayName: "Work",
      plan: null,
      meters: [
        {
          id: "session",
          label: "Session",
          scope: "subscription",
          evidence: "reported",
          usedPercent: used,
          used: null,
          total: null,
          unit: "percent",
          resetsAt: now + 60000,
          source: "fixture",
        },
      ],
    },
    now,
  );
  s.settings.desktopAlerts = true;
  return s;
}
test("overnight quiet hours and snooze do not consume undelivered thresholds", () => {
  const s = fixture();
  s.settings.quietHours = { enabled: true, start: "22:00", end: "08:00" };
  assert.equal(isQuiet(s.settings, now), true);
  assert.equal(isQuiet(s.settings, new Date(2026, 9, 16, 9).getTime()), false);
  assert.deepEqual(collectAlerts(s, now).store.alertLedger, {});
  s.settings.quietHours.enabled = false;
  s.accounts[0]!.snoozedUntil = now + 1000;
  assert.equal(collectAlerts(s, now).alerts.length, 0);
  assert.equal(collectAlerts(s, now + 1001).alerts.length, 1);
});
test("reset alert requires a later fresh observed window and is deduplicated", () => {
  let s = fixture(50);
  s.settings.resetAlerts = true;
  s = collectAlerts(s, now).store;
  assert.equal(collectAlerts(s, now + 60000).alerts.length, 0); // Timestamp passing alone proves nothing.
  s = applySnapshot(
    s,
    "claude",
    "a",
    {
      kind: "account",
      displayName: "Work",
      plan: null,
      meters: [
        {
          ...s.accounts[0]!.meters[0]!,
          usedPercent: 10,
          resetsAt: now + 3600000,
        },
      ],
    },
    now + 61000,
  );
  const result = collectAlerts(s, now + 61000);
  assert.equal(result.alerts[0]!.kind, "reset");
  assert.equal(collectAlerts(result.store, now + 62000).alerts.length, 0);
});
test("legacy alert ledger is respected after migration and different scopes remain separate", () => {
  const s = fixture();
  s.alertLedger["a/session"] = { window: String(now + 60000), sent: [20] };
  assert.equal(collectAlerts(s, now).alerts.length, 0);
  const m = s.accounts[0]!.meters[0]!;
  assert.notEqual(
    alertKey(s.accounts[0]!, m),
    alertKey(s.accounts[0]!, { ...m, scope: "chat" }),
  );
});
test("used display changes badge text while preserving most constrained allowance", () => {
  const s = fixture(90);
  assert.equal(badge(s, now).text, "10%");
  s.settings.displayMode = "used";
  assert.equal(badge(s, now).text, "90%");
});
