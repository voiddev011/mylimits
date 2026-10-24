import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore, websiteConnection } from "./model";
import { applySnapshot } from "./engine";
import { collectExpiryAlerts, expiringSources } from "./signin-expiry";
import { vaultId } from "./connection-id";
import { vaultEnabled } from "./vault-policy";
import { StoreSchema } from "./schema";
import { toPublicState } from "./public";
import { forgetAccount } from "./actions";
const now = new Date(2026, 9, 23, 12).getTime(),
  HOUR = 3600000,
  slot = "10000000-0000-4000-8000-000000000001";
function fixture(hours: number | null = 47) {
  let s = emptyStore("expiry-unit");
  const id = vaultId("chatgpt", slot);
  s.connections.push({
    ...websiteConnection("chatgpt"),
    id,
    kind: "vault",
    profileId: slot,
    enabled: true,
    status: "active",
    savedSignIn: {
      method: "private",
      notAfter: hours === null ? null : now + hours * HOUR,
    },
  });
  s = applySnapshot(
    s,
    "chatgpt",
    "saved-account",
    { kind: "account", displayName: "Work", plan: "plus", meters: [] },
    now,
    { connectionId: id },
  );
  s.settings.desktopAlerts = true;
  return StoreSchema.parse(s);
}
test("expiry uses 48h and 24h windows once, including after serialized reload, without changing readings", () => {
  const s = fixture(),
    before = structuredClone(s),
    a = collectExpiryAlerts(s, now, () => true);
  assert.equal(a.alerts.length, 1);
  assert.match(a.alerts[0]!.message, /48 hours/);
  assert.deepEqual(s, before);
  let stored = StoreSchema.parse(JSON.parse(JSON.stringify(a.store)));
  assert.equal(
    collectExpiryAlerts(stored, now + HOUR, () => true).alerts.length,
    0,
  );
  const b = collectExpiryAlerts(stored, now + 23 * HOUR, () => true);
  assert.match(b.alerts[0]!.message, /24 hours/);
  stored = StoreSchema.parse(b.store);
  assert.equal(
    collectExpiryAlerts(stored, now + 24 * HOUR, () => true).alerts.length,
    0,
  );
  assert.deepEqual(b.store.accounts, s.accounts);
  assert.deepEqual(b.store.connections, s.connections);
  assert.deepEqual(b.store.snapshots, s.snapshots);
  assert.equal(
    JSON.stringify(toPublicState(b.store)),
    JSON.stringify(toPublicState(s)),
  );
  assert.equal(stored.version, 2);
});
test("late wake sends only urgent warning; expired, unknown and future expiries never create warnings", () => {
  const s = fixture(12),
    a = collectExpiryAlerts(s, now, () => true);
  assert.equal(a.alerts.length, 1);
  assert.match(a.alerts[0]!.message, /24 hours/);
  assert.equal(
    collectExpiryAlerts(a.store, now - 20 * HOUR, () => true).alerts.length,
    0,
  ); // Clock reversal cannot replay the skipped warning.
  for (const hours of [null, 0, -1, 49])
    assert.equal(
      collectExpiryAlerts(fixture(hours), now, () => true).alerts.length,
      0,
    );
  assert.equal(
    collectExpiryAlerts(fixture(48), now, () => true).alerts.length,
    1,
  );
  assert.equal(
    collectExpiryAlerts(fixture(24), now, () => true).alerts.length,
    1,
  );
});
test("quiet hours, alert preference, account mute and snooze never consume a notification", () => {
  for (const mode of ["quiet", "off", "mute", "snooze"] as const) {
    const s = fixture();
    if (mode === "quiet")
      s.settings.quietHours = { enabled: true, start: "11:00", end: "13:00" };
    if (mode === "off") s.settings.desktopAlerts = false;
    if (mode === "mute") s.accounts[0]!.alertsMuted = true;
    if (mode === "snooze") s.accounts[0]!.snoozedUntil = now + HOUR;
    const r = collectExpiryAlerts(s, now, () => true);
    assert.equal(r.alerts.length, 0);
    assert.deepEqual(r.store.alertLedger, {});
    s.settings.quietHours = { enabled: false, start: "11:00", end: "13:00" };
    s.settings.desktopAlerts = true;
    s.accounts[0]!.alertsMuted = false;
    s.accounts[0]!.snoozedUntil = null;
    assert.equal(collectExpiryAlerts(s, now, () => true).alerts.length, 1);
  }
});
test("disabled policies, rejected sources, wrong slot/provider/account and website connections cannot alert", () => {
  const s = fixture();
  assert.equal(collectExpiryAlerts(s, now, vaultEnabled).alerts.length, 1);
  assert.equal(collectExpiryAlerts(s, now, () => false).alerts.length, 0);
  for (const patch of [
    { enabled: false },
    { status: "disabled" as const },
    { status: "needs-auth" as const },
    { kind: "website" as const },
    { profileId: "20000000-0000-4000-8000-000000000002" },
    { provider: "claude" as const },
    { accountId: "missing" },
    { id: "unverified-source" },
  ]) {
    const b = structuredClone(s);
    Object.assign(b.connections.at(-1)!, patch);
    assert.equal(expiringSources(b, now, () => true).length, 0);
  }
});
test("privacy hides aliases; independent sources deduplicate separately and renewed expiry rearms only its source", () => {
  const s = fixture();
  s.settings.privacyMode = true;
  s.accounts[0]!.alias = "PRIVATE WORK NAME";
  const b = structuredClone(s.connections.at(-1)!);
  b.profileId = "20000000-0000-4000-8000-000000000002";
  b.id = vaultId("chatgpt", b.profileId);
  s.connections.push(b);
  const a = collectExpiryAlerts(s, now, () => true);
  assert.equal(a.alerts.length, 2);
  assert.ok(a.alerts.every((n) => n.title === "Account 1: sign-in expiring"));
  assert.ok(!JSON.stringify(a.alerts).includes("PRIVATE WORK NAME"));
  a.store.connections.at(-1)!.savedSignIn!.notAfter = now + 46 * HOUR;
  const r = collectExpiryAlerts(a.store, now, () => true);
  assert.equal(r.alerts.length, 1);
  assert.ok(r.alerts[0]!.id.includes(b.id));
  const forgotten = forgetAccount(r.store, "saved-account");
  assert.deepEqual(forgotten.alertLedger, {});
  assert.equal(
    collectExpiryAlerts(forgotten, now, () => true).alerts.length,
    0,
  );
});
