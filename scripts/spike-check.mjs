import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFile, access } from "node:fs/promises";
const root = process.cwd(),
  wxt = path.join(root, "node_modules/wxt/bin/wxt.mjs");
function run(file, args, spike) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: root,
    env: { ...process.env, MYLIMITS_SPIKE: spike ? "1" : "0" },
    stdio: "inherit",
  });
  if (result.error || result.status !== 0)
    throw new Error("Spike build or fixture check failed.");
}
try {
  run(wxt, [process.argv.includes("--zip") ? "zip" : "build"], true);
  const manifest = JSON.parse(
    await readFile(".output-spike/chrome-mv3/manifest.json", "utf8"),
  );
  for (const permission of [
    "cookies",
    "declarativeNetRequestWithHostAccess",
    "webRequest",
  ])
    if (!manifest.permissions.includes(permission))
      throw Error("Spike permission missing.");
  await access(".output-spike/chrome-mv3/spike.html");
  if (!process.argv.includes("--build-only"))
    run(
      path.join(root, "node_modules/@playwright/test/cli.js"),
      ["test", "--config", "playwright.spike.config.ts"],
      true,
    );
} finally {
  run(wxt, ["prepare"], false);
}
