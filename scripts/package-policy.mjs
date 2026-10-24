import assert from "node:assert/strict";
export function assertReleaseHasNoSpike(manifest, files, bundled = "") {
  assert.ok(
    !files.some((file) => /(^|[\/_.-])spike([\/_.-]|$)/i.test(file)),
    "Release contains a spike file",
  );
  assert.ok(
    !bundled.includes("MYLIMITS_PRIVATE_SESSION_SPIKE") &&
      !bundled.includes("mylimits-spike-v1"),
    "Release contains spike runtime code",
  );
  assert.ok(
    !files.some((file) =>
      /(^|[\/])(companion|desktop)([\/]|$)|\.(exe|msi)$/i.test(file),
    ),
    "Release contains native app files",
  );
  assert.ok(
    !bundled.includes("connectNative") &&
      !bundled.includes("sendNativeMessage"),
    "Release contains native messaging runtime",
  );
  for (const permission of [
    "nativeMessaging",
    "cookies",
    "declarativeNetRequestWithHostAccess",
    "webRequest",
  ])
    assert.ok(
      !manifest.permissions?.includes(permission),
      `Release requires spike permission ${permission}`,
    );
  // Optional cookies and header rules support sign-in detection and experimental saved sign-in.
  for (const permission of [
    "nativeMessaging",
    "webRequest",
    "declarativeNetRequestFeedback",
  ])
    assert.ok(
      !manifest.optional_permissions?.includes(permission),
      `Release exposes spike permission ${permission}`,
    );
}
