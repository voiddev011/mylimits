import test from "node:test";
import assert from "node:assert/strict";
import { createVaultLifecycle } from "./vault-lifecycle";
import { createVault } from "./vault";
import { emptyStore, websiteConnection, type Store } from "../core/model";
import { applySnapshot } from "../core/engine";
import { vaultId } from "../core/connection-id";
import { VAULT_KEY, type VaultEnvelope } from "../core/vault-contracts";
const slots = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
];
async function fixture() {
  let state = emptyStore("lifecycle"),
    queue: Promise<unknown> = Promise.resolve(),
    key: CryptoKey | undefined;
  const data: Record<string, unknown> = {},
    cancelled: string[] = [],
    discarded: string[] = [];
  const vault = createVault({
    local: {
      get: async (k) => ({ [k]: structuredClone(data[k]) }),
      set: async (v) => {
        Object.assign(data, structuredClone(v));
      },
      setAccessLevel: async () => {},
    },
    crypto,
    keys: {
      load: async () => key,
      create: async () =>
        (key ??= await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        )),
    },
    now: () => 1800000000000,
    enabled: () => true,
    allowlist: () => ["fixture"],
    lock: async (run) => await run(),
  });
  for (const [i, slot] of slots.entries()) {
    const id = vaultId("chatgpt", slot);
    await vault.putVault(slot, "chatgpt", {
      v: 1,
      origin: "https://chatgpt.com",
      cookies: [{ name: "fixture", value: `FAKE_LIFECYCLE_${i}` }],
    });
    state.connections.push({
      ...websiteConnection("chatgpt"),
      id,
      profileId: slot,
      kind: "vault",
      enabled: true,
    });
    state = applySnapshot(
      state,
      "chatgpt",
      `account-${i}`,
      { kind: "account", displayName: `Account ${i}`, plan: null, meters: [] },
      1800000000000,
      { connectionId: id },
    );
    state.accounts[i]!.alias = i ? "Work" : "Personal";
  }
  const port = {
    readStore: async () => structuredClone(state),
    updateStore: <T>(fn: (s: Store) => { store: Store; value: T }) => {
      const t = queue.then(() => {
        const r = fn(structuredClone(state));
        state = r.store;
        return r.value;
      });
      queue = t.catch(() => {});
      return t;
    },
    deleteSlot: vault.deleteVault,
    cancelRefresh: (id: string) => {
      cancelled.push(id);
    },
    cancelSetup: async (id: string) => {
      discarded.push(id);
    },
  };
  return {
    port,
    vault,
    data,
    cancelled,
    discarded,
    read: () => state,
    lifecycle: createVaultLifecycle(port),
    ids: slots.map((s) => vaultId("chatgpt", s)),
  };
}
test("disconnect erases only the selected encrypted slot and source while retaining dated history and aliases", async () => {
  const f = await fixture(),
    before = structuredClone(f.read());
  await f.lifecycle.disconnect(f.ids[0]!);
  assert.deepEqual(f.cancelled, [f.ids[0]]);
  assert.ok(!f.read().connections.some((c) => c.id === f.ids[0]));
  assert.equal(f.read().accounts[0]!.alias, "Personal");
  assert.equal(f.read().accounts[0]!.connection, "inactive");
  assert.equal(f.read().accounts[0]!.updatedAt, before.accounts[0]!.updatedAt);
  assert.deepEqual(f.read().snapshots, before.snapshots);
  assert.equal(await f.vault.getVault(slots[0]!), null);
  assert.ok(await f.vault.getVault(slots[1]!));
  assert.deepEqual(Object.keys(f.data), [VAULT_KEY]);
  assert.ok(!(f.data[VAULT_KEY] as VaultEnvelope).entries[slots[0]!]);
  assert.deepEqual(f.read().accounts[1], before.accounts[1]);
});
test("delete failure leaves a fenced retryable source and preserves the account until retry succeeds", async () => {
  const f = await fixture(),
    remove = f.port.deleteSlot;
  let observed = false;
  f.port.deleteSlot = async () => {
    observed = !f.read().connections.find((c) => c.id === f.ids[0])!.enabled;
    throw Error("FAKE_LIFECYCLE_SECRET");
  };
  await assert.rejects(
    f.lifecycle.disconnect(f.ids[0]!),
    (e) => e instanceof Error && !e.message.includes("FAKE_LIFECYCLE_SECRET"),
  );
  assert.equal(observed, true);
  const c = f.read().connections.find((c) => c.id === f.ids[0])!;
  assert.ok(c.generation > 0);
  assert.match(c.message!, /Retry removal/);
  assert.ok(await f.vault.getVault(slots[0]!));
  assert.equal(f.read().accounts.length, 2);
  f.port.deleteSlot = remove;
  await f.lifecycle.disconnect(f.ids[0]!);
  assert.equal(await f.vault.getVault(slots[0]!), null);
  assert.ok(!f.read().connections.some((c) => c.id === f.ids[0]));
});
test("forget removes all slots owned by the account without touching other accounts; repeated removal is safe", async () => {
  const f = await fixture();
  await f.lifecycle.forget("account-0");
  await f.lifecycle.disconnect(f.ids[0]!);
  assert.equal(await f.vault.getVault(slots[0]!), null);
  assert.ok(await f.vault.getVault(slots[1]!));
  assert.ok(f.read().accounts.some((a) => a.id === "account-0"));
  // Account/history erasure happens only after credential cleanup succeeds in the controller.
  await f.lifecycle.forget("missing");
  assert.equal((await f.vault.listVault()).length, 1);
});
test("malformed source-slot bindings cannot delete another account credential", async () => {
  const f = await fixture();
  f.read().connections.find((c) => c.id === f.ids[0])!.profileId = slots[1];
  await assert.rejects(f.lifecycle.disconnect(f.ids[0]!), {
    code: "invalid-source",
  });
  assert.equal((await f.vault.listVault()).length, 2);
  assert.deepEqual(f.cancelled, []);
});
test("pending setup is cancelled before source deletion", async () => {
  const f = await fixture();
  f.read().accountSetup = {
    id: "20000000-0000-4000-8000-000000000001",
    provider: "chatgpt",
    mode: "detect",
    nickname: "",
    previousAccountId: null,
    startedAt: 1,
    method: "private",
    slotId: slots[0],
  };
  await f.lifecycle.disconnect(f.ids[0]!);
  assert.deepEqual(f.discarded, ["20000000-0000-4000-8000-000000000001"]);
  assert.equal(await f.vault.getVault(slots[0]!), null);
});
