import test from "node:test";
import assert from "node:assert/strict";
import { assertReleaseHasNoSpike } from "./package-policy.mjs";
test("release guard rejects diagnostic files, bundled code and required diagnostic permissions while preserving C3 optional cookies", () => {
  const manifest = {
    permissions: ["storage"],
    optional_permissions: ["cookies", "declarativeNetRequestWithHostAccess"],
  };
  assertReleaseHasNoSpike(
    manifest,
    ["background.js", "popup.html"],
    "ordinary code",
  );
  for (const file of [
    "spike.html",
    "chunks/spike-abc.js",
    "assets/spike-abc.css",
  ])
    assert.throws(() => assertReleaseHasNoSpike(manifest, [file]));
  for (const marker of ["MYLIMITS_PRIVATE_SESSION_SPIKE", "mylimits-spike-v1"])
    assert.throws(() =>
      assertReleaseHasNoSpike(manifest, ["background.js"], marker),
    );
  for (const permission of [
    "cookies",
    "declarativeNetRequestWithHostAccess",
    "webRequest",
  ])
    assert.throws(() =>
      assertReleaseHasNoSpike({ ...manifest, permissions: [permission] }, []),
    );
  assert.throws(() =>
    assertReleaseHasNoSpike(
      { ...manifest, optional_permissions: ["webRequest"] },
      [],
    ),
  );
});

test("normal extension rejects native app installers, helper directories and native-messaging runtime", () => {
  const manifest = {
    permissions: ["storage"],
    optional_permissions: ["cookies", "declarativeNetRequestWithHostAccess"],
  };
  for (const file of [
    "companion/host.mjs",
    "desktop/setup.js",
    "downloads/setup.EXE",
    "mylimits.msi",
  ])
    assert.throws(
      () => assertReleaseHasNoSpike(manifest, [file]),
      /native app files/,
    );
  for (const call of ["runtime.connectNative", "runtime.sendNativeMessage"])
    assert.throws(
      () => assertReleaseHasNoSpike(manifest, ["background.js"], call),
      /native messaging runtime/,
    );
  for (const field of ["permissions", "optional_permissions"])
    assert.throws(() =>
      assertReleaseHasNoSpike(
        { ...manifest, [field]: ["nativeMessaging"] },
        [],
      ),
    );
  assertReleaseHasNoSpike(
    manifest,
    ["popup.html", "providers/chatgpt.svg"],
    "legacy notification preference: desktopAlerts",
  );
});
