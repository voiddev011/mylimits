# Current implementation status — Desktop + extension

Updated 23 October 2026. Working branch: `main`. Desktop was implemented on
`feature/desktop-independent-accounts`, created from clean
`docs/desktop-accounts-execution-plan` (`3f218f6` locally).

## Current decision

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

On a Windows laptop, install the delivered matching extension/Desktop artifacts
and run the real-account matrix in DESKTOP-ACCOUNTS-HANDOFF.md for both providers.
Automated code/package delivery is recorded below. Both providers remain
experimental; the requested feature is not fully accepted or release-ready.

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
