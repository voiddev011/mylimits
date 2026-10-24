import test from "node:test";
import assert from "node:assert/strict";
import { emptyStore } from "./model";
import { applySnapshot } from "./engine";
import { enableWebsite, forgetAccount, setWorkspace } from "./actions";
function fixture() {
  return applySnapshot(
    emptyStore("salt"),
    "claude",
    "a",
    { kind: "account", displayName: "A", plan: null, meters: [] },
    1800000000000,
  );
}
test("website disconnect invalidates requests and retains remembered nickname", () => {
  const s = fixture();
  s.accounts[0]!.alias = "Work";
  const next = enableWebsite(s, "claude", false);
  assert.equal(next.accounts[0]!.alias, "Work");
  assert.equal(next.accounts[0]!.connection, "inactive");
  assert.ok(next.connections[0]!.generation > s.connections[0]!.generation);
});
test("workspace selection only accepts choices belonging to that connection", () => {
  const s = fixture();
  s.connections[0]!.workspaceIds = ["verified"];
  s.workspaces = [
    {
      id: "verified",
      provider: "claude",
      name: "Team",
      remoteId: "fixture-org",
    },
  ];
  assert.throws(() => setWorkspace(s, "website:claude", "other"));
  assert.equal(
    setWorkspace(s, "website:claude", "verified").connections[0]!.workspaceId,
    "verified",
  );
});
test("forget removes snapshots and disables the current collector without deleting another provider", () => {
  const s = fixture();
  const next = forgetAccount(s, "a");
  assert.equal(next.accounts.length, 0);
  assert.equal(next.snapshots.length, 0);
  assert.equal(next.providers.claude.enabled, false);
  assert.equal(
    next.connections.find((c) => c.provider === "chatgpt")!.generation,
    0,
  );
});
