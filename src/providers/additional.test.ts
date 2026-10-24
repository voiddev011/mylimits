import test from "node:test";
import assert from "node:assert/strict";
import { parseCursor } from "./additional";
import { readAccountProvider } from "./reader";
import { MeterSchema, StoreSchema } from "../core/schema";
import { emptyStore } from "../core/model";
import { applySnapshot } from "../core/engine";
import { providers as catalog } from "./catalog";
import { meterValue } from "../core/meter-display";
test("Cursor preserves provider pools and currencies instead of averaging percentages or fees", () => {
  const s = parseCursor(
    { sub: "cursor-user", email: "PRIVATE-EMAIL" },
    {
      membershipType: "pro",
      billingCycleStart: "2026-10-01T00:00:00Z",
      billingCycleEnd: "2026-11-01T00:00:00Z",
      individualUsage: {
        plan: {
          used: 500,
          limit: 2000,
          autoPercentUsed: 80,
          apiPercentUsed: 20,
        },
        onDemand: { enabled: true, used: 325 },
      },
    },
  );
  const included = s.meters.find((m) => m.id === "cursor:included")!,
    spend = s.meters.find((m) => m.id === "cursor:on-demand")!;
  assert.equal(included.used, 5);
  assert.equal(included.total, 20);
  assert.equal(included.usedPercent, 25);
  assert.equal(included.currency, "USD");
  assert.equal(spend.scope, "api");
  assert.equal(spend.used, 3.25);
  assert.equal(spend.usedPercent, null);
  assert.match(meterValue(spend), /spent/);
  assert.ok(!JSON.stringify(s).includes("PRIVATE-EMAIL"));
});
test("Cursor empty/malformed buckets remain unknown and do not create a 0% usage value", () => {
  assert.equal(parseCursor({ sub: "a" }, {}).meters.length, 0);
  assert.throws(() => parseCursor({ email: "not-an-id" }, {}));
  assert.throws(() =>
    parseCursor(
      { sub: "a" },
      { individualUsage: { plan: { used: -1, limit: 100 } } },
    ),
  );
  assert.equal(
    parseCursor(
      { sub: "a" },
      { individualUsage: { plan: { used: 0, limit: 100 } } },
    ).meters[0]!.usedPercent,
    0,
  );
});
