# MyLimits 3.0 handoff

Branch: **v3/redesign**. Baseline matches the user's merged main tree
`8b6714f600fe465ed5994ef292442e04b7a90254` exactly. Main remains unchanged.
Implementation checkpoint published as `1b9f9e6aac14b8bd2c805624f458c2ff6facb970`;
its tree matches local checkpoint `a639ce7` exactly. Subsequent branch commits add
privacy edge-case fixes, this handoff and final evidence.

[Install/update](INSTALL.md) · [Plan/research](V3-IMPLEMENTATION-PLAN.md) ·
[Chronological checks](IMPLEMENTATION-STATUS.md) · [Provider assets](PROVIDER-ASSETS.md)

## Implemented

- Guide/prompt/handoff feature removed from shipped code; legacy `#guide` opens Overview.
- Genuine local logos for OpenAI, Claude, Gemini, Grok, Perplexity and Cursor.
- Clean four-tab dashboard, readable section/type hierarchy, Standard/Large option,
  responsive forms, controls and long-name handling. Popup is 440px wide/max560px:
  limits, refresh, +, full dashboard; six normal-size rows fit, larger sets scroll.
- + opens account setup in dashboard; account clicks open corresponding details.
  Names, pins, alert preferences, IDs and history survive. Browser account saving
  explicitly retains last readings; it is not independent authorization.
- Needs attention filter, reset clocks in expanded details, saved privacy mode,
  private notifications, safe diagnostics and install/update help. Privacy mode
  hides history/exports and existing search/nickname text; original aliases remain.
- Optional round floating preview on exact selected AI hosts. Off by default, no
  connected account required, always starts closed. Click → **Coming soon** only.
  Close/Escape/outside click, four corners, hide on site/global off, Shadow DOM.
  Receives no account/readings/prompt/conversation data. No page text scraping.
  Existing widget site/corner preferences migrate without enabling extra sites.
- Optional OpenAI helper: isolated official Codex homes and fresh local browser
  profile per authorization; new native protocol keeps authorization URLs out of
  the extension. Matching email hints warn about possible duplicate sign-in; no
  email/hash leaves helper memory, and no accounts/workspaces are auto-merged.
- Real unsigned Windows x64 installer bundles pinned/checksummed Node 24.22.0 and
  official Codex 0.163.0, upstream notices and Start-menu setup/uninstall. Basic
  extension needs no helper. Old helper compatibility remains with update guidance.

## Actual verification

- TypeScript: passed.
- Core: **99 passed**, including old-store settings/migration, identity ownership,
  alerts, privacy projection/notifications, diagnostics and preview contracts.
- Companion: **20 passed**, including actual child-process RPC, isolated auth
  browser arguments, independent profile limits and conservative duplicate hints.
- Chromium: **26 passed**. Covers migration/IndexedDB/history, multi-account setup,
  six rows, long names, dark theme, keyboard focus, persisted Large text/privacy,
  200% text enlargement, real bundled logo loading, no-account preview opt-in,
  hostile page CSS, trusted controls, corner persistence, Escape/outside close,
  on-site Hide persistence, disabled removal and message access boundaries.
- Chrome, Edge, Firefox production builds passed. Browser-specific manifest and
  packaged archive checks passed: six optional AI hosts, no all-sites grant,
  no automatic content script, all local logos, no Guide tools or private files.
- Chrome and Firefox extension ZIPs + SHA256SUMS generated in `.output/`.
- Actual NSIS installer compiled: **196,690,078 bytes** and SHA256. This is a PE
  distribution artifact, not proof of installation on a real Windows account.
- Server TypeScript passed locally. Auth test passed; API/job tests refused to run
  without an isolated PostgreSQL URL. CI PostgreSQL API/job and phone-web checks passed. The initial transport fixture
  needed to open the new Advanced section; corrected in the final branch commit.
  See final status evidence for the rerun. No tests were silently skipped.

## Published evidence

Verified application checkpoint: `cc29f5ac4f4c7dccdea1c168a4c2f23479cc9671`.
Local checkpoint `9ffa3d9` has exactly the same tree
`16181f016e732efc2936a0c132fa1b0def9f91bb`. GitHub publication used an expected-head
lease and no force update. Main was preserved.

[Checks run 38931432647](https://github.com/voiddev011/mylimits/actions/runs/38931432647)
passed extension verification and all connected-service checks, including corrected
HTTP pairing/upload/deletion against real isolated PostgreSQL. The extension
[artifact](https://github.com/voiddev011/mylimits/actions/runs/38931432647/artifacts/12058862247)
contains the Chrome/Firefox ZIPs and their SHA256SUMS.

All three jobs on run 38931432647 passed, including Windows native logic, real
PowerShell parsing/GUI construction and bundled installer compilation. The optional
helper artifact is [available here](https://github.com/voiddev011/mylimits/actions/runs/38931432647/artifacts/12058892440).
A subsequent style-only correction fixes the official adaptive OpenAI SVG on its
light logo tile; its rendered pixels are tested under dark browser preference. Interactive OS/provider acceptance remains pending regardless of CI.

Screenshots (sample fixtures only, ignored artifacts): `dashboard-preview.png`,
`compact-popup-six-accounts.png`, `v3-floating-preview.png` under `artifacts/`.
No live provider access or credentials were available.

## Packaging / testing

```sh
npm ci --include=optional
npm run check
npx playwright install chromium
npm run test:browser
npm run build:edge
npm run build:firefox
node scripts/check-packages.mjs
npm run zip
npm run zip:firefox
node scripts/package-checksums.mjs
python scripts/check-archives.py
```

Windows optional helper: install NSIS then `npm run package:companion`.
Official downloads occur at package time only and must match pinned digests.
Build requires `tar` (Windows built-in tar is supported), plus `unzip` on Linux.
The unsigned installer is separate from extension ZIPs. Upstream dependencies
remain outside Git under ignored `artifacts/dependency-cache`.

## Pending before public release

1. User-owned real accounts: two distinct OpenAI authorizations, correct account
   choice, returned quota changes from another device, browser website logout,
   expiry/renewal/revocation and reconnect. Official Codex ownership keys are not a
   universal workspace key; duplicate warnings are intentionally conservative.
2. Real Windows 10/11 x64: clean install with no global Node/Codex, discovery/manual
   ID, permission/native host/task startup, authorization window, update/uninstall,
   profile retention/deletion and no elevated task. CI parsing/compilation cannot
   substitute for these interactive acceptance checks.
3. Firefox and Edge live desktop checks; Firefox permanent distribution needs
   Mozilla signing. Browser fixtures used Chromium, not actual OS DPI certification.
4. Store listing/privacy/brand review and signing. Provider logos identify services;
   their trademarks remain theirs. No automatic store submission was performed.

Ordinary ChatGPT model/image/upload quotas remain unknown. Independent Claude is
not implemented or advertised. No new remote backend or hosted provider sessions
were deployed. Snapshot sync does not confer provider authorization. Existing
provider readers remain live-unverified prototypes; failed/stale readings never
become fresh quota or synthetic reset balances.
