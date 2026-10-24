import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore } from "./model";
import { applySnapshot, collectAlerts, badge } from "./engine";
import { projectRememberedReset } from "./reset-projection";
import { forgetAccount } from "./actions";
import { privatePresentation } from "./presentation";
import { toPublicState } from "./public";
const meter = {
  id: "quota",
  label: "Quota",
  scope: "subscription" as const,
  evidence: "reported" as const,
  usedPercent: 90,
  used: null,
  total: null,
  unit: "percent" as const,
  resetsAt: 10000,
  source: "fixture",
};
const reading = {
  kind: "account" as const,
  displayName: "Provider account",
  plan: null,
  meters: [meter],
};
test("A B A switches generation, remembers old readings and reuses aliases without mixing the badge", () => {
  let s = applySnapshot(emptyStore("salt"), "claude", "A", reading, 1);
  s.accounts[0]!.alias = "My work";
  const gen = s.connections[0]!.generation;
  s = applySnapshot(
    s,
    "claude",
    "B",
    { ...reading, meters: [{ ...meter, usedPercent: 20 }] },
    2,
  );
  assert.equal(s.accounts.find((a) => a.id === "A")!.connection, "inactive");
  assert.equal(badge(s, 2).text, "80%");
  assert.equal(s.connections[0]!.generation, gen + 1);
  const rejected = applySnapshot(s, "claude", "A", reading, 3, {
    generation: gen,
  });
  assert.equal(rejected, s);
  s = applySnapshot(s, "claude", "A", reading, 4);
  assert.equal(s.accounts.length, 2);
  assert.equal(s.accounts.find((a) => a.id === "A")!.alias, "My work");
  assert.equal(s.accounts.find((a) => a.id === "B")!.connection, "inactive");
  const kept = forgetAccount(s, "B");
  assert.equal(kept.connections[0]!.accountId, "A");
  assert.equal(kept.connections[0]!.enabled, true);
  assert.ok(kept.snapshots.every((p) => p.accountId !== "B"));
  assert.ok(
    !JSON.stringify(privatePresentation(toPublicState(s))).includes("My work"),
  );
});
test("reset projection is marked estimated and leaves reported snapshots and alerts untouched", () => {
  const raw = structuredClone(meter),
    p = projectRememberedReset(raw, true, 10001);
  assert.equal(p.projected, true);
  assert.equal(p.meter.usedPercent, 0);
  assert.equal(p.meter.evidence, "estimated");
  assert.deepEqual(raw, meter);
  assert.equal(
    projectRememberedReset(
      { ...raw, unit: "currency", currency: "USD" },
      true,
      10001,
    ).meter.used,
    0,
  );
  assert.equal(projectRememberedReset(raw, false, 10001).projected, false);
  assert.equal(
    projectRememberedReset({ ...raw, resetsAt: null }, true, 10001).projected,
    false,
  );
  let s = applySnapshot(emptyStore("salt"), "claude", "A", reading, 1);
  s = applySnapshot(s, "claude", "B", { ...reading, meters: [] }, 2);
  s.settings.desktopAlerts = true;
  const before = JSON.stringify(s.snapshots);
  projectRememberedReset(
    s.accounts.find((a) => a.id === "A")!.meters[0]!,
    true,
    10001,
  );
  assert.equal(JSON.stringify(s.snapshots), before);
  assert.equal(collectAlerts(s, 10001).alerts.length, 0);
});
