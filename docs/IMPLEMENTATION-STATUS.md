# MyLimits implementation status

Updated: **17 October 2026**. **Independent-account proof tooling implemented;
live Gate 1 is pending.** Historical Phases 1/2 and V3 have their recorded
automated evidence below. No cloud deployment or
credential upload has been performed.

## Active checkpoint

Current authorization (17 October 2026): independent-account **Gate 0/1 diagnostic**,
branch `v3/account-proof`. Research plan supersedes the earlier V3 multi-account
claims. Profile/runtime and account-bound OpenAI/Claude candidate probes are
implemented. Real accounts, isolated Claude browser login, Windows interactive
acceptance and Claude monitoring/distribution permission remain unverified.
Actual checks: 28/28 Linux diagnostic tests pass; Windows ConPTY proof passes
27 tests with one intentional POSIX-only skip. Existing `npm run check` also
passes. Code is pushed; all three jobs in CI run 39006704947 succeeded, including
Windows native installer packaging. Live Gate 1 remains pending.
See [ACCOUNT-PROOF.md](ACCOUNT-PROOF.md) and
[ACCOUNT-PROOF-HANDOFF.md](ACCOUNT-PROOF-HANDOFF.md).
Next dependency: live two-account checks on the laptop, then evaluate Gate 1.
The historical checkpoints below describe earlier work, not completion of this gate.

### Historical release checkpoint

- Requested work: user-authorized compact popup and explicit multi-account setup upgrade.
- Current work package: 2.2 delivered paths verified; independent Claude/other-provider authorization remains unavailable.
- Next action: use the packaged preview; live provider/Windows acceptance remains pending. No additional product work is assumed.
- Working branch: `v2/compact-accounts`; published code `7a8f48fb76babfa9b02e29a02e01fc339bb68441`.
- Main and completed Phase 1/2 branches preserved.
- Current handoff: [compact accounts upgrade](COMPACT-ACCOUNTS-HANDOFF.md).
- Historical scope: [master plan](V2-IMPLEMENTATION-PLAN.md), [Phase 1](PHASE-1.md), [Phase 2](PHASE-2.md).

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

## V3-01 — started, 16 October 2026

User approved implementation of the researched V3 redesign. New branch
`v3/redesign`, clean baseline from 2.2; no user changes discarded. Plan is
V3-IMPLEMENTATION-PLAN.md. Start with Guide removal, genuine local provider assets
and typography/layout foundations, then complete the ordered work packages.
No new provider credentials/live accounts are available. Native packaging and
fixture verification are authorized; unsupported independent providers remain
blocked rather than advertised. Next: implement V3-01 and V3-02.

### V3-01 / V3-02 / V3-03 implementation checkpoint

- Removed Guide UI, core helpers, tests and navigation; legacy hashes land on Overview.
- Packaged official six-provider favicon assets with `PROVIDER-ASSETS.md` provenance.
- Rebuilt typography/layout tokens, 440px quick popup, dashboard-only setup, larger
  four-tab dashboard and local reset clocks. Added Standard/Large settings.
- Added UI-only privacy projection, masked notifications, history privacy guard,
  Needs attention filter and strict-allowlist diagnostics/help.
- Replaced on-page quota rendering with opt-in Coming soon launcher. Preview
  projection receives only site preferences, requires no account, preserves old
  site/corner choices; exact-site permissions remain required.
- Actual checks: TypeScript passed; 99 core tests passed. Browser/layout tests and
  package builds have not run at this checkpoint.
- Decision: history is hidden/export disabled under privacy mode, rather than
  exporting a partially masked private record. Saved aliases/data are unchanged.
- Next: browser acceptance fixtures and optional connector improvements.

### V3-04 account connection checkpoint

- Independent OpenAI authorization now opens a fresh local Chrome/Brave/Edge profile
  per companion account. Authorization URLs stay in the helper on the new protocol;
  old helper compatibility remains, with explicit update guidance.
- Added same-email possible-duplicate hints computed only in helper memory. No
  email/hash leaves native messaging, and profiles/workspaces are never auto-merged.
  Official `account/read` exposes email/plan, not a verified universal workspace key;
  matching email is deliberately only a warning.
- Windows x64 package pins/checks official Node 24.22.0 SHA256 and Codex 0.163.0
  npm SHA512, bundling their native runtime layout and licenses. Setup uses bundled
  binaries rather than a global Node/Codex dependency. Unsigned preview only.
- Updated browser account action to “Save another website account”; it explicitly
  describes dated readings rather than independent refresh.
- Actual tests: first unrestricted `npm run check` passed (99 core, 19 native,
  production Chrome build). The same native child-process check failed only inside
  the restricted sandbox; unrestricted execution passed. Added duplicate test next.
- First browser pass: 22/26 passed. Fixed six-row micro-overflow, async preview
  checkbox feedback, and explicit accessibility labels for presentation selects;
  rerun is in progress. Existing migration/history/account/source tests passed.
- Blockers: no real provider credentials or Windows desktop session. Independent
  Claude is not exposed; logout/renewal/cross-device and actual Windows install /
  startup/uninstall remain pending. No provider claim was upgraded from prototype.
- Next: finish browser acceptance, compile final Windows installer, all variant
  archives, update handoff/current docs and publish the working branch.

### V3 interface / connector implementation verified checkpoint

- Final unrestricted core/native check passed: TypeScript, 99 core tests,
  20 native tests (including actual child process RPC), Chrome production build.
- Browser rerun: 25/26 passed; the remaining position test used synthetic select
  events rejected by the intentional trusted-input guard. Replaced it with actual
  keyboard selection; focused preview browser test passed, including CSS isolation,
  Escape/outside click, no account requirement, position persistence and removal.
- Normal six-row popup fits with 14px account names, 16px values, 12px secondary
  text. Large-text/privacy persistence and 200% text enlargement checks passed.
- Actual bundled Windows installer compiled: 196,690,078 bytes with upstream Node
  and Codex runtime, native PE output and SHA256. This does not prove Windows live
  installation or real account authorization.
- Added follow-up fixtures for on-site Hide persistence and new native sign-in
  protocol; final whole-suite and variant/archive checks are next.

### V3-05 local delivery checkpoint

- Full real Chromium suite: **26/26 passed**. Added on-site Hide/reload and new
  helper-owned auth window protocol coverage. Follow-up privacy query/nickname
  concealment type/build/focused browser check also passed.
- Chrome/Edge/Firefox builds, manifest checks, actual Chrome/Firefox ZIP checks
  and SHA256 generation passed. Genuine logos included; Guide prompt tools absent.
- Installer final local compile passed (196,690,078 bytes); bundled dependency
  digests and license files included. Windows interactive acceptance is pending.
- Optional server local check: TypeScript/auth test passed; API/job tests failed
  startup because no isolated PostgreSQL URL was configured. CI is running those
  against its isolated PostgreSQL service; do not report local full server success.
- Published implementation checkpoint `1b9f9e6aac14b8bd2c805624f458c2ff6facb970`
  on `v3/redesign`, based on user's actual current main. GitHub/local tree equality
  was verified. Main not merged. Checks run: 38930787730 (in progress at checkpoint).
- Added `INSTALL.md` and `V3-HANDOFF.md`; current README/start/privacy/helper docs
  describe 3.0. Plan records decisions, duplicate-identity boundary and source links.
- Next: publish final privacy/handoff changes; verify CI artifacts and record the
  precise remaining Windows/provider acceptance checks. No store publication.

### V3 CI integration correction

- Run 38930787730: extension verify job passed; connected-services PostgreSQL API
  and phone-web checks passed, but transport fixture timed out trying to click
  snapshot pairing inside the newly collapsed Advanced section. Updated the
  fixture to open “Snapshot sync · advanced” first. Pairing semantics unchanged.
- Windows job had passed native checks and real PowerShell parsing/GUI construction
  and was still compiling the bundled installer at this checkpoint.
- Final privacy safeguard also hides pre-existing search/nickname fields; focused
  browser test passed. All final variant builds/archive checks passed again:
  Chrome ZIP 298,948 bytes; Firefox ZIP 298,298 bytes.
- Next: push privacy/handoff/fixture correction, confirm complete CI and record
  artifacts. No real provider or Windows interactive test is implied by CI.

### V3 final CI evidence and logo contrast correction

- Final application checkpoint `cc29f5ac4f4c7dccdea1c168a4c2f23479cc9671`,
  run **38931432647**: all three jobs succeeded. Extension verify covers 26 real
  Chromium fixtures and packages; connected-services includes actual isolated
  PostgreSQL API/jobs, phone web and corrected HTTP pairing/upload/deletion;
  Windows includes core/native tests, real PowerShell parsing/GUI construction,
  and actual bundled installer compilation. No live account behavior is implied.
- Published artifacts: extension packages 12058862247; Windows helper 12058892440.
- Final visual asset review found the official OpenAI favicon switches to white
  under dark preference. Its intentionally light tile now explicitly uses light
  color-scheme; the asset stays unchanged. Added an actual rendered-pixel browser
  assertion under dark preference, rather than checking image load alone.
- Follow-up whole-browser acceptance and variant archives are running for this
  stylesheet-only correction. Native and server application code unchanged.
- Main preserved; real Windows installation/provider account/renewal/logout
  acceptance remains pending as documented in V3-HANDOFF.md.

### V3 delivery ready

- Final dark-logo correction: TypeScript/Chrome production build passed; whole
  Chromium suite **26/26 passed** again, including real adaptive-SVG pixel check.
- Final Chrome/Edge/Firefox production builds and manifests passed; actual
  Chrome ZIP **298,953 bytes**, Firefox ZIP **298,299 bytes**; archive safety/Guide
  removal/local-logo inclusion and SHA256SUMS passed.
- Local and CI package artifacts remain separate builds; use the checksum
  shipped with the particular download. Windows helper source unchanged from
  its verified CI installer.
- All authorized implementation work is complete. Final branch push follows;
  live provider and interactive desktop acceptance are the explicit remaining
  release checks in V3-HANDOFF.md. No Phase 2/server deployment/store submission
  or main merge was performed.

### V3 published final application and artifacts

- Final source pushed: `702d971dfddf18216fb28d7df3fbb9c12b7a4c1f`; tree
  `baeaa4773a6d18a3b4d2dbb6d4e4c7d30013c9f8` equals local `75fb9cd`.
- Run **38932629756** final extension verification passed, including all 26 browser
  checks and the actual dark-preference SVG pixel assertion. Final downloadable
  extension artifact: **12059023187**. Install/README links now target that build.
- Previous complete run **38931432647** passed all three jobs; its Windows helper
  artifact **12058892440** has identical native application/package source.
  Latest Windows rebuild is redundant verification of that unchanged helper.
- Last commit is documentation/evidence only; no further application changes.
  No main merge or public store submission. Release's pending live-account and
  interactive desktop acceptance is fully enumerated in V3-HANDOFF.md.

## Account proof / PROOF-01 — 17 October 2026

State: **implemented, local regression verified; live Gate 1 pending**.
Branch: `v3/account-proof`; starts from the exact published V3 tree.
No AGENTS.md applies; one workstream, no parallel agents.

- Inspection/decision: read current start/status and independent-account plan.
  Recorded first-party ownership, unresolved Claude monitoring/distribution use,
  supported auth boundaries and explicit stop/go gates in `ACCOUNT-PROOF.md`.
- Changed `companion/proof/{runtime,store,service,codex-login,claude}.mjs`,
  `scripts/account-proof.mjs`, `companion/app-server.mjs`: isolated profiles,
  generation/identity checks, OpenAI sign-in, experimental Claude PTY collection,
  cancellation/logout, safe retained history and redacted evidence.
- Changed `package.json`, `package-lock.json`: pinned optional native/headless
  terminal dependencies and diagnostic commands. Existing package versions kept.
- Added `companion/proof/proof.test.mjs` and a strictly fictional CLI fixture;
  changed `.github/workflows/checks.yml` to run proof tests on Linux and Windows.
- Local results: 26/26 proof tests pass, including real subprocess/PTTY checks;
  `npm run check` passes (TypeScript/core/20 native tests/Chrome build);
  CLI help and whitespace checks pass. Earlier restart-cleanup and login-refactor
  failures were corrected and the full diagnostic suite rerun successfully.
- Docs: research plan status, START-HERE, README, detailed ACCOUNT-PROOF laptop
  instructions and ACCOUNT-PROOF-HANDOFF. All maintained Markdown stays in docs/.
- Blockers: no real provider accounts; automatic isolated Claude browser sign-in
  is not verified; acceptable polling/distribution use unresolved. Windows CLI
  fixture CI is pending at this checkpoint; real desktop sign-in remains separate.
- Next: publish branch and record CI. Live manual proof is the next dependency
  before Gates 2–5; no independent-Claude extension UI was enabled.

### PROOF-01 Windows shutdown correction

- Published first source checkpoint `a9f121ac2bf55f90ad86671c47d3132772c2a02c`,
  exact local tree `3d6a3bed54f430601b4980ddbb03276aa2e1601b` (`4996315`).
- CI run 39005904346: Linux diagnostic, core/build and browser checks passed;
  connected-services passed. Windows core/native/build passed; proof had 23 passes,
  two failures and one intentional POSIX-symlink skip. Both failures were EBUSY
  during fixture cleanup because kill() returned before ConPTY released its cwd.
- Added bounded exit/PID acknowledgment before a terminal result is released,
  selected the pinned library's bundled ConPTY implementation for this prototype,
  and added Windows filesystem cleanup retries plus a shutdown-race regression.
  Unknown/unconfirmed shutdown fails closed. No other process is killed.
- Also include provider-reported plan metadata in redacted reports; absent plans
  stay null. Local updated diagnostic suite: **27/27 pass**. Windows rerun follows.

### PROOF-01 bounded process cleanup

- Follow-up source `69d7b2daba226e88540b5fd332a8af393e3853ae` (local `490541e`,
  tree `183ab3552f6754d03933d266607a3b3728a86eda`) passed Linux proof and extension
  verification plus connected-services in run 39006181611. Its experimental
  bundled-ConPTY path stalled the Windows proof step, so it is not accepted.
- Reverted to OS ConPTY. Probe shutdown now first sends control interrupts, waits
  for exit/PID release, then uses a bounded force-stop fallback. An unconfirmed
  process stop retains the recovery lock and blocks further provider operations.
  Codex proof subprocess shutdown is also acknowledged before returning results.
- Added a recovery-lock regression and three-minute CI proof-step deadlines;
  branch-scoped concurrency cancels superseded CI runs. Updated suite: 28 tests.
- Actual official Claude Code 2.1.301 `--version` and `auth login --help` ran in a
  fresh unauthenticated temporary profile. Help lists --claudeai/--console/--email/
  --sso, with no exposed --no-browser option. This is capability inspection only:
  no login, quota or model request; it does not prove all possible hidden options
  absent. Automated isolated-browser sign-in stays unverified.
- Next: verify corrected local tests, push this correction, inspect Windows CI.

### PROOF-01 final delivery evidence

- Published application source `6e172dd5e2efa6cba82c9d297cd5a4e498c28d4f`, tree
  `9836973433f45d67e5a4055ede51500de949fe8b` equals local `7f609f2`.
- Final complete run **39006704947**, maintenance head
  `b2c0c3e18e3ac0ce65b8931c6e1e2eba13885527`: **all three jobs succeeded**.
  Linux proof 28/28; Windows ConPTY proof 27 passed, zero failed, one intentional
  POSIX symlink skip. Core/native/build/browser/variant/archive checks passed;
  real PowerShell GUI construction and native installer compile passed;
  isolated PostgreSQL/phone/extension transport checks passed.
- Final artifacts: extension packages 12090284547; optional legacy OpenAI helper
  12091477070. The diagnostic itself runs from the source checkout; those packages
  do not enable independent Claude.
- Windows stall recovery: a tightly scoped one-off CI workflow cancelled only
  superseded run 39006181611 after checking its exact SHA/branch/status. Cleanup
  run 39006701928 succeeded. Runs 39006181611 and 39006580872 are confirmed cancelled.
  That one-off workflow is removed after use; ordinary branch concurrency/deadlines
  remain. No token values or credentials were printed or exported.
- Final files after green application CI: documentation/evidence plus removal of
  the completed one-off cleanup. Application and proof source unchanged.
- Gate 0 decision record and Gate 1 tooling delivered; **live Gate 1 is pending**.
  No account credentials were available, no provider login/model calls performed,
  and no verified independent-Claude UI/release claim was introduced.
- Next dependency: run ACCOUNT-PROOF.md on the laptop with two real accounts per
  provider; verify default-browser preservation, scope/value matching, phone-only
  changes, ordinary logout vs global revocation and actual renewal. Resolve the
  automatic Claude sign-in and acceptable-use gates before Gates 2–5.
