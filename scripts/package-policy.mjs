import assert from "node:assert/strict";
export function assertReleasePackage(manifest, files, bundled = "") {
  assert.ok(
    files
      .filter((f) => f.endsWith(".html"))
      .every((f) =>
        ["popup.html", "dashboard.html", "sidepanel.html"].includes(f),
      ),
    "Release contains an unexpected extension page",
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
      `Release requires forbidden permission ${permission}`,
    );
  // Optional cookies and header rules support sign-in detection and experimental saved sign-in.
  for (const permission of [
    "nativeMessaging",
    "webRequest",
    "declarativeNetRequestFeedback",
  ])
    assert.ok(
      !manifest.optional_permissions?.includes(permission),
      `Release exposes forbidden permission ${permission}`,
    );
}
