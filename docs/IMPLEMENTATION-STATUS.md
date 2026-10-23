# MyLimits 2.0 implementation status

Updated: **16 October 2026**. **Phases 1 and 2 verified in available automation; live/manual checks remain pending.** No cloud deployment or
credential upload has been performed.

## Active checkpoint

- Requested work: user-authorized compact popup and explicit multi-account setup upgrade.
- Current work package: 2.2 delivered paths verified; independent Claude/other-provider authorization remains unavailable.
- Next action: use the packaged preview; live provider/Windows acceptance remains pending. No additional product work is assumed.
- Historical working branch (now deleted after consolidation): `v2/compact-accounts`; published code `7a8f48fb76babfa9b02e29a02e01fc339bb68441`.
- Main and completed Phase 1/2 branches preserved.
- Current handoff: [compact accounts upgrade](COMPACT-ACCOUNTS-HANDOFF.md).
- Historical scope: [Architecture and retained contracts](ARCHITECTURE.md), [Historical implementation status](IMPLEMENTATION-STATUS.md), [Historical implementation status](IMPLEMENTATION-STATUS.md).

## Task ledger

Allowed states: `not_started`, `in_progress`, `implemented`, `verified`, `blocked`.
`implemented` means code exists but its specified checks are incomplete.
`verified` requires the task's available automated evidence; live/manual claims
remain separately recorded. Never mark an unsupported integration complete
because a generic stub builds. A task with one external check blocked may list
implemented independent work while leaving that specific check pending.

| Task | Points | State | Evidence / commit / blocker |
| --- | ---: | --- | --- |
| P1-01 | 8 | verified | See checkpoint below.
| P1-02 | 12 | verified | See checkpoint below.
| P1-03 | 10 | verified | See checkpoint below.
| P1-04 | 10 | verified | See checkpoint below.
| P1-05 | 10 | verified | See checkpoint below.
| P1-06 | 10 | verified | See checkpoint below.
| P1-07 | 12 | verified | See checkpoint below.
| P1-08 | 8 | verified | See checkpoint below.
| P1-09 | 8 | verified | See checkpoint below.
| P1-10 | 12 | verified | See checkpoint below.
| **Phase 1 total** | **100** | **verified** | 62 core + 16 companion + 15 browser tests; packaged; live/manual checks pending. |
| P2-01 | 8 | verified | See checkpoint below. |
| P2-02 | 12 | verified | See checkpoint below. |
| P2-03 | 12 | verified | See checkpoint below. |
| P2-04 | 8 | verified | See checkpoint below. |
| P2-05 | 12 | verified | See checkpoint below. |
| P2-06 | 10 | verified | See checkpoint below. |
| P2-07 | 10 | verified | See checkpoint below. |
| P2-08 | 8 | verified | See checkpoint below. |
| P2-09 | 10 | verified | See checkpoint below. |
| P2-10 | 10 | verified | See checkpoint below. |
| **Phase 2 total** | **100** | **verified** | 90 core + 17 companion + 19 browser + 30 server + 2 service/browser checks; all three CI jobs pass. External gates remain recorded. |

Points are relative estimates, not elapsed time. Record changes to remaining
estimates and the reason; do not alter completed effort or add filler to disguise
an unavailable provider/cloud capability.

## Decisions already made

1. Keep the existing WXT/React/TypeScript/Zod stack, explicit unit runner and
   Node 24+. Use one workstream; no parallel agents in this handoff.
2. Exactly two implementation phases, each estimated at 100 points.
3. Local website connection is the default; native/cloud connections are optional.
4. Accounts, workspaces, connections and snapshots are distinct. Preserve V1 data.
5. Provider-reported quota, local counts and estimates are never interchangeable.
6. Ordinary tab closure, website logout, collector revocation and global logout
   are different checks. Backend hosting does not override invalid credentials.
7. All project-owned Markdown lives directly in `docs/`.
8. Verification applies only to the recorded commands/evidence; live provider claims remain pending.

## External verification currently pending

- Real signed-in provider comparisons, plan/workspace differences and shared
  phone/other-browser quota updates.
- Ordinary website logout, collector revocation, renewal and global logout for
  each separate connection type.
- Actual Windows Chrome/Brave display scaling and native host behavior.
- Hosted provider authorization/registration and exact quota-resource access.
- Other-browser/native packaging/signing and any production cloud vendor setup.

## Checkpoint entry template

Append a compact entry after each task; replace the active checkpoint above.

```text
Task / state / date:
Branch / commit:
Changed files and behavior:
Commands actually run and results:
Live/manual checks performed or still pending:
Decisions / contract changes / revised estimates:
External blockers (precise missing access or failure):
Next executable action:
```

The original documentation-preparation checkpoint preceded implementation. The
subsequent entries below record actual application work and verification.

## P1-01 checkpoint — 16 October 2026

State: **verified**. Verified all 73 published baseline blobs match the workspace before preserving them in a local baseline commit. Created local and remote v2/phase-1 branches; main remains unchanged. Node 24.19.0/npm 11.9.0 and dependencies are available. Baseline typecheck, 35 core tests and production WXT build pass. Companion tests: 15/16 pass; the real child-process fixture fails in this sandbox (standalone spawnSync reports EPERM). Browser fixtures cannot launch Chromium: setsockopt is denied and Chromium exits SIGTRAP. These are concrete environment blockers, not live provider evidence. Direct Git fetch fails because the shell proxy is unreachable; publication uses the authorized GitHub connector. Added the capability matrix; all live/provider/Windows checks remain pending.

Next: P1-02 — implement V2 domain and public contracts.

## P1-01 checkpoint — 16 October 2026

State: **verified**. Resolved the baseline process-sandbox blockers by running the local fixture command with approved process permissions: companion tests now pass 16/16. Chromium fixtures are being retried with the same approved process access; no provider traffic or real accounts are used.

Next: P1-02 — implement V2 domain and public contracts.

## P1-02 checkpoint — 16 October 2026

State: **verified**. Added explicit connection/workspace/snapshot contracts, validated V2 schemas, generation fencing, account read-model projection and allowlisted public state. Added four domain regression tests and retained the 35 existing tests. Type checking and all 39 core tests pass. Account meters/status remain a materialized read projection inside the same aggregate for existing UI/parser compatibility; connection snapshots are authoritative for source reconciliation, not a second independent store. Baseline browser fixtures passed 10/10 with approved process permissions.

Next: P1-03 — implement resumable V1-to-V2 migration.

## P1-03 checkpoint — 16 October 2026

State: **verified**. Added strict legacy parsing, a V1 backup, V2 state/pointer keys and resumable migration journal. IndexedDB upgrades preserve legacy readings and add idempotency/pagination indexes. Added crash-after-each-write, retry, history failure, malformed/future version and preservation tests. Type checking and 43 core tests pass. Actual browser IndexedDB migration coverage will run at the integration gate.

Next: P1-04 — adapt existing readers and native snapshots to V2 reconciliation.

## P1-04 checkpoint — 16 October 2026

State: **verified**. Adapted existing readers to V2 snapshots and preserved independent native sources. Added Claude workspace choice from validated membership, strict unavailable-selection handling, fixed-origin request-local authentication, sanitized choices and retry timing. Native cold-start readings retain their original age. Type checking and 47 core tests pass; legacy cold-start assertion now compares retained normalized readings, preserving its original behavior guarantee.

Next: P1-05 — add source-aware account and connection commands.

## P1-05 checkpoint — 16 October 2026

State: **implemented**. Added validated account pin/order/snooze preferences, source disconnect and verified workspace commands, plus generation-safe website enable/disable and forget behavior. Native disconnect now retains remembered readings; forgetting explicitly deletes data. Added action regressions for names, workspace membership, invalid reorder and collector shutdown. User-facing controls are integrated in P1-07; no live revocation is claimed.

Next: P1-06 — implement persisted refresh policy and request coordination.

## P1-06 checkpoint — 16 October 2026

State: **verified**. Added a two-slot refresh coordinator, same-source coalescing/cancellation, persisted generation/attempt/backoff state, Retry-After handling and startup/open/tab recovery policies. Added fake-clock and concurrency tests; type checking and 54 core tests pass. Browser observation updates retain their original reported-meter age and are stored in source snapshots. Account controls from P1-05 are ready for UI integration.

Next: P1-07 — build the compact shared interface and account controls.

## P1-05 checkpoint — 16 October 2026

State: **verified**. Completed UI integration in P1-07: rename, pins, order, per-account thresholds, source disconnect, reconnect and workspace controls are available. Production browser regressions for rename persistence, denied access, native independent accounts and remembered disconnect pass.

Next: P1-08 — implement timing-aware notification delivery.

## P1-07 checkpoint — 16 October 2026

State: **verified**. Rebuilt shared popup/dashboard/side-panel surfaces with compact account rows, two pinned meters, clear source age/status, Accounts/History/Settings screens, optional advanced companion, keyboard Escape and light/dark themes. Type check, production build and all 10 adapted regression browser fixtures pass. Visually inspected the captured dashboard preview. Added an explicit six-account fit and pin-persistence integration case for the final gate; actual Windows DPI remains unverified.

Next: P1-08 — implement quiet hours, snooze and confirmed reset notifications.

## P1-08 checkpoint — 16 October 2026

State: **verified**. Implemented overnight local quiet hours, per-account snooze, scoped deduplication with legacy-ledger compatibility, conservative fresh-reading reset confirmation and used/remaining badge semantics. Failed notification delivery restores its ledger entry for retry. Added timing, no-false-reset and migration-dedup tests; all 58 core tests and type checking pass. No timestamp-only reset claim is made.

Next: P1-09 — finish paginated history, export and data controls.

## P1-09 checkpoint — 16 October 2026

State: **verified**. Implemented real IndexedDB pagination with stable timestamp/ID cursors, snapshot deduplication, 30-day pruning, safe JSON/CSV export, date filters, basic observation bars and confirmed history clearing. Exports allowlist fields and disarm CSV formulas. Serializing accepted-history writes prevents forgotten accounts from being reinserted. Browser checks verified pagination, retention, source metadata and V1 history migration across a real browser restart. Fixed an IndexedDB auto-key write issue caught by those tests. Added pruning of forgotten accounts from local recovery copies and late-native-source tombstones; final integration verifies these additional deletion cases.

Next: P1-10 — run integrated checks, package and prepare the Phase 1 handoff.

## P1-10 checkpoint — 16 October 2026

State: **in_progress**. Initial integrated gate passed: TypeScript, 62 core tests, 16 companion tests and production build; all 14 browser fixtures passed. Final inspection found two refresh edge cases: a manual/startup retry could bypass persisted backoff and page-context fallback dropped Retry-After. Hardened these and explicit offline reporting; added controller/history offline and shared-surface keyboard/layout checks. Final gate will be repeated after these code changes. Changed files: src/core/scheduler.ts and its test, src/providers/adapters.ts, tests/browser/extension.spec.ts, package manifests and wxt.config.ts; release documentation in progress.

Next: P1-10 — finalize integrated checks, documentation, ZIP and publication.

## P1-10 checkpoint — 15 October 2026

State: **in_progress**. Final integration passed: npm run check (TypeScript, 62 core tests, 16 companion tests, production build) and 15/15 production browser fixtures. npm run zip passed. Package inspection caught and fixed WXT display-version naming: explicit manifest version 2.0.0 and package-version ZIP template now match installation docs. Follow-up typecheck passed. Archive: .output/mylimits-2.0.0-chrome.zip, 175641 bytes, SHA-256 af171f5062c27578296863c79f3cafc618fa33a14c83fa0d6814d6907bc1de94; manifest/entrypoints/permission allowlist/CRC verified. Changed files: wxt.config.ts, package manifests, scheduler and transport hardening, browser regression suite; final release docs pending publication. Live provider, other-device, logout and actual Windows browser/native checks remain pending.

Next: P1-10 — publish final documentation and verify the branch/package handoff.

## Changed-file index

The task-to-file and local checkpoint map is maintained in
[PHASE-1-HANDOFF.md](PHASE-1-HANDOFF.md#changed-files-and-task-checkpoints).
New tests are explicitly imported by `scripts/run-tests.mjs`; the final browser
suite is `tests/browser/extension.spec.ts`. All authored Markdown remains directly
in `docs/`. No Phase 2 files or implementation tasks were started.

## P1-10 checkpoint — 15 October 2026

State: **verified**. P1-10 complete. Changed files: package.json/package-lock.json, wxt.config.ts; final retry/offline hardening in src/core/scheduler.ts and src/providers/adapters.ts; regression additions in tests/browser/extension.spec.ts; docs/README.md, ARCHITECTURE.md, SUPPORT.md, PRIVACY.md, PROVIDER-CAPABILITIES.md, START-HERE.md, BUILD-STATUS.md and new PHASE-1-HANDOFF.md. npm run check passed (TypeScript, 62 core + 16 companion tests, production build), all 15 browser fixtures passed, npm run zip and final configuration typecheck passed. Archive manifest/permissions/entrypoints/CRC/path inspection passed; 16 Markdown files passed direct-docs placement, links and fence checks; git diff --check passed. GitHub implementation checkpoint b54109e passed Checks run 38739932337, including Linux browser/package artifact and Windows logic jobs. Local ZIP is .output/mylimits-2.0.0-chrome.zip (175641 bytes; SHA-256 af171f5062c27578296863c79f3cafc618fa33a14c83fa0d6814d6907bc1de94). Main remains unchanged; final docs publication verification follows. No live provider, other-device/logout, Windows desktop scaling or native host launch was available; these remain explicitly pending in support/capability docs. No application backend or Phase 2 work was added.

Next: Await user Phase 1 acceptance; stop before Phase 2.

## P1-10 checkpoint — 15 October 2026

State: **in_progress**. Final publication inspection found a real packaging blocker despite successful Checks run 38739932337: upload-artifact skipped the hidden .output folder and produced no Chrome artifact. Job logs confirmed include-hidden-files=false and no-files warnings. Fixed .github/workflows/checks.yml to include hidden files for the narrowly scoped ZIP/results paths and make a missing ZIP a hard failure. Runtime/core/browser checks remain passed; corrected CI artifact availability must be verified before completing handoff. This changes packaging only and does not start Phase 2.

Next: P1-10 — verify corrected CI ZIP upload, then publish the handoff.

## P1-10 checkpoint — 15 October 2026

State: **verified**. Release gate complete after fixing CI delivery. Changed final files: .github/workflows/checks.yml (include hidden output on scoped paths; fail on missing ZIP), docs/README.md, ARCHITECTURE.md, SUPPORT.md, PROVIDER-CAPABILITIES.md, START-HERE.md, BUILD-STATUS.md, PHASE-1-HANDOFF.md and this ledger; privacy was updated in P1-09. Corrected GitHub checkpoint 571b251 passed run 38740486309: both Linux verify/browser/package and Windows logic jobs succeeded. Artifact mylimits-chrome ID 11975222283 exists, is not expired and is linked from README/handoff. Extracted local ZIP smoke passed on all three surfaces at manifest version 2.0.0. Final evidence remains 62 core + 16 companion + 15 browser tests, successful type/build/ZIP and archive inspection; 16 directly stored docs passed links/fences/location checks. Main was verified unchanged at 380125a8cdc411c7c49d6aac8e61e159315950e5. Final docs publish will be verified by full Git tree comparison. Provider/live logout/cross-device and actual Windows browser/native checks remain pending; no Phase 2 implementation or backend was started.

Next: Stop here. Await user Phase 1 acceptance and explicit Phase 2 instruction.

## P2-01 checkpoint — 15 October 2026

State: **verified**. Read repository instructions, Phase 1 handoff, Phase 2 tasks and shared contracts. Clean local Phase 1 tree preserved; local and remote v2/phase-2 branches created from their matching Phase 1 content. Changed docs/HOSTED-FEASIBILITY.md, PROVIDER-CAPABILITIES.md and this ledger. Reviewed current official OpenAI App Server/SIWC, Google, xAI and Perplexity docs; no hosted registration/test account exists. Decision: production independent collection disabled, continue snapshot-only sync and test-only job seams. No live logout/renewal claim. Node 24.19.0/npm 11.9.0; network/Docker access verified using approved process execution; no configured provider secrets or identities. Documentation links checked against the retrieved first-party sources. Next package may build a locally runnable service without deploying it.

Next: P2-02 — implement the optional authenticated PostgreSQL snapshot API.

## P2-02 checkpoint — 15 October 2026

State: **in_progress**. Implement a separate Fastify/PostgreSQL package with shared normalized snapshot contracts. Authentication uses a configured OIDC verifier; tests inject a verifier only under test mode. Device-bound source mappings keep browser hashes isolated and deletion tombstones prevent old uploads from recreating data. No public deployment or vendor registration. Run real PostgreSQL API integration tests in an isolated local container.

Next: P2-02 — implement schemas, Postgres migrations, authentication and tenant API tests.

## P2-02 checkpoint — 15 October 2026

State: **verified**. Implemented server/package.json and lockfile, TypeScript config, src/app.ts/auth.ts/oidc.ts/config.ts/db.ts/service.ts/main.ts/migrate.ts, migrations/001_core.sql, tests/api.test.ts, .env.example; shared src/core/sync-contracts.ts and docs/SERVER-SETUP.md. Root TS excludes the separate server; Node loader now preserves normal dependency JS resolution. Real isolated PostgreSQL 17 is running on loopback with synthetic data. Server typecheck and all 11 API/database tests pass; root typecheck and all 62 core regressions pass. Tests include two-tenant isolation, forged owners, device binding, duplicate/old uploads, pagination, revision conflict, deletion tombstones, revocation, callback binding, origins/limits and unconfigured-auth rejection. No OIDC tenant/client or live provider grant is configured. API remains snapshot-only; a cloud refresh returns explicit unavailability rather than a fake quota.

Next: P2-03 — implement gated durable jobs, credential boundaries and race tests.

## P2-03 checkpoint — 15 October 2026

State: **in_progress**. Continue in one workstream. Use PostgreSQL leases, connection generations and provider budgets. Keep the production collector registry empty because P2-01 did not pass; implement credential/KMS and worker behavior with guarded test-only collectors. Do not expose provider OAuth login or pretend hosted authorization is configured.

Next: P2-03 — implement leased jobs and tenant-bound credential rotation fixtures.

## P2-03 checkpoint — 15 October 2026

State: **verified**. Changed server/migrations/002_jobs_credentials.sql, src/jobs.ts/credentials.ts/worker.ts, app/service deletion/refresh paths, package script, tests/jobs.test.ts and docs/SERVER-SETUP.md. Implemented PostgreSQL leases/coalescing, persisted per-provider budgets, six-attempt bounded retry, auth pause, generation/identity validation and redacted failures. Tenant-bound AES-GCM envelopes require an external KMS interface; no production KMS or provider collector is configured. Synthetic-only collectors/KMS are guarded against non-test environments. Revocation cleanup is bounded and cannot remove a replacement credential generation; explicit data deletion removes envelopes. Server typecheck and 22 real PostgreSQL API/job tests pass, including worker crash, rotation race, throttling, late result after disconnect and stale cleanup. Root typecheck passes. Production provider OAuth and live renewal remain gated/unimplemented until P2-01 prerequisites exist.

Next: P2-04 — implement opt-in device pairing, snapshot queues and responsive dashboard.

## P2-04 checkpoint — 15 October 2026

State: **in_progress**. P2-02/03 checkpoints pushed to remote v2/phase-2 at 7f8ed4f. Implement build-configured optional snapshot sync, one-time user-approved device pairing, private device credentials, persisted acknowledgement/deletion queues and a same-origin responsive dashboard. Local-only/preview paths must issue no sync requests. Do not merge source identities by matching local hashes or refresh the age of old samples.

Next: P2-04 — implement pairing, persisted sync, preference conflicts and mobile dashboard.

## P2-04 checkpoint — 15 October 2026

State: **verified**. Changed core sync.ts/sync.test.ts/sync-contracts.ts/sync-origin.ts/remote-view.ts, private platform sync transport/controller/messages, SyncSettings/App UI, WXT fixed-origin configuration and env declaration; server pairing/source-tombstone migrations, pairing/web/OIDC/API/service code, responsive React dashboard, Vite config/dependencies and real phone/API tests; SERVER-SETUP and PRIVACY docs. Sync is off by default with no endpoint/extra host grant unless explicitly configured at build time. Pairing is user-approved, expiring, secret-bound and single-use. Acks/backoff/deletion survive restart; lost acknowledgements are covered by source tombstones. Preferences are explicit/revisioned; server-origin changes cannot receive old tokens. Verification: root typecheck + 70 core tests pass; server typecheck + 25 real PostgreSQL API/job tests pass; phone dashboard real-service browser test passes; production extension build passes (570.91 kB) and all 15 extension browser fixtures pass. Visually reviewed phone UI and fixed setup clutter/button wrapping; repeated phone check passes. Real OIDC/provider sign-in and deployed cross-device service remain unconfigured, not live-verified. No hosted provider collector was enabled.

Next: P2-05 — research and implement viable additional quota readers without inventing consumer limits.

## P2-05 checkpoint — 15 October 2026

State: **in_progress**. Proceed with prioritized quota integrations. Keep the current local activity counters separate. No live consumer accounts are available, so a usable documented or source-backed resource and sanitized response contracts are required; blocked candidates must be named explicitly, not filled with fake cap values. Continue existing fixed-origin/optional-permission/generation boundaries.

Next: P2-05 — inspect primary/source evidence for Grok, Perplexity, Gemini and feasible coding-plan quotas.

## P2-05 checkpoint — 15 October 2026

State: **verified**. Changed providers/additional.ts and tests, reader/transport/catalog, core meter display/model/schema/public/history export, frozen V1 schema and V1/V2 migration tests, controller/messages and account source controls, WXT Cursor origin, web count display and browser fixtures. Implemented Grok subscriptions identity plus default-mode quota POST, Perplexity signed-in identity plus remaining-count quotas, and Cursor stable subject/coding-plan/spend reader. Identity is rechecked after usage to reject mid-read account switches. Count-only/monetary/percentage values remain distinct; unknown totals/reset times are not inferred. Grok/Perplexity activity-only mode remains available; old browser-only bindings preserve that mode. Cursor is the explicit fallback for Gemini’s unverified consumer account/quota path. All three are source/fixture-tested prototypes, not live-verified. Added source evidence and current capability matrix under docs/. Root typecheck and 78 core tests pass; server typecheck and 25 PostgreSQL tests pass; production build passes (580.36 kB); all 16 extension browser fixtures pass, including counts/mode switch and original V1 migration. Connector version tag updated to website-v2.1; final integrated build will include it. Live plan/tab/logout/other-device checks remain pending.

Next: P2-06 — implement segmented history, reset timeline, retention and conservative pacing.

## P2-06 checkpoint — 15 October 2026

State: **in_progress**. Preserve existing pagination/export and all known gaps. Add 30/90-day retention, bounded downsampled series, separate reported spend, reset timeline and minimum-evidence range estimates. Unknown windows, local activity, sparse/stale/reset-crossing or source-changed data must not produce fabricated forecasts or messages-left estimates.

Next: P2-06 — implement history series and pacing using same-source/window samples only.

## P2-06 checkpoint — 16 October 2026

State: **verified**. Changed core insights/history-data/model/schema, history platform/controller/messages, HistoryCharts/HistoryView/preferences/styles, server retention and tests. Separate account/source/workspace/scope/window/evidence/currency series; bounded downsampling and honest gaps; minimum four fresh readings over 30 minutes with bounded robust rate quartiles and padded range. Selectable immediate local 30/90-day retention; server prunes older history on upload while keeping one dated last-known reading per source. No messages-left, subscription fees or token cost invented. Typecheck passed; 82 core tests passed; 26 PostgreSQL server tests passed; production build passed at 590.23 kB; three existing history browser fixtures and new chart/retention fixture passed with Playwright Chromium. System Chromium failed to load extensions, so browser verification used downloaded Chromium instead. Live provider access remains unavailable.

Next: P2-07 — implement local task guidance and explicit prompt/handoff utilities.

## P2-07 checkpoint — 16 October 2026

State: **in_progress**. Guidance stays local and read-only. Match actual quota scope to a task, explain stale/unknown exclusions, and expose user-supplied text preview/copy only. No conversation scraping, inference calls or fixed token savings.

Next: P2-07 — build deterministic guidance and private prompt utilities, then verify.

## P2-07 checkpoint — 16 October 2026

State: **verified**. Changed core/guide.ts and tests, GuideView, dashboard navigation/styles, runner, architecture and browser fixture. Original deterministic task/scope rules, dated cited product metadata, speed/quality/usage mode suggestions, explicit exclusions, reported reset and optional matching local pacing context. Prompt templates/review and user-pasted handoff preview/copy/download remain component-memory-only; edits invalidate previews. No inference, scraping, fabricated token savings or model entitlement assumptions. Typecheck passed; 86 core tests passed; build passed at 601.9 kB; Guide browser privacy/explicit-preview test passed. Source product scope checked using primary OpenAI, Anthropic, Perplexity and Cursor docs; live model entitlements remain unverified.

Next: P2-08 — add an off-by-default isolated website widget with restricted public messages.

## P2-08 checkpoint — 16 October 2026

State: **in_progress**. Widget defaults off. Use exact provider grants, isolated content script and Shadow DOM. Background returns a tiny formatted reading projection, never the full store. No page message bridge, composer access, provider calls or broad site grants.

Next: P2-08 — implement restricted widget state/actions, registration, UI and isolation fixtures.

## P2-08 checkpoint — 16 October 2026

State: **verified**. Changed runtime widget entrypoint, pure public projection/settings schemas, background registration/permissions/messages, Settings controls and focused tests/docs. Defaults off; exact-host scripts, Shadow DOM, corner/collapse/hide persistence, public status/two meters only, trusted-click controls, singleton/remount cleanup and debounced local reading updates. No page bridge, full-store messages, raw storage subscription, provider calls or composer reads. Typecheck passed; 87 core tests passed; build passed at 716.2 kB; real Chromium two-tab synthetic-page fixture passed for hostile CSS, SPA/remount, trusted vs synthetic clicks, public-only messages and disable cleanup. Headless permission approval unavailable: fixture grants a single synthetic host in an isolated copied build; ordinary permission denial remains covered. Consumer permission UI and live provider/widget checks remain pending.

Next: P2-09 — implement Firefox fallbacks, Edge registration and normal optional Windows installer packaging.

## P2-09 checkpoint — 16 October 2026

State: **in_progress**. Implement browser-specific manifests/capability handling, Edge native registration, public-metadata extension discovery and GUI install/uninstall/start-menu packaging. Preserve Linux/authentication behavior. Windows desktop/live provider access are not available and must remain pending rather than treated as tested.

Next: P2-09 — implement and verify browser fallbacks and unsigned Windows installer artifacts.

## P2-09 checkpoint — 16 October 2026

State: **verified**. Changed browser-specific WXT builds/permissions and Firefox sync data-consent checks; optional native UI fallback; Edge host registration; extension-metadata discovery; Windows GUI setup/uninstall, NSIS packaging/checksums and Windows CI parser/GUI/compiler steps; platform/companion docs and tests. Chrome/Edge/Firefox MV3 builds pass and package-contract checker passes; Firefox 140+ uses sidebar/event page and excludes unsupported native setup. 88 core and 17 companion tests passed. Actual unsigned NSIS EXE compiled locally (158753 bytes) with SHA-256; installer/Start-menu use current-user paths, no elevation, automatic profile selection plus manual fallback and explicit credential deletion choice. Local apt index lacked NSIS; temporary official Debian packages supplied compiler, without changing system packages. Real Windows clean install/update/uninstall/browser/native acceptance and real Firefox/provider behavior remain pending; Windows PowerShell parser/GUI checks execute in CI, not claimed locally passed. Installer prerequisites remain Node 24+ and official Codex CLI, documented as optional advanced setup.

Next: P2-10 — run integrated hardening, server/browser checks, release packaging and handoff.

## P2-10 checkpoint — 16 October 2026

State: **in_progress**. Final phase gate: extension/core/native/browser suites, real PostgreSQL server and phone dashboard tests, actual transport pairing/snapshot E2E, platform package checks and unsigned installer. Preserve source dates, tenant isolation, deletion tombstones and disabled production collectors. Measure bundles/request bounds; update all current user docs and publish branch.

Next: P2-10 — harden auth/deletion/sync edges, add integrated service CI and produce final packages/handoff.

## P2-10 checkpoint — 16 October 2026

State: **in_progress**. Actual local integrated extension gate passed: typecheck, 90 core tests, 17 companion tests and production build (717.31 kB); all 19 Chromium fixtures passed. Actual HTTP extension pairing/upload/delete E2E passed; phone dashboard test passed against PostgreSQL. Server typecheck found an uninitialized test variable, now corrected; rerun pending. Earlier P2-09 Windows CI exposed empty-array/null discovery handling in PowerShell GUI; fixed filtering, awaiting Windows CI retest. Real Windows GUI install/browser/provider and Firefox/provider remain unverified. No production collector or credentials enabled.

Next: P2-10 — finish server recheck, publish hardening checkpoint and inspect all CI jobs/artifacts.

## P2-10 checkpoint — 16 October 2026

State: **implemented**. Changed final extension version/package locks, auth verification helper and real-signature tests, tenant lock order/deletion/device scrubbing, bounded API storage and hourly retention plus migration 005, stale sync backlog handling, activity-only observer lifecycle, currency display/export, actual HTTP transport fixture, complete service/platform/archive CI, Windows empty/multiple discovery regression, current docs and Phase 2 handoff. Available local checks pass: 90 core, 17 companion, 19 full browser fixtures plus targeted source/widget and popup measurement reruns; 30 real-PostgreSQL server tests/types with fresh/repeat migrations; phone and actual extension HTTP pairing/upload/delete fixtures. Six cached rows measured 230 ms at 520x600 in Linux headless Chromium. Browser variants/contracts, actual clean ZIPs/checksums and unsigned NSIS installer compiled. Source ZIP auto-generation was disabled after inspection found generated artifacts included; distributable extension ZIPs contain no private/test grants. Final Windows CI and complete release artifact inspection are pending. Production cloud collector, live provider/logout and real OS acceptance remain external blockers.

Next: P2-10 — publish final code checkpoint, inspect all CI jobs and artifact presence, then record final handoff.

## P2-10 checkpoint — 16 October 2026

State: **implemented**. Final connected-services CI passed 30 PostgreSQL/auth/job tests, phone view and actual HTTP transport; Linux verification and clean extension ZIP artifact were produced. Windows CI now passes real PowerShell parsing, GUI construction and empty/multiple candidate checks, but NSIS exposed mixed Windows source-path separators; corrected to native NSIS separators and actual Linux EXE compilation passes. Final controller registration/stop guards ensure Grok/Perplexity observers exist only in activity mode, reconcile on restart and unregister on quota switch. Typecheck and targeted Perplexity/widget fixtures pass locally; final Windows packaging rerun remains pending. No live OS/provider claim changed.

Next: P2-10 — inspect replacement CI run, verify native/extension artifacts, then finalize status and handoff.

## P2-10 checkpoint — 16 October 2026

State: **implemented**. Windows CI now passes real PowerShell parsing/GUI regression checks and actual NSIS packaging, producing a nonempty unsigned installer artifact. Full extension CI passes with the clean Chrome/Firefox artifact. Actual transport CI exposed a fixture race: cached test state could be written before durable schema/history initialization. The fixture now waits for the initialized empty dashboard, seeds inactive cached data independently of provider grants, and waits for that named account before pairing. Local actual HTTP transport retest passes with original observation age and deletion; server typecheck passes. No runtime code changed for this fixture correction. Final all-job CI rerun pending.

Next: P2-10 — verify initialized transport fixture in CI, then record successful run and artifact IDs.

## P2-10 checkpoint — 16 October 2026

State: **verified**. Final all-job CI passed on code checkpoint 20a810d83d70f57229171494771d0db18bd5bdd2: run 38846628036. Linux: 90 core, 17 companion, 19 Chromium fixtures; Chrome/Edge/Firefox builds and clean ZIP/checksum contracts. Connected services: types, 30 real-PostgreSQL/auth/job tests, responsive phone view and actual HTTP extension pairing/upload/delete. Windows: core/native gate, real PowerShell parse/GUI/candidate regressions and actual NSIS compiler all passed. Verified nonempty, nonexpired artifacts: extension packages 12023223325 and unsigned native installer 12023517174. README and final handoff contain exact install/download links, schemas/migrations, performance/resource limits and pending external acceptance. Main unchanged; no public deployment, production collectors, provider credentials, store publication or signing. Complete code is pushed; this final documentation checkpoint records actual results.

Next: Phase 2 complete — stop and await the user; live/provider/desktop checks remain listed in PHASE-2-HANDOFF.md.

## Compact popup and account setup upgrade — 16 October 2026

State: **in_progress**. User requested a smaller essential-actions popup and explicit
multi-account setup alongside automatic website detection. Working on
`v2/compact-accounts` from clean `v2/phase-2`; main is preserved. Added a dedicated
400px popup (500px height ceiling), shared live-store hook/readings, account links
to dashboard details, plus/provider picker, persistent identity-bound account
setup/nickname confirmation and optional OpenAI independent-connection entry.
Provider choices: OpenAI Work/Codex, Claude subscription (including shared Claude
Code scope where returned), Cursor, Grok, Perplexity; Gemini is explicitly local
activity only. No new provider grant, hosted collector or credential storage.
Website mode still updates only the current login; independent Claude and other
provider grants remain unavailable, not simulated by saving a second label.

Changed files: popup entrypoint/CSS; core model/schema/public/account-setup + tests;
platform messages/controller/companion; reader/reader tests; App, AccountConnect,
Popup, ProviderMark, Reading, useMyLimits, navigation and styles; browser fixtures
and test runner. OpenAI companion addition accepts an optional nickname, scoped
to the returned profile. Claude/OpenAI readers now recheck account identity after
quota retrieval to reject mid-request switching.

Actual checks so far: TypeScript passed; 96 core tests passed; production Chrome
build passed. Restricted-sandbox native subprocess fixture failed (child exits
without running); rerun outside sandbox passed all 17 companion tests unchanged.
Restricted Chromium startup denied local sockets; outside-sandbox focused tests
confirmed dashboard deep links and six-row bounds. The new manual-account flow
completed, but its final assertion incorrectly searched the private workspace
store for a raw organization ID; narrowed to public-facing account records.
Full 22-test Chromium rerun is underway. Live provider accounts are unavailable;
logout, renewal, shared cross-device scope and real Windows DPI remain pending.

Next: inspect full browser results and screenshots, fix actual regressions, build
browser variants/ZIPs, finish installation/handoff documentation and publish.


## Compact popup and account setup — verified publication, 16 October 2026

State: **verified for delivered paths**. All available local checks pass:
`npm run check` (types, 97 core tests, 17 companion tests and production build),
24 Chromium fixtures, Chrome/Edge/Firefox builds and package contracts, actual
Chrome/Firefox ZIP/archive inspection and SHA-256 output. Actual browser/child
process tests require the approved environment outside the restricted sandbox;
the initial sandbox failures were environment failures, not skipped tests.
Visually reviewed light six-account popup and dark popup/provider picker.

Final workspace-switch hardening keeps the first account's workspace from being
reused during detection/another-account setup. Browser coverage uses two Claude
identities with different organizations, preserves Personal/Work nicknames after
popup reload, and confirms only the new independent OpenAI profile receives its
requested nickname. Ten-account overflow/search and fixed footer are tested.
All source dates and unknown quotas remain honest. Schema stays V2 with optional
setup metadata; existing IDs/names are preserved. No credential migration.

Published code checkpoint: `7a8f48fb76babfa9b02e29a02e01fc339bb68441`, tree
`508a9f35905ed328e3a6ac2427959cde8f206543`. Local code commit `7afefe0` has the
same complete tree; the pre-existing local Phase 2 commit differs in metadata
from GitHub but has the identical base tree. Publication used the GitHub connector
with the actual remote Phase 2 parent, without force-pushing either history.

All three jobs passed in [Checks run 38922290094](https://github.com/voiddev011/mylimits/actions/runs/38922290094):
Linux extension/types/core/native/browser/packages; connected PostgreSQL service,
phone and actual extension HTTP transport checks; Windows logic/PowerShell/NSIS.
Verified nonexpired, nonempty extension artifact **12054622767** and optional
unsigned native artifact **12055521330**. Local ZIPs: Chrome **230643 bytes**,
Firefox **229948 bytes**, plus `.output/SHA256SUMS`.

Independent OpenAI remains the existing optional companion path, not a new
extension-only grant. Independent Claude/other-provider authorization, every
ordinary ChatGPT limit, real provider sign-in/logout/renewal and actual desktop
DPI/installation remain **unimplemented or live-unverified as explicitly listed**
in the handoff. No production collector, backend deployment, store publication or
signing was added. Main remains unchanged.

Next: install/update using the current 2.2 artifact. Further independent-provider
work needs a viable permitted authorization/quota source and live acceptance;
never relabel saved website readings as independently updating accounts.

## Documentation cleanup — 23 October 2026

- Removed completed Phase 1/2 execution plans, the V2 master execution plan,
  original roadmap and obsolete starter prompt. Their history remains in Git.
- Retained shared V2 contracts in ARCHITECTURE.md, all handoff/test evidence,
  research, installation, privacy and operational documentation.
- Updated links and START-HERE. Main application source is unchanged.
- The newer Desktop preview remains on feature/desktop-independent-accounts.
