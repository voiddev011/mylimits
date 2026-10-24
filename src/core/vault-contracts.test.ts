import test from "node:test";
import assert from "node:assert/strict";
import {
  VAULT_POLICY,
  VAULT_COOKIE_ALLOWLIST,
  vaultEnabled,
} from "./vault-policy";
import {
  validateVaultPayload,
  vaultCookieHeader,
  vaultNotAfter,
  VaultError,
} from "./vault-contracts";
import { PROVIDER_IDS } from "./model";
test("only ChatGPT saved sign-in is experimental with an explicit frozen cookie allowlist", () => {
  assert.deepEqual(VAULT_COOKIE_ALLOWLIST.chatgpt, [
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
  ]);
  for (const p of PROVIDER_IDS) {
    assert.equal(VAULT_POLICY[p], p === "chatgpt" ? "experimental" : "off");
    if (p !== "chatgpt") assert.deepEqual(VAULT_COOKIE_ALLOWLIST[p], []);
    assert.equal(vaultEnabled(p), p === "chatgpt");
    assert.ok(Object.isFrozen(VAULT_COOKIE_ALLOWLIST[p]));
  }
});
test("vault payload allows two 4KB chunks but rejects oversize, unknown names, wrong origins and injection", () => {
  const p = {
    v: 1,
    origin: "https://chatgpt.com",
    cookies: [
      { name: "fixture.0", value: "a".repeat(4096) },
      { name: "fixture.1", value: "b".repeat(4096) },
    ],
  };
  assert.equal(
    validateVaultPayload("chatgpt", p, ["fixture.0", "fixture.1"]).cookies
      .length,
    2,
  );
  for (const bad of [
    { ...p, origin: "https://evil.test" },
    { ...p, token: "SECRET" },
    { ...p, cookies: [{ name: "fixture.0", value: "a".repeat(16384) }] },
    { ...p, cookies: [{ name: "fixture.0", value: "bad;other=x" }] },
    { ...p, cookies: [{ name: "fixture.0", value: "bad\r\nHEADER" }] },
    { ...p, cookies: [p.cookies[0], p.cookies[0]] },
  ])
    assert.throws(
      () => validateVaultPayload("chatgpt", bad, ["fixture.0", "fixture.1"]),
      VaultError,
    );
  assert.throws(
    () => validateVaultPayload("chatgpt", p, ["fixture.0"]),
    VaultError,
  );
  assert.throws(() => validateVaultPayload("chatgpt", p, []), VaultError);
});
test("vault header omits expired cookies and refuses an empty credential", () => {
  const p = validateVaultPayload(
    "chatgpt",
    {
      v: 1,
      origin: "https://chatgpt.com",
      cookies: [
        { name: "a", value: "A" },
        { name: "b", value: "B", expirationDate: 1 },
      ],
    },
    ["a", "b"],
  );
  assert.equal(vaultCookieHeader(p, 2000), "a=A");
  assert.throws(
    () => vaultCookieHeader({ ...p, cookies: [p.cookies[1]!] }, 2000),
    VaultError,
  );
});
test("saved expiry is the earliest supplied cookie timestamp in milliseconds; session-only cookies stay unknown", () => {
  const p = validateVaultPayload(
    "chatgpt",
    {
      v: 1,
      origin: "https://chatgpt.com",
      cookies: [
        { name: "session", value: "F" },
        { name: "persistent", value: "G", expirationDate: 1800000000 },
        { name: "earlier", value: "H", expirationDate: 1799999999 },
      ],
    },
    ["session", "persistent", "earlier"],
  );
  assert.equal(vaultNotAfter(p), 1799999999000);
  assert.equal(vaultNotAfter({ ...p, cookies: [p.cookies[0]!] }), null);
});
