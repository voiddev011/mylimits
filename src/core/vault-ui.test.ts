import test from "node:test";
import assert from "node:assert/strict";
import { offerSavedSignIn, signInExpiry, privateSignInHelp } from "./vault-ui";
import { PROVIDER_IDS } from "./model";
test("saved sign-in is offered only for experimental ChatGPT on Chromium browsers", () => {
  for (const provider of PROVIDER_IDS)
    for (const browser of ["chrome", "brave", "edge", "firefox"])
      assert.equal(
        offerSavedSignIn(provider, browser),
        provider === "chatgpt" && browser !== "firefox",
      );
});
test("expiry labels use only supplied timestamps and never invent an expiry", () => {
  const now = 1800000000000;
  assert.equal(signInExpiry(undefined, now), null);
  assert.equal(signInExpiry(null, now), null);
  assert.equal(signInExpiry(now, now), "Saved sign-in has expired");
  assert.equal(signInExpiry(now + 86400001, now), "Sign-in expires in 2 days");
  assert.equal(signInExpiry(now + 86400000, now), "Sign-in expires in 1 day");
});
test("typed private errors map to fixed help without reflecting provider error text", () => {
  assert.match(
    privateSignInHelp("incognito-access-required"),
    /Allow MyLimits/,
  );
  assert.match(privateSignInHelp("disabled"), /not enabled/);
  assert.ok(!privateSignInHelp("TOKEN_SECRET").includes("TOKEN_SECRET"));
});
