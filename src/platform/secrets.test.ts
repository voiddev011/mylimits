import test from "node:test";
import assert from "node:assert/strict";
import { createVault } from "./vault";
import { VAULT_KEY } from "../core/vault-contracts";
import { emptyStore, websiteConnection } from "../core/model";
import { applySnapshot } from "../core/engine";
import { vaultId } from "../core/connection-id";
import { toPublicState } from "../core/public";
import { diagnostics } from "../core/presentation";
import { historyPoint, exportReadings } from "../core/history-data";
import { createRequestDiagnostics, type DiagnosticInput } from "./diagnostics";
const secret = "FICTIONAL_C11_COOKIE_MUST_STAY_PRIVATE",
  slot = "10000000-0000-4000-8000-000000000001",
  now = 1800000000000;
async function fixture() {
  const data: Record<string, unknown> = {};
  let key: CryptoKey | undefined;
  const port = {
    local: {
      get: async (k: string) => ({ [k]: data[k] }),
      set: async (values: Record<string, unknown>) => {
        Object.assign(data, structuredClone(values));
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
    enabled: () => true,
    allowlist: () => ["fictional"],
    now: () => now,
    lock: async <T>(run: () => Promise<T>) => await run(),
  };
  const vault = createVault(port);
  await vault.putVault(slot, "chatgpt", {
    v: 1,
    origin: "https://chatgpt.com",
    cookies: [{ name: "fictional", value: secret }],
  });
  let state = emptyStore("secrets-fixture");
  const id = vaultId("chatgpt", slot);
  state.connections.push({
    ...websiteConnection("chatgpt"),
    id,
    kind: "vault",
    profileId: slot,
    enabled: true,
  });
  state = applySnapshot(
    state,
    "chatgpt",
    "verified-account",
    {
      kind: "account",
      displayName: "Personal",
      plan: "plus",
      meters: [
        {
          id: "codex",
          label: "Codex fixture",
          scope: "work-codex",
          evidence: "reported",
          unit: "percent",
          used: null,
          total: null,
          usedPercent: 35,
          resetsAt: null,
          source: "Fictional provider",
        },
      ],
    },
    now,
    { connectionId: id },
  );
  return { port, vault, data, state };
}
function safe(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const field of [secret, "ciphertext", "nonce"])
    assert.ok(
      !text.includes(field),
      `Output exposed a private field: ${field === secret ? "fixture value" : field}`,
    );
}
test("separate encrypted credentials never enter Store, public state, JSON/CSV exports ", async () => {
  const f = await fixture();
  assert.ok(!JSON.stringify(f.data).includes(secret));
  assert.deepEqual(Object.keys(f.data), [VAULT_KEY]);
  safe(f.state);
  safe(toPublicState(f.state));
  safe(await f.vault.listVault());
  assert.equal(
    (await f.vault.getVault("10000000-0000-4000-8000-000000000001"))?.payload
      .cookies[0]?.value,
    secret,
  );
  for (const format of ["json", "csv"] as const)
    safe(
      exportReadings(
        f.state.accounts,
        f.state.snapshots.map(historyPoint),
        format,
        now,
      ).text,
    );
});
test("request and support diagnostics discard credential-bearing headers, query text and unknown fields", async () => {
  const f = await fixture(),
    request = createRequestDiagnostics({ now: () => now });
  await request.record({
    provider: "chatgpt",
    path: "/api/auth/session?token=" + secret,
    transport: "vault",
    status: 401,
    contentType: secret,
    retryAfter: secret,
    cookieNames: [secret],
    headers: { cookie: secret },
    accessToken: secret,
  } as unknown as DiagnosticInput);
  safe(await request.list());
  safe(diagnostics(toPublicState(f.state), "fixture", now));
});
test("storage failures return fixed credential-free errors and leave existing ciphertext unchanged", async () => {
  const f = await fixture(),
    before = JSON.stringify(f.data);
  f.port.local.set = async () => {
    throw Error(secret);
  };
  await assert.rejects(f.vault.deleteVault(slot), (e) => {
    assert.ok(e instanceof Error);
    safe(e.message);
    return true;
  });
  assert.equal(JSON.stringify(f.data), before);
});
