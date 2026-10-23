# Current implementation status — Desktop + extension

Updated 23 October 2026. Active work: `codex/c4`, targeting
`feat/persistent-accounts`. C1–C3 are integrated; C4 passed local checks and is
ready for Checkpoint A review. Main is unchanged. Desktop was implemented on
`feature/desktop-independent-accounts`, created from clean
`docs/desktop-accounts-execution-plan` (`3f218f6` locally).

## Current decision

The active persistent-accounts plan is
[the unchanged R2 proposal](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md).
The next major boundary is Checkpoint A after C4: user review and the 3–4 day
website-reliability trial, before C5. No saved-session vault or browser-only
independent login exists from C1–C4. Historical Desktop acceptance remains pending.

The implemented direction is a desktop app alongside the extension. See
[Desktop delivery and pending acceptance](DESKTOP-ACCOUNTS-HANDOFF.md) for the guided Windows installation,
isolated official provider profiles and combined account quotas. The installer-free
hosted route is deferred. It was not completed by earlier infrastructure work.

## Baseline before this feature branch (historical)

- Existing: website tracking, compact popup/dashboard/logos, aliases/history,
  local independent account service, official Codex and experimental Claude CLI
  adapters, per-account queues, browser router, Native Messaging and Windows GUI/NSIS.
- Existing 3.3 default independent choice uses hosted capabilities. Production hosted
  drivers are absent; local experimental service is available through advanced setup.
- Missing from the agreed upgrade: verified A/B provider behavior, desktop-first +
  integration, revised guided installer/bootstrapper, measured size reduction and
  clean Windows install/update/uninstall acceptance.
- OpenAI email metadata has limited identity confidence; same-email workspaces
  cannot be treated as distinct verified identities without supported evidence.
- Neither real authenticated provider quotas, other-device refresh, browser account
  preservation, logout behavior nor actual credential renewal has been verified here.
- Source/fixture tests and unauthenticated official-binary routing are historical
  evidence only. See [the consolidated record](IMPLEMENTATION-HISTORY.md).

## Execution checklist

| Task | Code status | Live acceptance |
| --- | --- | --- |
| D01 Existing local path audit/reproduction | COMPLETE | Not provider proof |
| D02 OpenAI isolated-account integration/proof | IMPLEMENTED; user-run proof pending | PENDING |
| D03 Claude isolated-account integration/proof | IMPLEMENTED experimental path | PENDING |
| D04 Identity/contracts/migration | IMPLEMENTED + automated checks pass | PENDING where relevant |
| D05 Refresh/process ownership | IMPLEMENTED + automated checks pass | PENDING |
| D06 Desktop/native bridge | IMPLEMENTED; Linux and Windows transport tests pass | Real Windows browser PENDING |
| D07 Extension + connection journey | IMPLEMENTED; 31 Chromium fixtures pass | Real Windows browser PENDING |
| D08 Guided installer/bootstrapper | IMPLEMENTED; actual EXE compiled | Clean Windows PENDING |
| D09 Update/uninstall/packages | IMPLEMENTED; local lifecycle/payload checks pass | Clean Windows PENDING |
| D10 Acceptance and handoff | Packages/checks delivered; handoff recorded below | Both providers PENDING; feature incomplete |

## Documentation checkpoint — this task

- Created the single desktop implementation plan and concise Sol 6.1 starter.
- Consolidated eleven superseded Markdown files and the long old status ledger.
  Unique test/provider conclusions are in IMPLEMENTATION-HISTORY; research and
  installation details remain in their relevant reference files. Full originals
  remain recoverable from the baseline Git commits.
- Updated start/index/install/reference links. Provider code, runtime behavior,
  account data, versions and existing extension artifacts are unchanged. Only help
  URL targets outside Markdown may change to follow consolidated documentation.
- Validation: 69 relative Markdown links checked, zero missing targets; 18 project
  Markdown files, all directly in docs/. `npm run typecheck` exited 0 and
  `git diff --check` passed. The two executable-file changes only replace help URLs.
- No application suite or live account test has been run by this documentation task.
- No new Desktop feature, backend deployment, main merge or release is claimed.
- Publication: Git CLI could not reach its configured proxy; the connected GitHub
  tools published this branch while preserving the remote parent. Source checkpoint
  `fba0e3829f37d7da9cc3738244b786a2e73b5ef6` matches local `73df840` exactly
  (tree `b18d76fd81ff66ff23e0bc46e20aa192a3c10080`). This documentation follow-up
  records that publication. Do not force-push older divergent commit IDs.

## Next action

Review the C4 PR, then stop at Checkpoint A for user review and
the [manual trial](INSTALL.md#persistent-accounts-checkpoint-a-c1c4). Keep C5 and
all private-session/vault work gated. For the separate Desktop path, real-account
acceptance in DESKTOP-ACCOUNTS-HANDOFF.md remains pending for both providers.

After each task record changed files, commands/results and skips, evidence level,
decisions, blockers and next action. Final reporting separates implementation,
automated tests, live verification and blocked/unverified work.

## D01 — inspected and reproduced

- Inspected required documents and existing connections, App Server, Claude adapter,
  isolated browser/router, native host, storage contracts, controller, + UI and
  Windows installer/dependency packaging. No user edits were present.
- Gaps: default + selects empty hosted drivers; login presently auto-accepts the
  reported account; identity is email-only for Codex; installer requires a separate
  registration GUI, carries all dependencies and has no bootstrapper/update staging.
- Baseline: `npm run test:account-proof` 30/30 passed and
  `npm run test:connections` 18/18 passed with real fictional subprocesses/PTYs.
  Initial sandbox runs failed from EPERM on child-process execution; rerunning
  the same commands through permitted local execution passed. No tests were weakened.
- Measured existing unsigned installer: 211310699 bytes. Cached official Node ZIP:
  37733703 bytes; Codex TGZ: 167618721 bytes. Installed official Codex executable
  alone is 341270320 bytes; a bootstrapper cannot erase those runtime requirements.
- Refreshed official App Server/login/rate-limit and Claude auth/credential-use
  documentation. Official local-profile routes remain the selected integration;
  public product/distribution eligibility is not claimed from code inspection.
- Real accounts and a Windows interactive desktop are unavailable. All real-provider
  matrix rows stay PENDING. No compiler for the Windows installer was found on PATH;
  build access will be addressed in packaging rather than reporting an EXE prematurely.
- Changed file: this status ledger. Next: D02 account confirmation and OpenAI tests.

## D02 — official account completion now requires confirmation

- Reused actual App Server managed browser login, separate CODEX_HOME/browser
  directories and documented account/rate-limit RPCs. Added an explicit staged
  identity state and generation-bound confirm command before first quota acceptance.
  A window/route marker/CLI completion alone cannot connect a new profile.
- Shared confirmation also prepares Claude without replacing its official login.
  Wrong identities, cancelled confirmations and late generations are rejected;
  display identity stays in local service/connection UI, not extension account storage.
- Changed: companion/connections.mjs, protocol.mjs, connections.test.mjs;
  src/core/independent-contract.ts; platform/messages.ts, companion.ts, controller.ts.
- `npm run test:connections`: 20 passed; actual fictional CLI/PTY mechanics,
  including explicit confirmation/no-early-quota/wrong-account cases.
  Initial regression used obsolete adjacent-client indexing after confirmation
  added a second client; assertion now verifies the two distinct account homes.
- `npm run typecheck`: passed. No real provider sign-in/quota test was possible.
  Provider subject/workspace stay null where official metadata omits them.
- Next: D03 Claude-specific identity/freshness/error cases; provider acceptance pending.

## D03 — Claude isolated official-runtime path

- Retained unmodified Claude Code login with per-account CLAUDE_CONFIG_DIR,
  official BROWSER route, metadata checks around bounded `/usage` reads and scoped
  official logout. New shared confirmation now applies to Claude too.
- Consent is retained when verified identity is accepted but the first usage read
  requires official onboarding. Finishing setup can recover without an inaccessible
  confirmation loop. Identity change revokes local confirmation and rejects readings.
- Expanded allowlisted errors for unsupported auth/profile/identity/panel formats;
  no raw CLI output/token material is sent to the extension.
- Changed companion/connections.mjs and connections.test.mjs. `npm run
  test:connections`: 21 passed, including same-email/distinct-organization,
  explicit confirmation, setup recovery and changed fixture quota/identity cases.
- These are simulated providers. No real Claude login, idle upstream freshness or
  account-B browser preservation was tested. Official authentication docs support
  separate claude.ai config directories; official credential conditions distinguish
  unmodified end-user CLI sign-in from third-party credential collection. No Claude
  binary is modified/redistributed; public product/distribution review remains open.
- Next: D04 additive metadata backup/migration and pending confirmation recovery.

## D04 — additive migration and restart recovery

- Retained version-2 file/connection/account IDs; added metadata revision 1 with
  one-time owner-only metadata backup before upgrading old files. Provider credential
  directories are neither copied nor parsed. Existing aliases/readings/history remain.
- Pending confirmation now survives service restart with its reported identity and
  generation. Restarts do not publish fresh readings. Existing official Codex config
  is no longer overwritten on every check. Invalid new fields fail validation.
- Changed companion/connections.mjs and connections.test.mjs.
- `npm run test:connections`: 23 passed; `npm run typecheck`: passed;
  `npm test`: 109 passed. Migration, existing config, old IDs and confirmation
  recovery are simulated local tests, not real provider behavior.
- Next: D05 refresh scheduling, serialized sign-in and process ownership.

## D05 — serialized authorization and browser-attached refresh

- Only one provider authorization starts at a time, avoiding competing callback
  listeners or parallel login windows. Other account refreshes retain their bounded
  per-account queues. Reconnect requires explicit renewed identity confirmation.
- Desktop polling now starts on an authenticated native client and pauses without
  clients. Closing provider tabs does not affect it; browser reopening triggers
  only eligible checks. Existing persisted cooldown/backoff, dated failures and
  confirmed owned-process shutdown remain in force.
- Claude rendered throttling errors are classified without exposing raw panel text.
- Changed connections.mjs/tests, daemon.mjs and proof/claude.mjs.
- `npm run test:connections`: 24 passed; `npm run test:account-proof`: 30 passed.
  Subprocess/PTY, coalescing, throttling, cancellation and shutdown tests use fixtures;
  provider renewal/revocation/actual quota freshness remain unverified.
- Next: D06 version negotiation/readiness and actual native host/daemon transport tests.

## D06 — real native host/daemon transport

- Kept the existing authorized host/IPC boundary and protocol 2; new Desktop
  readiness requires explicit identity-confirmation capability. Old helpers cannot
  silently skip confirmation. Provider readiness checks actual executable availability.
- Added generation-bound confirm request validation and sanitized errors. Added
  explicit operator/test data-directory relocation, never accepted from page input.
- Added a real host.mjs → framed stdio → authenticated daemon socket → fictional
  CLI integration test. It confirms no polling before browser attachment, current
  fixture readings after attachment, strict extra-field rejection and safe frames.
- Changed paths.mjs, daemon.mjs, connections.mjs, transport.test.mjs,
  platform/companion.ts and package.json (transport suite joins test:companion).
- `node --test companion/transport.test.mjs`: 1 passed; `npm run typecheck`: passed.
  Actual local transport is tested, but provider is fictional; no real account or
  actual Windows browser handshake claim. Stable store extension IDs remain a
  publication prerequisite; setup must discover development installs automatically.
- Next: D07 route + to Desktop and provide identity confirmation/alias in dashboard.

## D07 — Desktop is the main independent + journey

- + now routes OpenAI/Claude independent choices to the actual local service,
  keeping website tracking separate. Other providers honestly remain website-only.
  Added reported-identity confirmation, aliases, wrong-account discard, provider
  setup/error states, and pending sign-in resume after view closure/restart.
- Popup remains compact; detailed setup stays in the dashboard. Added a Desktop
  connection prompt, renamed advanced local settings and retained privacy masking.
  Optional public HTTPS setup URL is build-configured; without publication, the
  beta button points at branch CI artifacts and is labelled test setup.
- Version is 3.4.0 Desktop accounts preview. Changed AccountConnect,
  OpenAICompanion, App, Popup, build/environment config, package metadata and browser
  fixtures. No hosted backend or custom provider login was added.
- `npm run typecheck` and `npm run build`: passed. Browser run: 30 passed and one
  stale settings-navigation selector failed; corrected that selector and added
  pending-sign-in resume coverage. Targeted rerun: 1 passed. Full suite will run
  at final delivery after packaging changes.
- Browser provider/native responses are fictional; no real OpenAI/Claude connection
  or Windows browser acceptance is claimed. Stable signed public download/store IDs
  remain release prerequisites, not completed by a test setup link.
- Next: D08 guided per-user bootstrapper and measured dependency downloads.

## D08 — guided Windows bootstrapper built

- Added a guided WinForms setup that detects MyLimits installations automatically,
  selects providers, verifies official archive/executable integrity, displays download
  progress, registers all detected browsers in one operation and checks daemon
  readiness before success. No ID copying, npm or terminal commands are required.
- Node/Codex are acquired from pinned official sources only when needed; unmodified
  Claude uses its official WinGet installation with provider/Windows prompts. Shared
  private runtimes are reused by pinned executable hash. No Chromium is bundled.
- Lean Windows payload preserves executable PTY dependencies/licenses while excluding
  debug symbols, maps, other-platform builds, source/tests and provider credentials.
  Default packaging is online; an explicitly larger offline option remains available.
- Changed Windows setup/runtime/NSIS, install.mjs batch registration, new
  desktop-health.mjs, desktop package builder/test, dependency metadata, licensing,
  npm commands and Windows CI packaging/parser tests.
- `npm run test:desktop-package`: 1 passed; JavaScript syntax checks passed.
  Compiled an actual unsigned setup EXE with isolated Debian NSIS 3.08 (no admin
  install). Initial bootstrapper ~1.56 MB, payload ~3.09 MB, versus old 211.31 MB EXE.
  Node download remains 37733703 bytes; selected Codex adds 167618721 bytes.
  Installed official runtimes remain large. Final checksums/sizes follow D09/D10.
- Windows PowerShell parser/GUI/download/install execution is pending Windows CI
  and interactive acceptance. Compiling an EXE is not proof of a clean Windows install.
- Next: D09 staged upgrade/rollback and owned process-tree shutdown/uninstall.

## D09 — owned shutdown and staged upgrade/recovery

- Added credential-free process ownership records for real Codex/Claude processes,
  including metadata commands and setup. Confirmed exit clears records; an
  unconfirmed writer blocks service restart until guided repair checks its PID,
  executable, creation time and current-user ownership. No all-node/browser kill.
- Program files stage separately and activate by directory rename with rollback.
  Guided setup stops owned tasks/process trees, verifies replacement runtimes,
  restores executable backups on failure and repairs interrupted script updates.
  Account profiles, aliases and readings are outside the runtime transaction.
  Uninstall uses the same bounded owned shutdown and explicit keep/delete data.
- Tasks now include the current user's SID; owned legacy tasks are retired after
  successful setup. A per-user setup mutex prevents concurrent setup operations.
  Successful setup deletes archive cache and writes local installed-byte/download
  measurements without credential contents. Official Claude download bytes stay
  unknown; failed partial-transfer traffic is not counted as a verified archive.
- Changed connections/adapters/proof runtime, Windows setup/runtime/uninstall/tasks,
  install.mjs, new owned-processes/runtime-update modules and tests, actual native
  health transport coverage and Windows parser/rollback/process tests.
- `npm run check`: passed (109 core, 20 legacy native, 24 connections, 3 native/
  runtime lifecycle tests, typecheck/build). `npm run test:account-proof`: 30 passed;
  `npm run test:hosted-probe`: 10 passed; `npm run test:desktop-package`: 1 passed.
- First pushed CI at 84a3d87 passed Windows integrated/ConPTY and unauthenticated
  official browser checks, but found a PowerShell 5 UTF-8 decoding bug and two old
  UI selectors. Fixed setup scripts to ASCII, scoped the duplicate Add button, and
  retained hosted API transport regression through commands instead of restoring
  hosted login to +. Final CI and full browser rerun are in progress for D10.
- All provider fixtures are simulated. No live account, clean laptop installation,
  publication eligibility or real quota freshness has been established.
- Next: D10 final CI, artifacts/checksums, install instructions and live-test handoff.

## D10 — final validation and recovery follow-up

- Full Chromium suite: 31 passed. Linux check/typecheck/core/native/build and
  Chrome/Edge/Firefox package contracts passed; clean Chrome/Firefox archives and
  checksum files generated. Windows CI run 39732012852 at b260d3c passed all three
  jobs, including real Windows parser/GUI construction, executable rollback and
  owned/unrelated-process shutdown assertions, NSIS packaging and existing server
  transport regressions. No interactive account sign-in was performed.
- Retrieved and hash-verified that run's actual Windows EXE (1499970 bytes).
  Guided setup itself, official runtime acquisition on a clean laptop, account
  login, A/B browser isolation and independent provider freshness remain PENDING.
- Final inspection found crash/reboot markers could unnecessarily require repair
  after their process had exited. Startup now clears only records whose process is
  confirmed absent by the OS. Live, reused or inaccessible PIDs stay fenced until
  guided ownership repair; no process is killed by the daemon's recovery check.
  Added actual subprocess-exit/restart coverage, plus clearer UI repair instructions.
- Latest `npm run check`: passed (109 core, 20 legacy native, 24 connections,
  4 native/runtime tests, typecheck/build). Desktop payload test passed. This
  recovery fix changes the Desktop artifact; final CI/artifact hashes will be
  recorded at the delivery checkpoint rather than reusing b260d3c's EXE hash.
- Next: push this final code checkpoint, inspect its Windows CI, then finish
  installation/privacy/architecture/handoff documentation with matching artifacts.

- Final code CI at f723e32 passed Windows Desktop and all extension checks. Its
  unrelated hosted transport regression exposed an early assertion: it waited
  only for account presentation before asserting disconnect. Strengthened the
  fixture to await the authoritative disabled connection and assert the actual
  PostgreSQL disconnected generation; provider behavior is still simulated.
  No hosted production path was added or substituted for Desktop. Rerunning CI
  checks this stronger boundary before final delivery.

## D10 — delivery checkpoint

- Pushed final code checkpoint `8f43c21c0934774cbcea810667579d162346961f`.
  [CI run 39756974345](https://github.com/voiddev011/mylimits/actions/runs/39756974345)
  passed all three jobs: verify, windows-logic and connected-services. This includes
  109 core tests, 20 legacy native, 24 connections, 4 runtime/native transport,
  30 proof, 10 hosted diagnostic, 1 payload and 31 Chromium tests; Windows setup
  parser/GUI/rollback/owned-process checks, official unauthenticated router check,
  NSIS build and existing 43-test PostgreSQL/API suite plus web/transport checks.
- Downloaded the actual CI artifacts through the GitHub connector and verified
  their own hashes locally. Windows EXE: 1500185 bytes, SHA-256
  `8c4651c2bd21801b7ed9ec0927d7480fe9409317ac1b3c74d8abd5321d8d2e74`.
  Chrome ZIP: 307211 bytes; Firefox ZIP: 305119 bytes. Exact ZIP hashes and all
  download links are in DESKTOP-ACCOUNTS-HANDOFF and artifact SHA256SUMS.
- Bootstrapper payload 3110365 bytes; first Node/Codex archives add 205352424 bytes.
  Actual clean installed footprint/time and Claude downloads remain unmeasured;
  extracted Node/Codex components alone are 559572171 bytes. A small initial EXE
  is not a tiny total install. Setup now records actual per-machine byte totals.
- Added DESKTOP-ACCOUNTS-HANDOFF with complete pending live matrix and short
  installation/testing steps. Updated INSTALL, START-HERE, README, architecture,
  privacy, platform/provider references, active plan and starter follow-up note.
  Documentation validation: 19 project Markdown files all directly in docs, zero
  missing relative links; git diff whitespace check passed.
- IMPLEMENTED: actual local provider/extension integration, confirmation/migration,
  refresh/ownership/recovery, guided installer and packaged artifacts. AUTOMATED
  TESTED: results above. LIVE VERIFIED: no authenticated real provider pair.
  BLOCKED/UNVERIFIED: both actual A/B identities/quota/freshness/logout/renewal,
  clean interactive Windows install/update/uninstall, signing/store publication,
  provider product eligibility and same-email OpenAI workspace discrimination.
- No main merge, release or hosted deployment. Next: user-run real account tests
  from INSTALL/HANDOFF. Report provider errors as integration failures to resolve;
  never turn these PENDING rows into passed rows from fictional CI evidence.

## Brave detection follow-up — 22 October 2026

- User reports the installed extension is not discovered in the normal Brave
  `User Data\Default` location. That rules out a custom-root assumption, but no
  browser settings file or credentials were requested/uploaded.
- Inspected setup: it required `entry.manifest.name` and parsed the entire saved
  profile through Windows PowerShell 5 ConvertFrom-Json. This misses unpacked
  entries containing only `path`, and rejects valid case-distinct/empty dictionary
  keys anywhere in Chromium preferences. The catch hid those parse failures.
- Updated desktop-runtime.ps1 to use the built-in dictionary JSON reader and a
  bounded local manifest fallback for known extension IDs. No cookie/session file
  access, UNC reads or unrelated-data exports. Relative installed paths cannot
  escape the profile's Extensions directory. Added a guided browser-profile folder
  picker with automatic IDs and correct custom-root return-to-extension routing.
- Changed Windows setup/runtime, Windows tests and INSTALL. Added real Windows
  regression cases for Brave Default/path-only unpacked manifests, relative
  installed manifests, unusual unrelated JSON keys, rejected external paths and
  a selected custom profile. Existing GUI still operates before Node download.
- Local payload/whitespace checks and actual Windows parser/GUI/discovery results
  will be recorded after running them. Next: validate, push, inspect Windows CI,
  then deliver the corrected setup artifact; user-machine detection remains to retry.

- Verification completed at `999509d642245ceaafd36ab28c983dcb368db5a2`:
  [CI 39775842039](https://github.com/voiddev011/mylimits/actions/runs/39775842039)
  passed all three jobs, including the real Windows PowerShell parser, setup GUI,
  expanded Brave discovery cases, process/rollback checks and installer build.
  Local `npm run test:desktop-package`: 1 passed; whitespace check passed.
- Retrieved and verified corrected Windows setup: 1501400 bytes, SHA-256
  `4dc87e522945a23f4c0e568097009f2a1965857f829f4bb96f8ffb1272e7b3de`.
  Updated INSTALL/HANDOFF links, sizes and checksums to the matching run.
  Extension 3.4 needs no rebuild for this setup-only fix; no ID entry or browser
  cookie/password copying was introduced. Next: user reruns the corrected setup
  as their normal Windows user and reports whether Brave Default is now detected.
  Real provider account-isolation/quota acceptance remains PENDING.

## Branch consolidation

- User authorized safe branch merging and deletion of merged branches. Fetched
  all 13 remote heads; no open PRs or uncommitted work were present. Keep `main`
  and the active `feature/desktop-independent-accounts` while provider acceptance
  remains pending. Main stays at its existing stable source snapshot.
- Verified the remote desktop-plan tree exactly matches the local plan baseline.
  Recorded a content-preserving ancestry merge so the earlier published branch
  commits remain reachable alongside the original local implementation history.
- Found one unique user commit, `b5931cc` (dockerize), on hosted-account-proof.
  Integrated its Docker/Compose files, Node compatibility matrix/metadata and
  empty OIDC-secret fix. Conflict resolution preserves current Vault configuration,
  broader Docker secret exclusions and current Desktop documentation. Node wording
  changes from superseded documents were ported into maintained docs instead of
  restoring obsolete plans. No container was deployed or image execution certified.
- Local `npm run check` passed, server typecheck passed and the merged OIDC config
  regression passed (1 test). Relative documentation links and whitespace passed.
  [CI 39891316967](https://github.com/voiddev011/mylimits/actions/runs/39891316967)
  passed all six jobs: Node 22/24/26 compatibility, extension/browser verification,
  Windows logic/installer packaging and connected PostgreSQL/API/transport tests.
  These checks do not verify live provider account behavior.
- A verified local all-refs Git bundle and the original SHA map were saved under
  `/tmp/mylimits-branch-cleanup-6sxdoe_l`. Every deletion will additionally require
  ancestor verification and an expected-tip lease, preventing removal of newly
  pushed work. After CI passed, all 11 redundant remote heads were deleted in
  one atomic push with expected-tip leases, and their 11 merged local branches
  were deleted. Only `main` and `feature/desktop-independent-accounts` remain.
  Local main now follows the unchanged remote stable main; its previous history
  is preserved in Desktop. All original remote tips are ancestors of the pushed
  Desktop merge `25dfb4e`. No release was published. Next: continue work on Desktop
  when requested; provider live acceptance remains pending.

## Documentation cleanup — 23 October 2026

- User requested removal of unnecessary Markdown on both retained branches.
- Removed the completed Desktop execution plan and its obsolete starter prompt;
  the current handoff retains delivery details and outstanding live acceptance.
- Preserved unique research, provider conditions, architecture, privacy, operations,
  installation and historical test evidence. Previous plans remain in Git history.
- Updated entry points and links. No new product plan is authorized by this cleanup.

## Main integration — 23 October 2026

- User authorized merging the remaining branches. Merged Desktop into main with
  both parent histories retained. Four documentation conflicts were resolved
  using current Desktop documentation while retaining stable V2 shared contracts.
- Preserved the documentation cleanup on both branches; removed plans were not
  restored. Updated current entry point and source installation to main.
- This promotes experimental code, not live-provider verification. OpenAI and
  Claude real two-account acceptance remains pending; no release is published.
- Validation: local Markdown links and staged whitespace passed. The initial
  sandboxed check stopped at child-process fixture execution; rerunning with
  permitted subprocess access passed `npm run check` (types, 109 core tests,
  native/connection/runtime suites and Chrome production build). Application
  source matches the previously CI-verified Desktop tip; only docs differ.
- Main is the retained integration branch. The merged feature head is removed
  using its expected tip after verifying it is an ancestor of pushed main.

- Updated installer/help/sync documentation links and Desktop build lookup to main
  so removing merged branch names does not break in-app setup/help destinations.

## Documentation consolidation — 23 October 2026

- Preserved the newly added MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md unchanged.
  This is a proposal, not implemented behavior; it targets an older main snapshot.
- Removed the obsolete 3.0/3.2 companion setup page, outdated Phase 2 support
  page and unsent hosted provider-access drafts. Current installation stays in
  INSTALL.md; manual acceptance checks were retained in PROVIDER-CAPABILITIES.md.
- Archived provider drafts remain linked from implementation history by immutable
  commit. Unique research, operational instructions, privacy, assets, diagnostics
  and historical verification evidence remain.
- Updated README/START-HERE and affected documentation links. Documentation-only
  change; no provider or authentication implementation was changed.

## Persistent accounts execution — 23 October 2026

- User authorized starting the retained R2 plan. Main baseline is f755671,
  version 3.4, including the merged Desktop service; it is not the plan's old
  77f9537/2.2 snapshot. Existing Desktop code stays intact.
- Bootstrap on feat/persistent-accounts; individual code groups use codex/c<N>
  and review against the integration branch. Main stays untouched. This keeps
  setup off main rather than publishing or merging it as part of this task.
- Root AGENTS.md follows plan §11.4, with its plan path corrected to the actual
  existing filename. The original user plan is unchanged; no duplicate copy.
- Current historical handoff is DESKTOP-ACCOUNTS-HANDOFF.md; old compact/phase
  handoffs and the deleted Desktop feature branch are historical references.
- C0: repository instructions and baseline routing recorded. C1: next, request
  diagnostics only. No scheduler, login, permissions, cookie collection, vault or
  provider-quota behavior changes are part of C1. Cookie state stays unknown
  without optional cookies access (C3); do not guess cookie names or values.
- G0/G1, browser isolation, logout survival and actual multi-account freshness
  remain unverified. No simulated test may satisfy those live gates.

### C1 — redacted request diagnostics

- Implemented on codex/c1 from feat/persistent-accounts. Only C1 application
  work is included. Setup is committed on the integration branch; main was not
  merged or changed. Original R2 plan content remains byte-for-byte unchanged.
- Changed: src/platform/diagnostics.ts (+ unit tests and run-tests registration),
  provider adapters, controller/messages, SupportSettings, and browser fixtures.
  Both background requests and injected page requests emit strictly allowlisted
  metadata, including original HTTP status even when JSON parsing fails.
- Last 200 entries use storage.session, serialized across concurrent requests.
  Missing/failed session storage uses bounded memory only. Persisted entries are
  sanitized again on read. No diagnostics are written to account state, local
  storage, exports or sync. Dashboard-only command returns sanitized entries.
- Endpoint queries and organization IDs are removed; arbitrary paths, MIME/header
  values, cookie names, response bodies, tokens and free-form errors are excluded.
  Cookie names/state remain empty/unknown in this build: C3 will introduce the
  optional cookies permission; C1 does not collect cookies or add permissions.
- Settings → Copy safe diagnostics now includes request results with existing
  safe connection counts/states. No login, scheduler, cooldown or quota rules
  were changed. No vault, private-login feature or saved-account behavior exists
  from this task.
- Actual checks: npm run typecheck passed. npm test: 115 passed, including six new
  diagnostics tests. npm run check passed (115 core, 20 native, 24 connection and
  4 transport/runtime tests, plus Chrome build). git diff --check passed.
- Browser check: CHROMIUM_PATH=/usr/bin/chromium could not load the extension;
  aborted after observing the worker-load timeout. npx playwright install chromium
  succeeded, then npm run test:browser passed 33/33 using Playwright Chromium,
  including two new no-tab rejection/page-fallback/clipboard/access-boundary tests.
  All provider data was fictional; all external HTTP was blocked or fixture-routed.
- No existing test assertions were weakened or changed. Existing IDs, aliases,
  store schema and account history were preserved. No new dependencies.
- Live status: no real OpenAI/Claude traffic, private-session experiments or Windows
  acceptance. Cookie visibility, DNR scoping, incognito sharing, session rotation
  and logout survival remain UNVERIFIED. No gate is marked passed.
- Manual C1 check: build/load this branch in a test Chrome/Brave profile, refresh
  a website source, then Full dashboard → Settings → Copy safe diagnostics.
  Verify requests.entries contains statuses and path templates, with no names,
  bodies or credentials. Entries reset on browser shutdown, not account state.
- Packaging: npm run zip passed. Chrome ZIP is 308640 bytes, SHA-256
  3baddc0c9cc7dd7031ca1c8e5940b3de0d49777d2812ddb35435434d51a90ec6.
  Local documentation links passed; original R2 plan is unchanged.
- Next task group is C2 (scheduler backoff), after review/integration of C1.
  Do not begin C2 as part of this PR. Human checkpoints A/B and G0/G1 remain.

### C2 — scheduler backoff instead of parking

- User requested continuation. C1 PR #2 passed PR CI 39902753843 (all six
  jobs: Node 22/24/26, verify/browser, Windows and connected services) and was
  merged into feat/persistent-accounts as dd7eb18. Main is unchanged. C2 branch
  codex/c2 uses that integration baseline.
- Scope is T1.1 only: src/core/scheduler.ts, its existing unit tests, one browser
  regression, architecture and status. No new dependencies, schema, permissions,
  credential/session capture or provider readers.
- needs-auth now obeys a finite persisted retry deadline for scheduled/open/
  startup/idle work. A null deadline waits for a manual/tab/cookie signal. All
  reasons obey the 15-second attempt cooldown. Non-auth retry waits, disabled
  tracking, coalescing/concurrency and nextRetry's caps are unchanged.
- Added cookie/idle reason types for later tasks; no cookie or idle listeners are
  installed in C2. Login invalidation is not bypassed; every new reading still
  requires a successful authenticated provider response.
- Actual initial checks: npm run typecheck passed; npm test passed 120/120
  including five new scheduler tests. Existing assertion values were unchanged;
  one test title was renamed to describe its null-deadline authentication case.
- Added a browser fixture that seeds an overdue authentication backoff, opens only
  MyLimits, and expects automatic collection without a provider tab or manual
  refresh. All data is fictional, and all external HTTP is blocked/fixture-routed.
- Actual full checks: npm run check passed (120 core, 20 native, 24 connection,
  4 transport/runtime tests, typecheck and Chrome build). npm run test:browser
  passed 34/34 using Playwright Chromium, including the new automatic retry test.
  npm run zip, whitespace and local documentation links passed. The original
  R2 plan is unchanged. No existing assertion values were changed or weakened.
- Manual C2 check: use a test Chrome/Brave profile, sign out of the provider,
  refresh once, sign back in and close its tab. An eligible successful check
  should recover without clicking MyLimits refresh. This live check is PENDING;
  unit deadlines and fictional-browser recovery do not prove provider behavior.
- Next: push C2 and open its separate PR into feat/persistent-accounts. C3
  (response classification and cookie signals) follows review/integration. Do not
  start C3 in this task; checkpoints A/B and provider gates G0/G1 remain pending.

- C2 package: .output/mylimits-3.4.0-chrome.zip, 308639 bytes;
  SHA-256 d427af8c9ceea9ef0ff27b6740a95e3a5a1b33c5b249335b1e1f1beaccde7283.

### C3 — response classification and optional sign-in signals

- Continued sequentially on codex/c3. C2 PR #3 passed all six PR CI jobs in
  run 39903478561 and merged into feat/persistent-accounts as 21e2ff7. Main is
  unchanged. C3 will be based on that integration commit before push.
- Changed provider errors/adapters plus new response helper/tests; added injected
  session-cookies helper/tests, controller wiring, optional cookies permission,
  account-picker permission fallback, browser regressions, test registration and
  architecture/privacy/status. No schema/data migration or dependencies added.
- HTTP 200 HTML and Cloudflare 403 challenges are recognized before JSON parsing;
  plain 401/403, malformed JSON and 429 stay distinct. HTML 429 keeps throttling
  priority and its Retry-After deadline. Page and background metadata stay redacted.
- Current-account setup requests optional cookie access with site access. Decline
  leaves an explicit site-only path. Existing site grants and denied/unsupported
  cookie APIs degrade to C2's ordinary backoff, without disabling website tracking.
- Only positively identified normal stores are inspected. No hardcoded store IDs
  or list-order inference. Incognito events cannot trigger or cancel a pending
  normal sign-in; container/partition ambiguity stays unknown. Values are never
  copied/stored/logged. Diagnostics contain only recognized names/presence.
- Enabled needs-auth/needs-tab connections alone react to matching addition/
  overwrite signals, debounced two seconds. State, permission, store and current
  presence are rechecked before refresh. Permission removal stops pending work;
  rolling cookies on healthy accounts do not produce a refresh storm.
- Unresolved provider evidence: names in the plan are candidates, not live proof.
  No production provider is marked verified. Missing candidates therefore remain
  UNKNOWN; the implemented signed-out + verified-absent => null-deadline rule is
  tested with fixtures but is not enabled from an unverified name assumption.
  Spike evidence at C6/G0 must establish names and domain/path/partition
  applicability before enabling absence inference. This
  conservative decision prevents premature parked sources.
- The future spike package check must preserve C3's optional cookies permission
  in ordinary builds; only debug entrypoints/extra experimental permissions are
  spike-only. Do not blindly apply the older pre-C3 permission-exclusion wording.
- Final checks: npm run check passed (134 core, 20 native, 24 connection and
  4 transport/runtime tests, typecheck and Chrome build). Added 14 unit regressions
  and three browser regressions; existing assertion values were unchanged.
- Browser validation: first pass 37/37. After expanding service-switch coverage,
  one run had 36 pass/1 failure from an overly exact Gemini selector; corrected
  selector and targeted test passed. A later run had 35 pass/2 setup failures
  because an overlapping package rebuild removed the manifest temporarily.
  Reran after all builds completed: npm run test:browser passed 37/37 serially.
  No application assertion was weakened to accommodate either test/setup issue.
- Chrome/Edge/Firefox builds and node scripts/check-packages.mjs all passed.
  npm run zip passed: Chrome ZIP 309945 bytes, SHA-256
  a4a0366d5a1c6d0f9e356fc16a53c84ec7517b165a041c2333912d1af75ccef8.
  Whitespace and local documentation links passed; original R2 plan unchanged.
- New browser coverage uses a temporary fixture manifest with a cookie grant, a
  fictional sessionKey and fixture-routed HTTP to exercise real Chrome cookie
  events. It does not authorize a real provider or verify account/logout behavior.
  Other new browser tests cover HTML 200 and declining cookie access/site switching.
- Manual C3 check: build/load codex/c3 in a test Chrome/Brave profile. Choose
  current Claude/OpenAI account and inspect the optional cookie/site request.
  Decline cookie access and use Continue without sign-in detection to verify the
  site-only route. With cookie access, sign back in after a failed check and
  inspect Settings → Copy safe diagnostics for metadata-only recovery. No values
  or raw session responses should be shared. Real-provider/Windows acceptance
  and cookie-name verification remain PENDING.
- Next: push and open C3 PR into feat/persistent-accounts. C4 (bounded temporary
  tab recovery and normal/incognito tab safety) follows review/integration. Stop
  before C4 here; checkpoints A/B and G0/G1 remain pending.

### C4 — bounded normal-tab recovery / Checkpoint A

- User requested continuation through the next major boundary. C3 PR #4 passed
  all six CI jobs in run 39905736565 and merged into feat/persistent-accounts
  as 613f01a. Main remains f755671; no main merge/release is authorized here.
- New injected bootstrap-tab helper owns a single inactive normal tab for the
  entire account/usage/identity transaction. Existing normal tabs are tried first;
  private, container, unknown and owned contexts are excluded from ambient reads
  and tab-trigger refreshes. Provider selection also focuses only normal tabs.
- Recovery is limited to eligible network/403/challenge failures. Plain 401/429,
  provider waits, offline/cancelled reads and invalid data do not create tabs.
  The load wait is 20 seconds plus a three-second settle. Cleanup closes only
  recorded owned tab/window pairs; user activation aborts and leaves the tab open.
  Worker startup cleans leftover ownership. Failed/corrupt storage fails closed.
- Attempts persist outside Store: at least 30 minutes apart and at most eight
  per provider per UTC day, including creation failures. Ownership is session-only.
  No new dependency, provider credential store or independent login is introduced.
- Added additive autoRecoverTab default true, Settings control, live recovery
  wording and idle-active refresh that obeys scheduled waits. Preference sync
  deliberately excludes autoRecoverTab and preserves the local browser choice.
  normalizeHeaders is absent pending G0. Store.version remains 2; migration
  preserves IDs, aliases, timestamps and history.
- Changed: core browser-tabs/model/schema/migrations/sync/presentation; platform
  bootstrap-tab/controller; provider adapters/errors; AccountConnect/App/Popup;
  manifest/test registration; browser tests; architecture/privacy/install/start/
  index/status docs. Original R2 plan is unchanged.
- Initial npm run typecheck + npm test passed 147/147. A new browser-test storage
  assertion needed an explicit TypeScript cast; fixed before browser execution.
  Two npm run check attempts under restricted execution failed the same existing
  fictional RPC subprocess case (premature EOF). Targeted elevated execution
  passed; full npm run check with subprocess permissions then passed (147 core,
  20 native, 24 connection, 4 transport/runtime tests, typecheck and Chrome build).
- First full browser run: 38 passed, 2 failed. The new temporary-page inline
  fixture failed to install its fetch stub; replaced with an origin-scoped init
  script. A no-result script execution exposed generic-error classification;
  changed to needs-tab so failed browser recovery retains the actionable state.
  Existing assertion values remain unchanged. Targeted/full reruns and final
  package results follow below when completed.
- Live status: all providers/cookies/private flags in new tests are fictional.
  Actual Chrome/Brave private windows, challenges, overnight recovery and the
  3–4 day trial remain PENDING. G0/G1 and independent-account acceptance are not
  passed by these tests. Next: finish validation and C4 PR, then stop for review.
- Final local verification: targeted browser rerun 2/2 passed, followed by
  npm run check (147 core + 20 native + 24 connection + 4 transport/runtime,
  typecheck and Chrome build) and full npm run test:browser **40/40 passed**.
  Server typecheck, Edge/Firefox builds and package contract checks passed.
  All builds ran sequentially, after browser testing completed.
- Added 11 tab-recovery/selection/error unit tests, one migration and one sync
  regression, plus three browser cases. Browser cases verify one temporary tab
  can read all four Claude fixture endpoints, preserve the old ID/alias, close
  only itself, ignore private-tagged metadata and avoid a tab on plain 401.
  The existing HTML-200 assertion retains needs-tab and its no-fabricated-quota
  requirement; only its failure diagnostic message was added.
- npm run zip passed: .output/mylimits-3.4.0-chrome.zip, **312265 bytes**,
  SHA-256 **3fa33fec9774c2980fa47b856d981805e3732f073074ef5976dbe138809c125d**.
  git diff --check and 56 relative documentation links passed. Original plan
  unchanged. Installation and manual clicks are in INSTALL.md's Checkpoint A
  section; architecture and privacy disclose temporary-page traffic and local
  counters/setting. No new Desktop installer is needed for this website checkpoint.
- Delivery boundary: C4 source/package is ready for review, not live acceptance.
  Push only codex/c4 and open its PR into feat/persistent-accounts; leave main
  unchanged. Stop before C5. Human review/integration and the 3–4 day trial are
  next; private-session evidence gates, independent browser accounts and logout
  survival remain unimplemented/unverified here.
