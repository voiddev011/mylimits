# Architecture

MyLimits tracks provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex** and **Cursor** through the account currently signed into each website. Ordinary ChatGPT message/image quotas are not inferred from Codex buckets. Unknown quotas and reset times stay unknown.

ChatGPT saved sign-in is explicitly experimental on Chromium, with a fixed cookie-name allowlist and per-account consent. Other saved-sign-in providers remain off; Firefox does not offer this flow. Website accounts are remembered on verified login switches; remembered cards do not independently refresh. Copilot connections use separate REST tokens (below).

Website readers use exact provider origins: background requests, an existing normal tab, and bounded inactive-tab recovery for eligible browser challenges. Plain unauthorized/rate-limited responses do not open recovery tabs. Cookie signals use only the normal cookie store, not private sessions. Scheduler cooldowns/backoff, per-host locks and connection-generation fences isolate requests and reject late results.

Version-2 local Store holds settings, accounts, website/vault/Copilot connections and dated snapshots. IndexedDB holds reading history. Writes are serialized. Failed reads preserve their observation time. Preferences control refresh, optional notifications, privacy, text size and retention.

The experimental saved-sign-in path uses a private-window verification flow, explicit per-account consent, AES-GCM storage with a non-extractable IndexedDB key, source-bound reads, encrypted-slot deletion and expiry warnings. No credential or ciphertext enters account state, diagnostics, history or exports. Copilot PAT input crosses only the internal setup message before encrypted background storage.

U1 compatibility filtering runs before strict Store parsing. It drops retired providers and connection kinds and their accounts/snapshots. A durable cleanup journal records deleted IDs before state rewriting. IndexedDB cleanup and obsolete-key removal finish before completion is marked; interrupted cleanup retries. Remaining identities, aliases, settings, snapshots and history are retained. Legacy V1 parsing is compatibility-only. Runtime initialization removes obsolete alarms and registered scripts.

## U2 · GitHub Copilot

`copilot-accounts.ts` verifies identity and usage before committing a `copilot:<slot>`
connection. `copilot.ts` uses documented credit billing or explicit experimental entitlement
access with cookie omission and redirect rejection. `token-vault.ts` protects PATs in a separate storage key;
`connection-refresh.ts` integrates source-bound reads, generation fences, history
and backoff. The scheduler enforces 15 minutes even for manual clicks and parks
401 failures until replacement. Allowance is an explicit account-setting override
because the documented usage response exposes no allowance. See [COPILOT.md](COPILOT.md).

## Combined main

Website account changes use generation fences, verified identity and workspace
selection to reuse earlier accounts or create numbered defaults. Projected resets
are display-only; history, badge and alert decisions keep real readings.

History uses existing page/insights/export commands, groups source windows under
account-limit charts without joining gaps, and keeps privacy and pagination.
The static site and release/Pages workflows do not add a provider backend.

## Platforms and permissions

Source builds use Node 24+ and npm. Chrome/Brave use `.output/chrome-mv3`, Edge
`.output/edge-mv3`, Firefox `.output/firefox-mv3`. Firefox has a sidebar; Chromium
has sidePanel. Copilot requires trusted-context storage protection and fails closed
without it; real Firefox token setup is unverified.

Required normal permissions: storage, alarms, scripting, idle, plus Chromium
sidePanel. Optional: notifications and cookies. Exact optional HTTPS origins:
claude.ai, chatgpt.com, cursor.com, api.github.com. No mandatory provider hosts or
native-messaging permission. Notification storage retains the legacy desktopAlerts
key for compatibility; it is a browser notification preference, not an app route.

## Checks and package maintenance

Run `npm ci`, `npm run check`, `npx playwright install chromium`, then
`npm run test:browser`. Latest completed baseline: 222 unit/platform tests and 75
extension/site browser tests. Fixtures do not establish real provider behavior.

Build variants with `npm run build:edge` / `npm run build:firefox`. Package using
`npm run zip` / `npm run zip:edge` / `npm run zip:firefox`. Inspect actual builds and archives with
`node scripts/check-packages.mjs` and `python scripts/check-archives.py`; generate
checksums with `node scripts/package-checksums.mjs`. Guards reject native helper
files, installers, native messaging, secrets, and unexpected extension pages.

## Website and release operations

`site/` is a buildless static site, with no analytics or remote fonts. Test locally
with `npm run test:browser`. Store URLs in `site/assets/config.js` stay empty until
actual listings exist. Update public descriptions/privacy when behavior changes.

For Pages: repository Settings → Pages → Source **GitHub Actions**; then run the
**Deploy website to GitHub Pages** workflow on main. The expected URL is
https://voiddev011.github.io/mylimits/ but it is not live merely because code exists.
Repository visibility and Pages deployment must be checked in GitHub; private
repository Pages eligibility depends on the account plan. A separate public privacy/help host also works and does not
require making the source repository public.

`release.yml` runs on `v*` tags and expects the tag to match package.json. It builds
Chrome/Brave, Edge and Firefox ZIPs and attaches them to a GitHub Release. It does not
submit to browser stores. Private-repository releases are not public downloads.
Do not create a release or change repository visibility without authorization.
See [LAUNCH.md](LAUNCH.md) for the operator's publishing steps.

## Toolbar badge

`Settings.badge` optionally selects Automatic, one account/meter, or Off. Missing
settings retain automatic selection of the lowest fresh reported remaining limit.
A stale chosen reading is grey; an expired reset window is empty, never a projected
reset value. Tooltip names are hidden in privacy mode. Settings changes, startup
and completed refreshes render the badge and tooltip together. Store version stays
2. Legacy `order` and `pinnedMeterIds` are parsed and preserved, but no longer affect
sorting or previews. Account pinning remains available; previews show the first two
meters. No permission or credential handling changes are required.
