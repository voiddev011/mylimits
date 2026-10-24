import test from "node:test";
import assert from "node:assert/strict";
import { assertReleasePackage } from "./package-policy.mjs";
test("release guard permits only shipping pages and optional saved-sign-in permissions", () => {
  const manifest = {
    permissions: ["storage"],
    optional_permissions: ["cookies", "declarativeNetRequestWithHostAccess"],
  };
  assertReleasePackage(
    manifest,
    ["background.js", "popup.html"],
    "ordinary code",
  );
  for (const file of ["debug.html", "experiments/lab.html"])
    assert.throws(() => assertReleasePackage(manifest, [file]));
  for (const permission of [
    "cookies",
    "declarativeNetRequestWithHostAccess",
    "webRequest",
  ])
    assert.throws(() =>
      assertReleasePackage({ ...manifest, permissions: [permission] }, []),
    );
  assert.throws(() =>
    assertReleasePackage(
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
      () => assertReleasePackage(manifest, [file]),
      /native app files/,
    );
  for (const call of ["runtime.connectNative", "runtime.sendNativeMessage"])
    assert.throws(
      () => assertReleasePackage(manifest, ["background.js"], call),
      /native messaging runtime/,
    );
  for (const field of ["permissions", "optional_permissions"])
    assert.throws(() =>
      assertReleasePackage({ ...manifest, [field]: ["nativeMessaging"] }, []),
    );
  assertReleasePackage(
    manifest,
    ["popup.html", "providers/chatgpt.svg"],
    "legacy notification preference: desktopAlerts",
  );
});
