# Current implementation status — hosted independent accounts

Updated 21 October 2026. **Requested installer-free multi-account product NOT complete.**
Active plan: [H01–H10](HOSTED-ACCOUNTS-IMPLEMENTATION-PLAN.md).
Documentation branch: `docs/hosted-accounts-execution-plan`.

## Current facts

- Local website readers and experimental native/helper adapters exist.
- Hosted probe observed OpenAI device-code initiation/cancellation and Claude
  loopback callback; no real authentication or quota read occurred.
- Production hosted collector map is empty. Hosted provider eligibility,
  account-selection/remote callback and actual A/B login behavior remain unresolved.
- No toggle removal or installer-free independent login is delivered by this docs work.
- Historical “code complete” statements below concern earlier local implementations;
  they are not proof of this requested end-user experience.

## Active task ledger

| Task | State | Next action |
| --- | --- | --- |
| H01 | implemented | Implement H02 contracts; continue available work while provider proofs remain blocked. |
| H02 | implemented | Implement H03 simplified UI with explicit unavailable hosted state. |
| H03 | implemented | Implement H04 durable authenticated connection attempts and tests. |
| H04 | implemented | Implement H05 secure runtime configuration and operator package. |
| H05 | implemented | Record H06/H07 provider blockers, then implement H08 collection. |
| H06 | blocked | Continue H07 decision and H08 independent code; external hosted route and real A/B proof required. |
| H07 | blocked | Implement H08 bounded jobs and H09 extension integration without enabling unsupported providers. |
| H08 | implemented | Implement H09 background client, account projection and management UI; then integrated verification. |
| H09 | not_started | Integrate extension/API and maintain manual evidence matrix |
| H10 | not_started | Package, verify and deliver accurate handoff |

## H01 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: Inspected UI, native connection messages, sync client, API, jobs, credential store and migrations; hosted trial sources reused.
- Checks: Clean starting checkout; no AGENTS.md found under workspace or ancestor paths. Official provider pages rechecked; no account authorization attempted.
- Decision/blockers: OpenAI experimental transport only: hosted entitlement and exact selection unresolved. Claude hosted unmodified CLI conditions exist, but remote completion/monitoring unresolved. Both production routes remain unavailable; no blanket impossibility claim. Runtime has no account credentials or configured identity/KMS.
- Next action: Implement H02 contracts; continue available work while provider proofs remain blocked.

## H02 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: src/core/hosted-contracts.ts, its tests, scripts/run-tests.mjs
- Checks: Typecheck passed; core suite 104 tests passed.
- Decision/blockers: Strict versioned public contracts exclude secrets, require verified subject/workspace, distinguish fetch and provider times, preserve unknown values. New hosted data is additive; legacy local IDs/history untouched. Durable identity/idempotency tests follow H04.
- Next action: Implement H03 simplified UI with explicit unavailable hosted state.

## H03 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: src/ui/AccountConnect.tsx, HostedAccounts.tsx, App.tsx
- Checks: Typecheck passed. Browser acceptance follows H09/H10.
- Decision/blockers: Provider switches replaced by + choices; current-account flow focuses existing tab. Independent flow explicitly unavailable instead of opening ordinary website. Legacy helper moved into advanced Settings; explicit website permission removal retained. Existing setup/history preserved.
- Next action: Implement H04 durable authenticated connection attempts and tests.

## H04 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: server/migrations/006_hosted_connections.sql; server/src/hosted.ts; app.ts; server/tests/hosted.test.ts
- Checks: Server typecheck passed; 37 PostgreSQL backend tests passed including 7 new hosted tests. Initial sandbox TCP run could not connect; rerun with permitted local-container access passed. Initial unsupported TS parameter-property syntax corrected before passing.
- Decision/blockers: Durable owner-scoped attempts, hashed proof, idempotency, duplicate identity, reconnect generations and cancellation are implemented. No generic token upload/callback endpoint. Fixture drivers forbidden outside tests; production map empty. Official provider-specific callback/PKCE remains gated with adapters, not invented.
- Next action: Implement H05 secure runtime configuration and operator package.

## H05 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: server/src/transit-kms.ts, config.ts, app.ts, main.ts; Dockerfile/compose/.dockerignore; transit tests; SERVER-SETUP.md and .env.example
- Checks: Server typecheck and 38 PostgreSQL tests passed. Private Docker image build in progress; real Vault policy and TLS/OIDC deployment not tested.
- Decision/blockers: Real Vault-transit envelope wrapping supports protected key service, binding and safe failures. Private operator image/compose and cost worksheet prepared. No hosted provider runtime or public deployment claimed; actual KMS/provisioning remains operator prerequisite.
- Next action: Record H06/H07 provider blockers, then implement H08 collection.

## H06 checkpoint — 21 October 2026

State: **blocked**. Branch: `feature/hosted-connections`.

- Files: Provider availability contract and hosted service retain OpenAI unavailable state; source review in HOSTED-ACCOUNTS-TRIAL-PLAN.md.
- Checks: Rechecked OpenAI official hosted eligibility documentation; prior official device-code initiation/cancel observed only. No user authentication, quota read, account B selection or renewal tested.
- Decision/blockers: https://developers.openai.com/siwc/token-sharing-open-source explicitly directs remotely hosted offerings to an interest route; no approved hosted integration or exact supported account-selection mechanism configured. Do not reuse a private CLI OAuth client as a hosted product. Adapter cannot honestly be implemented/activated to this acceptance gate yet.
- Next action: Continue H07 decision and H08 independent code; external hosted route and real A/B proof required.

## H07 checkpoint — 21 October 2026

State: **blocked**. Branch: `feature/hosted-connections`.

- Files: Claude hosted capability and service remain unavailable; existing isolated diagnostic retained unchanged.
- Checks: Rechecked official Claude authentication and legal/compliance docs; no account login performed.
- Decision/blockers: https://code.claude.com/docs/en/legal-and-compliance allows unmodified hosted CLI under conditions; https://code.claude.com/docs/en/authentication documents manual-code fallback when loopback is inaccessible. Exact automatic remote completion and quota-only monitoring not established; no custom Claude OAuth or cookie interception added. Normal browser account preservation remains PENDING.
- Next action: Implement H08 bounded jobs and H09 extension integration without enabling unsupported providers.

## H08 checkpoint — 21 October 2026

State: **implemented**. Branch: `feature/hosted-connections`.

- Files: server/src/hosted-jobs.ts; worker.ts; app.ts refresh route; hosted lifecycle tests; deployment worker service
- Checks: Server typecheck and 42 PostgreSQL tests passed; new coalescing/cooldown, last-success retention, crashed lease, wrong identity, late disconnect, auth expiry and owner concurrency tests passed. Earlier operator image build passed; final worker image rebuild follows delivery.
- Decision/blockers: Durable per-account jobs, global4/owner2 concurrency, provider30/min budget, min60s plus adapter interval, Retry-After/backoff/jitter, lease fencing, bounded reads, separate timestamps and history retention. No active providers: no real hosted refresh runs.
- Next action: Implement H09 background client, account projection and management UI; then integrated verification.

## Documentation consolidation checkpoint

Created the active plan, replaced stale entry/starter instructions, removed 12
superseded plans/status/checklists/handoffs, and converted historical links to an
immutable published checkpoint. Operational documentation and unique evidence
remain. No runtime code changed; no application tests or live-account tests claimed.
Validation: all 39 relative Markdown link targets exist; `git diff --check` passed.
Documentation-only checkpoint; no runtime tests needed or claimed.
Next action: execute H01 on a new implementation branch, then available H02–H10.

---

# Historical implementation ledger

Updated: **21 October 2026**. **3.2 code completion in progress**.
User will perform real-account acceptance separately. No main merge/public release.

## Active checkpoint

Branch `feature/independent-accounts`. See MULTI-ACCOUNT-CODE-CHECKLIST.md.
Implemented independent OpenAI and Claude adapters, per-profile first-party auth,
shared state/refresh/identity fencing, mixed account UI, Claude onboarding and
Windows runtime/router setup. Earlier unavailable-only Claude state is superseded.

Actual evidence so far: 102 core, 20 legacy native, 16 integrated connection,
28 proof and 29 Chromium tests passed; official unmodified Linux Claude 2.1.301
BROWSER + loopback callback capability passed without an account. Windows code
compilation/native routing and final packaging/CI are next. User account tests
remain separately pending, not a reason to omit source implementation.

### Historical release checkpoint

- Requested work: user-authorized compact popup and explicit multi-account setup upgrade.
- Current work package: 2.2 delivered paths verified; independent Claude/other-provider authorization remains unavailable.
- Next action: use the packaged preview; live provider/Windows acceptance remains pending. No additional product work is assumed.
- Working branch: `v2/compact-accounts`; published code `7a8f48fb76babfa9b02e29a02e01fc339bb68441`.
- Main and completed Phase 1/2 branches preserved.
- Current handoff: [compact accounts upgrade](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/COMPACT-ACCOUNTS-HANDOFF.md).
- Historical scope: [master plan](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/V2-IMPLEMENTATION-PLAN.md), [Phase 1](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/PHASE-1.md), [Phase 2](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/PHASE-2.md).

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
[PHASE-1-HANDOFF.md](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/PHASE-1-HANDOFF.md#changed-files-and-task-checkpoints).
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

## MULTI-01 — independent account integration / Task 1

- Branch `feature/independent-accounts`, clean baseline local `9ad8085`.
- Read requested start/status/proof/handoff/research and service, diagnostic,
  native bridge/controller, account model/UI, installation and CI code. No AGENTS.md
  found under workspace; no parallel agents. New authorization permits integration
  despite prior live-gate stop, retaining explicit pending/unavailable labels.
- Added `MULTI-ACCOUNT-IMPLEMENTATION.md` with task sequence/contracts/acceptance.
- Actual checks: inspection only; no implementation tests run at this checkpoint.
- Blockers: no real provider identities; Claude isolated browser routing and fresh
  monitoring/conditions unresolved. Existing auth folders will not be inspected.
- Next: strict versioned native contract and migration-compatible service metadata.

### MULTI-02 / Task 2 — connection contract

- Added `core/independent-contract.ts` and `core/independent.ts`: strict protocol-2
  capability/profile/snapshot schemas; separate auth, quota scope, timestamps,
  retries, errors and limited identity confidence. No email-as-workspace claim.
- Extended optional connection metadata in model/schema/public projection without
  changing persisted schema version, existing UUID namespaces or user aliases.
- Acceptance/tests: contract implementation in progress; integration and migration
  regression checks follow with the service/UI. No live behavior claimed.
- Next: implement service with same on-disk account homes and scoped auth lifecycle.

### MULTI-03 / Task 3 — OpenAI service integration

- Added `companion/connections.mjs`, reusing proof profile-environment isolation,
  atomic private metadata and scoped login waiter. Same legacy account directories,
  UUIDs, host and extension IDs; no proof profile import and no credential reads.
- New profile-generation fencing, first-party completion/identity verification,
  before/after quota identity checks, fresh auth browser per attempt, duplicate
  warning, async cancellable login, reconnect and acknowledged per-profile logout.
- Existing legacy service stays solely as compatibility test/reference; daemon now
  uses Connections. Native protocol strictly allowlists fields; host forwards only
  validated operations. Structured upstream errors retain safe retry/status hints.
- Actual checks: `node --check` service/daemon and `npm run typecheck` passed.
  Behavioral regressions follow with service tests; no real OpenAI accounts used.
- Next: record Claude capability decision, then exercise service/refresh invariants.

### MULTI-04 / Task 4 — Claude decision

- Rechecked official authentication and legal/credential documentation today.
  Recorded exact sources and decision in MULTI-ACCOUNT-IMPLEMENTATION.md.
- Service exposes explicit Claude-unavailable capability/reason and refuses Claude
  signup before allocating a profile. Existing per-config diagnostic and website
  reader retained. No invented OAuth, default-browser fallback or CLI redistribution.
- Actual verification: official documentation reads only; live login/quota tests
  unavailable. Automatic isolated login, upstream freshness and monitoring use are
  blockers, not marked complete. Continue service/extension integration per user.

### MULTI-05 / Task 5 — native service and refresh

- Native capabilities/list/start/cancel/rename/refresh/reconnect/disconnect wired
  through strictly validated host fields and mutually authenticated existing pipe.
- Per-profile operation queues, two-process global limit, persisted >=2min refresh
  reservation and exponential failure backoff. Structured upstream Retry-After is
  honored when the CLI exposes it; absent headers cannot be recovered by this API.
- Last successful readings persist across restart and become unavailable until a
  successful check; failed/empty/cancelled reads retain original time and values.
  Start/refresh return promptly; progress/results arrive as snapshots.
- Added `connections.test.mjs`: **10/10 passed** with in-process Node test isolation
  disabled (sandbox runner otherwise summarized the file as one test). Includes
  two profiles, duplicates, migration, cancellation, changed identity, retries,
  disconnect isolation and explicit Claude capability rejection. Fictional only.
- Extension strict contract/typechecking passed after native bridge integration.
  Old helper can retain dated data but cannot start v2 independent authorization;
  capabilities are checked before start and no auth-URL browser-tab fallback exists.
- Next: replace misleading add flow, show connection progress and management.

### MULTI-06 / Task 6 — extension experience

- Updated AccountConnect: website tracking and independent account connection are
  separate choices. Removed the button that implied website switching established
  another independent connection; previously persisted website setup can finish.
- Replaced OpenAICompanion UI with helper readiness/version check, sign-in progress,
  local verified identity (hidden in privacy mode), duplicate/cancel/error state,
  retry countdowns, reconnect/disconnect and last successful reading. Account tab
  exposes management directly; popup remains compact and opens the dashboard.
- Controller/message/native bridge now expose capabilities and specific actions;
  no provider auth URL is returned to the extension or opened in the current tab.
- Actual checks: TypeScript passed before final migration projection follow-up;
  complete type/core/browser checks still pending. Live provider setup is untested.
- Next: installer runtime inclusion and v3.1 packaging, then behavioral/browser tests.

### MULTI-07 / Task 7 — installation

- Windows package and source installer now include Connections and only its shared
  proof utility modules (environment/store/scoped login/errors). Experimental
  Claude PTY code/dependencies are not bundled into the production helper.
- Existing pinned official Node/Codex runtimes and current-user discovery/registry/
  scheduled startup retained. GUI states independent OpenAI scope and unavailable
  Claude. NSIS removes installed utility files on uninstall and keeps the existing
  explicit choice about deleting local authorization/profile/browser data.
- Version advanced to 3.1.0 preview consistently in package/lock/manifest.
- Build/PowerShell/installer acceptance is next. No Windows desktop or real
  account setup has been claimed verified; signing/store publication out of scope.

### MULTI-08 / Task 8 — verification checkpoint

- Full integrated `npm run check` passed after rerunning with real child-process
  support: TypeScript, **101 core tests**, **20 legacy native tests**, new connection
  suite and Chrome production build. The restricted sandbox's initial fictional
  subprocess test failed because its child stopped; elevated run passed.
- Expanded integrated service suite: **13/13 passed**, including real fictional
  Codex subprocesses, confirmed shutdown, two-process bound/coalescing, expired
  auth and late generation rejection. Existing proof/PTTY suite: **28/28 passed**.
- First real Chromium suite: **26 passed / 1 failed**. Failure was an old test
  selecting the renamed Detect current account button. Corrected the selector;
  added old-helper rejection coverage; full rerun in progress.
- NSIS Windows installer compiled locally using official cached runtime assets:
  196,689,244 bytes at this checkpoint. Final installer must be rebuilt after the
  follow-up startup-failure message change. No Windows interactive/live proof.
- Added current install instructions and updated privacy disclosure for transient
  local email display, native protocol, auth browser data and actual retry policy.
- Next: finish browser acceptance, final variant/package/installer checks, commit
  and push branch. Required real-provider/Windows interactive matrix remains pending.

### MULTI-09 / Task 9 — local delivery complete

- Final sequential setup-browser checks **4/4 passed** after all extension rebuilds.
  The earlier ERR_FILE_NOT_FOUND was caused by running a build while Chromium had
  the same extension directory loaded; source was unchanged for that rerun.
- Final Chrome ZIP 301,598 bytes, Firefox ZIP 300,346 bytes; manifests, optional
  permission contracts, archive safety checks and SHA256SUMS passed.
- Final Windows installer rebuilt: **196,689,211 bytes**, SHA256
  `b303244471035db21ca31f7a81ee86978a543a331b9a97a1b1ae547975b9e246`.
  This is an actual NSIS compile, not Windows interactive installation evidence.
- Added MULTI-ACCOUNT-HANDOFF.md and MULTI-ACCOUNT-INSTALL.md; all local doc links
  and git whitespace checks passed. Updated README/privacy/historical install
  notices. Visually inspected the independent account screenshot.
- Implemented tasks 1–3/5–9 and explicit Task 4 unavailable capability/decision.
  Live OpenAI/Claude and interactive Windows matrix remain pending; Claude separate
  automatic sign-in and monitoring route are blocked. No main merge or release.
- Next: commit coherent source checkpoint, publish branch via available GitHub
  access, inspect CI and record actual result without relabeling fixtures as live.

### MULTI-09 published source and successful CI

- Pushed `feature/independent-accounts`; source `e29a7d2571211bac4f82fc733fe531451749d340`
  has exact tree `89b9e596132777e11f6fc7aaba28075579e39c06` (local `00437a8`).
  Plan checkpoint `6e87354a...` has the exact local `6142aa6` tree. GitHub connector
  published the coherent commits without rewriting existing branches or main.
- Run **39579243525: all three jobs succeeded**. Linux full check/proof/browser/
  variants/ZIPs passed; Windows 101 core + 20 native + 13 integrated connections
  passed, proof 27 passed/1 intentional POSIX-only skip, zero failures; actual
  PowerShell GUI construction and native installer compile passed. Existing
  isolated PostgreSQL/phone/extension transport suite passed as well.
- Final CI artifacts: extension **12335143318**; Windows helper **12336221223**.
  The Windows CI EXE is 196,628,503 bytes. Different compiler/platform builds use
  their own supplied checksum; local installer is a separate verified artifact.
- Installation/handoff/README now link directly to those exact downloadable builds.
  Final evidence commit is docs-only with redundant CI skipped. No application
  changes after green CI. Main unchanged; no store/public release or deployment.
- Remaining: user laptop's two real OpenAI account checks and actual renewal/logout,
  interactive Windows acceptance. Claude automatic isolated browser login, reliable
  fresh monitoring and applicable product route remain blocked. No credential
  collection, provider login, model requests or external provider messages occurred.

## MULTI-COMPLETE / code checklist start — 21 October 2026

- User authorizes completing remaining code and keeping live account acceptance
  separate. Added MULTI-ACCOUNT-CODE-CHECKLIST.md. Existing worktree clean at
  local 010f7bb, published 791d82b6, same tree.
- Re-inspected service, diagnostic, shared contracts, account merge and packaging.
  Current missing code is Claude sign-in/adapter/UI/runtime packaging.
- New narrow evidence: official troubleshoot-install documentation explicitly
  describes BROWSER for browser routing, while a historical issue reports it was
  absent. Will capability-test the unmodified official binary in an empty profile;
  no account/credential/model interaction, no auth URLs in output.
- Next: resolve browser launch, then implement remaining code sequentially.

### MULTI-COMPLETE / Claude code integration checkpoint

- Narrow official-interface investigation found documented BROWSER routing in
  troubleshoot-install. Ran unmodified Claude Code 2.1.301, integrity checked from
  official npm, in a fresh unauthenticated profile: BROWSER marker invoked, actual
  authorization callback was loopback, terminal shutdown confirmed. No credentials,
  authorization URL, code or account were entered/exported. This resolves the
  prior lack of a known browser-routing implementation; account tests stay manual.
- Implemented claude-adapter/browser-route/first-party-setup modules and a Windows
  C# BROWSER launcher compiled during helper setup. Official CLI owns OAuth/code
  exchange/storage; router launches only allowlisted provider URLs in fresh browser
  folders and records a URL-free acknowledgment. No silent ordinary-tab fallback.
- Service now supports provider-scoped Claude profiles, organization-aware identity
  fencing, CLI /usage reads, five-minute cooldown, cancellation, acknowledged logout,
  first-party onboarding action and CLI dependency readiness. Model prompts forbidden.
- Shared schemas/merge/UI support mixed Claude/OpenAI accounts and preserve OpenAI
  namespaces/aliases/history. Provider setup uses official prompts; trust/terms are
  not auto-accepted. A one-time setup window may need the user's choices and closure.
- Windows package includes terminal libraries and launcher source; setup provides
  official Claude installer action. Updated version to 3.2.0 preview. No Claude
  binary redistribution or custom third-party OAuth was added.
- Actual checks: TypeScript, 102 core, 20 legacy helper and 16 integrated connection
  tests passed in `npm run check`, including actual isolated fictional Claude PTYs.
  Browser/proof and Windows official-interface checks are underway. Manual account
  freshness/logout/renewal remains a separate checklist, not unfinished code.
- Next: finish regressions, validate Windows routing on CI, package and push.

### MULTI-COMPLETE / source ready for Windows CI

- Full browser suite **29/29 passed**, plus final rebuilt setup-focused **4/4**.
  All 16 integrated service tests pass, now also exercising production Claude login
  completion and cancellation with actual fictional CLI terminals; retained quota
  survives cancellation. Existing 28 proof/PTTY tests pass.
- Official Linux 2.1.301 routing smoke script passes (no account sign-in). Added the
  same Windows check with pinned official binary integrity and owned compiled router.
  Windows native service tests compile the launcher before loading the adapter.
- Added explicit dependency/version/router error help, per-user WinGet discovery,
  startup-safe mixed metadata, first-party setup retry/cancel controls and bundled
  terminal dependencies. No real-account test is marked as an unfinished code stub.
- Updated checklist/install/privacy/README/handoff to 3.2; older unavailable-only
  Claude statements are historical. Final variants/installer packaging in progress.
- Next: commit/push coherent source, inspect actual Windows browser routing and
  all CI results, then publish exact artifact links and check off code delivery.

### MULTI-COMPLETE / Windows native-check investigation

- Source pushed as 87a1879b390bae3fb11a6aa98e0d8a494a620377, exact local
  c846f33 tree 5e4a0609a02b794b80639a7adaf2a847b5e9eb56.
- CI 39583747381: Linux verify and connected-services passed. Windows compiled its
  launcher but the integrated check has stalled; no Windows/overall success claimed.
- Added a 45-second native test deadline, four-minute Windows check-step deadline
  and retained diagnostic artifact. Moved official Windows BROWSER capability
  before integration so its independent result is visible even if a fixture stalls.
- Next: publish bounded diagnostics, inspect exact failure, fix the cause and rerun.

### MULTI-COMPLETE / Windows terminal resource fix

- Bounded CI 39584746042 confirmed the official Windows Claude 2.1.301 BROWSER
  route and CLI-owned loopback callback without account sign-in. Linux and server
  jobs passed; all Windows connection assertions passed but the test file retained
  a terminal resource and failed the step deadline. This was a production cleanup
  defect, not a pending real-account test.
- Inspected pinned node-pty 1.1.0's OS-ConPTY lifecycle: natural CLI exit destroys
  its output socket but retains its drain worker/input handle until public kill().
  stopProbeTerminal now invokes that API once on Windows after confirmed CLI exit,
  including successful login; failed cleanup cannot release a successful result.
- Added a regression for natural-exit terminal disposal and cleanup failure. No
  process.exit(), force-exit test flag, private-library patch or credential handling.
- Next: run native/proof regressions, publish the fix and inspect fresh Windows CI.

### MULTI-COMPLETE / end-to-end browser launch argument correction

- Continued final integration review found the shared launcher was assigning its
  provider argument back to OpenAI at the actual browser-spawn call. Claude route
  marker tests did not cover this real shared launch boundary. Fixed forwarding
  the selected provider and made browser launch dependencies injectable for a
  regression that executes the actual allowlist/argument path without opening
  an account/browser. Claude can now reach its external isolated sign-in window.
- Local terminal cleanup checks: 16/16 connection tests and 29/29 proof tests passed.
  Windows fix published as 32ae8e649d150edfa67a1656fd062289f1d43d9e; fresh CI pending.
- Next: run/publish the browser-boundary regression and inspect Windows results.

### MULTI-COMPLETE / Windows cleanup regression resolved

- CI 39585758002 confirms Windows native tests finish and exit: 16/16 passed,
  zero cancelled, 12.5-second file duration; the previous retained-worker hang is
  resolved. Official Windows Claude routing passed again. Pinned node-pty may
  still emit an AttachConsole cleanup warning when its enumerator sees an already
  exited CLI; no account output or credentials are printed.
- The subsequent Windows build was interrupted by legacy PowerShell treating WXT's
  normal stderr progress as NativeCommandError under redirected Tee-Object. Changed
  only capture to cmd redirection, replaying the full log and preserving npm's real
  exit code; genuine test/build failures still fail the job. No test was disabled.
- Local launcher-boundary regression now passes: 17 connection and 29 proof tests.
- Next: publish this checkpoint, finish clean Windows packaging and link artifacts.

### MULTI-COMPLETE / metadata command shutdown ownership

- Final lifecycle review extended acknowledged cancellation to short official
  CLI metadata/auth commands (version, status, logout), which previously called
  kill then rejected immediately. They now wait for actual exit; a five-second
  missing acknowledgment fails closed with terminal-stop-unconfirmed, retaining
  service recovery state. No raw output enters error messages.
- Added a delayed-exit subprocess regression. Next: run native/proof checks and
  include this safety fix in the final packaged source checkpoint.

### MULTI-COMPLETE / cancellation failure priority — final package follow-up

- CI 39586512717 passed all three jobs on 75ac06d3, including Windows routing,
  native regressions, GUI construction, installer and extension artifacts. Prior
  source was green, not a substitute for testing this final follow-up.
- Final error-path review found login cancellation could mask an unconfirmed
  Claude shutdown as an ordinary cancelled/sign-in state. Preserve shutdown errors
  ahead of cancellation so requiresRecovery fences all new provider operations.
- Added an integrated regression that cancels a fictional login, simulates a
  missing shutdown acknowledgment, and verifies safe error/state/recovery fencing.
- Next: publish this focused fix, rerun source CI/package and update final download
  links. Manual real-account acceptance remains separate; no account access needed.

### MULTI-COMPLETE / COMPLETE — code delivered; manual accounts separate

- Completed every item in MULTI-ACCOUNT-CODE-CHECKLIST.md. Independent OpenAI/Codex
  and Claude Code adapters are integrated into the extension, with aliases, scoped
  cancellation/reconnect/disconnect, bounded refresh and correctly dated failures.
  Other providers retain website tracking. No remaining coding stub on this scope.
- Final production source pushed as d3e821ad1d200c16bc6c0b6d6efc4de8315ae7dc,
  matching local be1efc0 tree f1c036d44baba61caa5aa765119052fef99852da. Final
  documentation follow-up changes no production code and skips duplicate source
  CI; the following actual source build remains the authoritative package evidence.
- CI https://github.com/voiddev011/mylimits/actions/runs/39587512847 **SUCCESS**:
  windows-logic, verify and connected-services all passed for that exact source.
- Actual final Linux/Windows checks: TypeScript; 102 core, 20 legacy native and
  18 integrated connection tests each passed. Proof tests: Linux 30 passed;
  Windows 29 passed/one explicit symlink-privilege skip. Zero failed/cancelled.
  Full Chromium 29/29, Chrome/Edge/Firefox manifests, ZIP contracts/checksums passed.
  Existing real-PostgreSQL/server, phone dashboard and extension transport gates
  passed. Official unmodified Claude 2.1.301 BROWSER/loopback capability passed
  on Windows and Linux without account login, credential export or model prompts.
- Windows GUI scripts parsed and actual controls constructed; installer compiled
  on Windows and uploaded with checksum. Local NSIS build also passed for the
  final cancellation fix; staged adapter/runtime files match final source.
  Pinned terminal dependencies included. Upstream ConPTY AttachConsole cleanup
  warnings remain visible, but workers exit and tests finish normally.
- Final downloads: extension artifact 12340496910 (Chrome/Firefox ZIPs and
  SHA256SUMS); Windows x64 helper 12339618052 (EXE and checksum). Exact links,
  artifact-envelope hashes and instructions are in MULTI-ACCOUNT-HANDOFF.md and
  MULTI-ACCOUNT-INSTALL.md. README now describes current 3.2 behavior directly.
- **Separate manual checks PENDING (user):** two actual accounts each provider,
  normal browser A unaffected by B, provider values/scopes, usage elsewhere,
  restart, ordinary website logout vs global revocation and actual token renewal.
  Interactive clean Windows install/upgrade/uninstall is also manual. Fictional
  CLI tests and unauthenticated capability checks do not prove these behaviors.
- **Code blockers: none known on this checklist.** Release readiness awaits manual
  acceptance and signing/publication review. No main merge, release, credential
  upload or external provider message was performed.
- Next action: user installs matching 3.2 artifacts and performs manual acceptance.
  Implementation phase complete; no further code task queued by this instruction.

### HOSTED-TRIAL / in progress — installer-free request supersedes delivery claim

- User reports the actual GPT account-adding journey still opens the normal
  session; earlier code/test completion does not establish a working user flow.
  User now authorizes proposing a plan and trying a hosted/no-local-installer route.
- Created sequential HOSTED-ACCOUNTS-TRIAL-PLAN.md on feature/hosted-account-proof.
  Keep production collectors disabled; no UI-only update labeled a solved login.
- Runtime readiness: enforced HTTP, no provider accounts/OAuth client/production
  KMS or hosted service credentials. Existing Fastify/PostgreSQL credential/jobs
  infrastructure is reusable after the real connector gate, not functional today.
- Narrow official docs reveal App Server chatgptDeviceCode, including first-party
  cancellation and CLI-owned credentials. Beta requires a user/admin setting and
  entering a one-time code; this differs from one-click browser OAuth. Claude
  documents remote manual-code fallback; unmodified 2.1.301 public login help
  advertises no custom callback URL option.
- Added developer-only redacted official transport probes in companion/proof and
  scripts/probe-hosted-login.mjs, with six passing redaction/lifecycle tests. Not
  imported by the extension/server. Official binary experiment now running in fresh
  temporary homes with no account authentication, quota fetch or model request.
- Next: record actual official results, finish bounded checks, commit and push the
  experiment/plan. Real hosted sign-in eligibility and A/B proof remain gated.

### HOSTED-TRIAL / official transport attempt completed — product gate still pending

- Ran new probe with checksum-verified official Codex 0.163.0 Linux native binary
  and unmodified Claude Code 2.1.301, in private temporary profiles. Both official
  processes stopped and temporary profiles were removed. No accounts authenticated,
  quotas fetched, model prompts sent or auth URL/code/credential output exported.
- **Observed:** OpenAI initial account absent; App Server chatgptDeviceCode issued a
  valid ticket; official cancel acknowledged; process exit confirmed. This provides
  a real headless transport candidate, not proof of two accounts or quota access.
  Beta device login needs code entry and may require a security/admin setting.
- **Observed:** Claude BROWSER invoked with first-party authorize URL and loopback
  callback; no custom callback option in public login help; shutdown confirmed.
  Laptop-to-server automatic completion and account isolation remain unresolved.
- Six hosted probe regression tests passed (redaction, strict verification URL,
  callback classification, unexpected-account refusal, cancellation, error privacy).
  Added a CI step for these tests; the experiment is not imported by production
  collectors or the extension. Existing production collector map stays empty.
- Plan/results/reproduction and the exact pending gates are recorded in
  HOSTED-ACCOUNTS-TRIAL-PLAN.md. START-HERE now directs the next agent to this trial.
- Next: finish narrow regressions and publish the research branch. Subsequent
  account proof requires an allowed hosted integration, secure private test host
  and user provider sign-in; none is configured here. UI replacement follows that
  proof, with site switches replaced by + and current-account/other-account actions.

### HOSTED-TRIAL / experiment ready for publication

- Final narrow checks passed: 7 hosted diagnostic tests, existing 30 account-proof
  tests, JavaScript syntax and git diff whitespace checks. Additional failure-path
  test confirms an unacknowledged metadata process retains its private profile.
- Added npm probe/test scripts and a CI step. README and START-HERE point at the
  new plan/results and explicitly preserve the unresolved real user sign-in issue.
- This checkpoint changes developer experiments/documentation, not product UI,
  provider OAuth registration, production collectors or deployed infrastructure.
  No real-account tests have passed and no updated extension installer is claimed.
- Next external prerequisite: allowed hosted authorization and a secure private
  test service/account sign-in. Next implementation milestone after that: A/B
  identity plus quota proof, followed by + menu and hosted collection. Continue
  only within established provider conditions; no fabricated one-click substitute.

### HOSTED-TRIAL / published handoff

- Pushed feature/hosted-account-proof at 0e39450974fdad7d7f47900342fd0b57e59bea9e,
  matching local 173c06f tree 951977a461cfca454a2917be69ed6fded44b59cb.
  CI 39630930205 queued; not marked passed. This documentation follow-up skips
  duplicate CI and changes no code. Main/feature-independent-accounts untouched.
- Delivered the plan, executable unauthenticated official transport experiment,
  seven passing local diagnostic tests and 30 passing existing proof regressions.
  OpenAI device-code initiation/cancellation observed; Claude loopback observed.
  Neither authenticated a real account nor fetched quota. Exact one-click hosted
  multi-account UX remains unproven; no product-complete claim.
- Next remains the permitted hosted login/account proof described in the plan,
  before production backend collectors and replacing site switches with +.
