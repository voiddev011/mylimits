# Phase 2 handoff — MyLimits 2.1 preview

Date: **16 October 2026**. Working branch: **`v2/phase-2`**. Main and Phase 1
remain preserved. This phase implements P2-01 through P2-10 code; the release
checkpoint is the commit containing this document. Final CI/artifact links are
recorded below after their actual completion. No public deployment, store
publication, purchase, production provider credential or signing certificate.

## Delivered behavior

1. A documented hosted feasibility gate. Production independent collectors remain
   **disabled** because permitted hosted registration/live quota/logout evidence
   is unavailable. The local product remains useful without any service.
2. Optional OIDC/Fastify/PostgreSQL snapshot API: tenancy, revocable device pairing,
   immutable original observation time, idempotency, revisioned preferences and
   source tombstones. No AI website credentials are uploaded by snapshot sync.
3. Durable lease/job/budget/generation and envelope/KMS interfaces tested with
   fixtures only. Empty production collector registry; no fake cloud login.
4. Persistent opt-in extension upload queue and responsive read-focused phone
   dashboard. Sync copies last readings and does not keep an AI account logged in.
5. Original Grok default-mode, Perplexity count-only and Cursor coding/spend readers.
   Gemini's consumer quota remains unverified, so Cursor is the documented third
   integration. Each reader verifies identity before and after usage. All five
   website quota integrations remain **live-unverified prototypes**.
6. Per-source/window history, comparisons and reset timeline, 30/90-day retention,
   gaps/downsampling and conservative pacing ranges from sufficient fresh data.
7. Local task/mode Guide, explainable exclusions, prompt templates/review and
   explicit pasted-text handoff preview/copy/download. No AI requests or scraping.
8. Off-by-default website widget: selected exact hosts, Shadow DOM, corner/collapse/
   hide controls and only formatted public readings. No full-store/page command bridge.
9. Chrome/Brave, Edge and Firefox MV3 builds; Firefox sidebar/event-page fallback
   and optional configured-sync data consent. Native setup is absent on Firefox.
   Optional unsigned Windows NSIS installer, detection GUI, Start-menu entries,
   owned per-user registry/task cleanup and explicit local-profile deletion choice.
10. Signed-token, deletion race, source replay, stale queue, retention/resource-cap
    and actual HTTP transport hardening; service/platform checks added to CI.

## Actual local verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed: types, 90 core tests, 17 native/companion tests, default production build |
| `npm run test:browser` with Playwright Chromium | 19/19 passed: migration/restart, compact rows, aliases, source modes, history/retention, Guide privacy and widget isolation/two tabs |
| Focused checks after lifecycle changes | Recorded in final status/CI checkpoint; do not infer live provider results |
| `npm run check --prefix server` | Passed: server types and 30 real-PostgreSQL API/auth/job tests, fresh and repeated migrations |
| `npm run test:web --prefix server` | 1 passed: real-DB responsive phone readings, pairing approval and sign-out |
| `npm run test:transport --prefix server` | 1 passed: actual built extension pairs over HTTP, uploads original dated reading and deletes source data |
| Chrome/Edge/Firefox package contracts | Passed: browser-specific APIs/entrypoints and optional exact hosts |
| ZIP/archive checks | Actual Chrome/Firefox manifests inspected; no test host grants, credentials or generated artifacts |
| NSIS compilation | Actual unsigned Windows EXE plus SHA-256 compiled on Linux; live desktop install is not implied |
| Visual review | Widget and 390px phone screenshot inspected; long names and controls fit |

The system Chromium did not load unpacked extensions, so tests use downloaded
Playwright Chromium. Headless Chrome cannot approve host prompts; widget/transport
fixtures use a separate temporary extension copy granted only its synthetic host.
Production artifacts retain optional grants and no backend URL. Provider HTTP is
blocked in browser fixtures. App OIDC tests use real signatures with test keys,
plus synthetic server-owned sessions; no production fixture login exists.

Initial Windows CI found a null/empty detection-list bug in GUI setup. It is fixed
with explicit candidate parsing and empty/multiple-list regression checks. Final
Windows CI must pass parsing, headless GUI construction and installer compilation;
these still do not certify real browser/native install behavior.

## Install / update

Download **mylimits-extension-packages** from the verified Checks run linked below.
Extract `mylimits-2.1.0-chrome.zip`, then Load unpacked in Chrome/Brave/Edge using
the folder containing manifest.json. For a preview update, replace files in the
existing folder and Reload; keep its path/extension ID and do not uninstall first.
No companion, backend account or manual login window is needed for basic tracking.

For source builds use Node 24+, `npm ci`, `npm run build`, then load
`.output/chrome-mv3`. `npm run dev` watches edits for frequent testing.
[Firefox/Edge/Windows details](PLATFORMS.md) and [README](README.md) cover exact paths.
Firefox temporary installs need 140+ and disappear on restart; signing is external.

Local packaged extension paths:

- `.output/mylimits-2.1.0-chrome.zip`
- `.output/mylimits-2.1.0-firefox.zip`
- `.output/SHA256SUMS`
- `artifacts/mylimits-companion-windows-unsigned.exe` plus `.sha256`

The native installer requires Node 24+ and the official Codex CLI; it is optional
advanced setup, not a dependency of the extension. It is explicitly unsigned.

## Architecture, migrations and operational bounds

Local `Store.version` remains **2**. V1 remains a frozen five-provider input;
Phase 1 V2 gains a disabled Cursor source and preserves browser-only modes/aliases.
No account ID, extension ID or native bridge secret changes. Retention defaults
30 days unless explicitly changed to 90. Independent native sources stay separate.

Server migrations are immutable/checksummed: 001 core; 002 jobs/credentials;
003 pairing; 004 source tombstones; 005 source-history index. Run
`npm run migrate --prefix server` after installing separate server dependencies.
[SERVER-SETUP](SERVER-SETUP.md) describes OIDC configuration and all commands.

No MyLimits sync server is configured in default builds. A configured build uses
`MYLIMITS_SYNC_ORIGIN`, exact optional grants, separate MyLimits OIDC sign-in and
explicit device approval. Production needs a real OIDC registration, HTTPS,
database operations/backups, shared ingress budgets and operational acceptance.
A future independent collector additionally needs a passed provider gate, permitted
registration, supported quota access, production KMS adapter and live renewal/
revocation checks. It cannot be enabled by an environment switch alone.

At a five-minute interval there are **288 refresh cycles/day/connection** before
retries/manual checks. Healthy Grok/Perplexity/Cursor readers use three fixed quota/
identity requests per cycle (**864/day/source**), Claude three and ChatGPT two;
page fallback/retries can add traffic. Website concurrency is two, per-source
manual cooldown is 15 seconds and persisted backoff caps retry frequency. Native
profiles poll once per minute and request account identity plus limits; no prompts
or approvals. Widget queries are local reads once per minute per open widget tab,
with debounced update notices, and do not directly initiate provider refreshes.
Snapshot sync runs every five minutes, at most five batches of twenty per pass.

Server bounds: 512 KiB bodies, 100-item batches, 200-point pages, 120 authenticated
requests/owner/minute/process; anonymous auth/pairing budgets; 20 active/200 total
devices, 100 active/1,000 retained accounts, 2,000 source mappings. Hourly maintenance
and upload prune 30/90-day history; one dated latest source reading is retained.
Resource caps retain at most 20,000 older samples plus those latest readings.
Disconnect/forget tombstones cannot be overwritten by old uploads/jobs.

Measured Linux headless fixture: six cached account rows rendered in **230 ms** at
520×600 CSS pixels, with all rows visible. This is a fixture measurement, not a
Windows/DPI performance promise. Default uncompressed Chrome bundle: approximately
**717 kB**, Firefox **715 kB**; ZIPs approximately **222/222 kB**. Optional web bundle
approximately 324 kB JS (99 kB gzip). No chart dependency added.

## Pending external acceptance

- Real provider plan/model/window, tab closure, other-device usage, ordinary/global
  logout, revocation and renewal checks for every source, including the companion.
- Real Windows Chrome/Brave/Edge GUI/native clean install/update/uninstall and DPI.
- Firefox temporary install/provider/session/data-consent and widget checks.
- Real managed OIDC tenant sign-in and production operations; configured service
  transport fixtures are not public deployment or a hosted provider grant.
- Store signing/submission and native certificate signing. No macOS native package.

The companion stays optional. Unknown limits stay unknown. No universal real-time,
logout-independent or production-cloud capability has been established.

## CI / published checkpoint

Final CI run and artifact IDs: pending the final code checkpoint below. See
[implementation status](IMPLEMENTATION-STATUS.md) for the latest verified link.
Stop after this Phase 2 handoff; further work requires the user's next instruction.
