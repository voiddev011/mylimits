## U2 · GitHub Copilot (24 October 2026)

Branch `codex/u2-copilot` from main. Implemented official REST identity/usage,
separate encrypted token vault, token setup/replacement, allowance settings,
per-connection refresh, 15-minute minimum and disconnect/forget token deletion.
Existing main features remain; U1/U4 are separate PRs.

Changed files: core model/schema/migration/public/scheduler/presentation/meter display;
Copilot parser, REST adapter, token vault, account lifecycle, controller/messages;
Copilot setup/settings and provider assets/catalog; API optional permission; tests,
package assertions and Copilot setup/security documentation.

Actual checks: `npm run check` PASS (263 core/platform tests; 20 companion,
24 connections and 4 transport/runtime tests; Chrome build). `npm run test:browser` PASS (57 Chromium tests, including the simulated two-token
Copilot UI lifecycle). Legacy V1 fixtures exclude the new Copilot default, just as
they already excluded Cursor. No production migration assertion is weakened.

Decisions: documented `grossQuantity`, not net discounted quantities; no documented
API allowance field, so require explicit user allowance. No live account access:
real-token, plan eligibility and included-request comparison checks PENDING.
Final validation: `npm run check` PASS again (263 + 20 + 24 + 4 tests and build),
`npm run test:browser` PASS again (57 tests, including light/dark Copilot logo).
`npm run zip`, `npm run build:edge`, `npm run build:firefox`, and
`node scripts/check-packages.mjs` PASS. Chrome ZIP:
`.output/mylimits-3.4.0-chrome.zip`, SHA-256
`8ea98ad46ae94d6b0d9e37c339c327638dd2f56b7599ba873f88f7ec4cffb151`.

Known boundary: trusted-context local-storage protection is required; unsupported
browser APIs fail closed. Chrome browser flows are simulated; Firefox token setup
and real GitHub accounts are not verified. No API allowance field is assumed.
Delivered: [PR #24](https://github.com/voiddev011/mylimits/pull/24) into main.
Next: user-run real-token acceptance in COPILOT.md. Not merged or published.

# Current implementation status — Desktop + extension

Updated 23 October 2026. Latest coded task: C12 expiry watchdog and final persistence
documentation on `codex/c12`. C1–C7, C9–C11 and the minimal UI polish are merged into main;
C7's G0 evidence assessment remains HOLD. Desktop was implemented on
`feature/desktop-independent-accounts`, created from clean
`docs/desktop-accounts-execution-plan` (`3f218f6` locally).

## Current decision

The latest user instruction explicitly defers the intermediate tests/decisions
and permits continuing disabled coding. This changes the execution order for disabled code,
not the truth of the missing evidence or provider activation. All vault providers
remain off and their cookie allowlists empty; no G0/G1 PASS is inferred.
Validated checkpoints may merge into main; merged task branches are pruned.
Each finished checkpoint will include file-level added/deleted line counts.

The active persistent-accounts plan is
[the unchanged R2 proposal](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md).
The user authorized completing tasks in order and merging validated checkpoints.
C7's report cannot approve G0 because human live experiments E1–E8 are absent.
The user now permits continuing coding before those gates; actual provider
activation still needs evidence and G0/G1 decisions. C8 remains deferred. The Checkpoint A
3–4 day live trial remains PENDING; authorized main merges do not prove the trial.
No saved-session vault or browser-only independent login exists from C1–C6.
Historical Desktop acceptance remains pending.

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

C12's coding and automated checks are complete behind off provider policies;
the PR handoff records CI, packaging and the authorized integration/main merge.
C11 and the minimal UI checkpoint merged through PRs #15–#18. C13 is optional
and not started. Before activating
providers, run the live experiments, record sanitized results and obtain G0/G1.
The [manual trial](INSTALL.md#persistent-accounts-checkpoint-a-c1c4) is pending;
keep all private-session/vault implementation gated by G0/G1. For the separate Desktop path, real-account
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
  Source checkpoint 81101e2 is pushed on codex/c4 in
  [PR #5](https://github.com/voiddev011/mylimits/pull/5), targeting
  feat/persistent-accounts. Rebasing onto C3's integration merge preserved the
  tested source tree exactly. Remote CI is pending; local results are above.
  Main is unchanged. Stop before C5. Human review/integration and the 3–4 day trial are
  next; private-session evidence gates, independent browser accounts and logout
  survival remain unimplemented/unverified here.

### C5 — connection-scoped collection, host serialization and source labels

- User's “alright, continue” authorizes the next code checkpoint after C4 review.
  This does not establish the plan's human live trial or a main merge; both remain
  pending. C4 PR #5 merged into feat/persistent-accounts as e8c9255 after both
  latest-head CI runs completed green. One push-run hosted transport test first
  observed active after disconnect; the identical PR run passed. The isolated
  failed job reran with unchanged source/assertions and passed. This timing
  failure is recorded, not presented as proven provider behavior or silently
  dismissed. No hosted production provider driver exists.
- T2.1/T2.2: added strict website/vault ID helpers without rewriting old IDs.
  markConnection mutates only the requested source, mirrors provider state only
  for website sources and projects accounts from their bound source snapshots.
  markProvider remains a compatible website wrapper.
- T2.3/T2.4: extracted the actual source-bound collection path behind injected
  storage/permission/reader/history ports. Refresh commands and workspace changes
  route by connection ID; provider/all commands iterate enabled sources with the
  shared two-job coordinator. Cookie/tab/current-browser setup signals target
  only the website connection, not other accounts of that provider. Per-host FIFO
  locks wrap each Chrome background/page/temporary request and hold until I/O
  settles; queued cancellations never run. Reader transport is pluggable while
  retaining C4's whole-transaction recovery behavior.
- A vault metadata record has no production transport yet. Its refresh explicitly
  reports unavailable and preserves its dated reading; it never falls back to the
  current browser login. Saved sources reject wrong-account identity. No cookies,
  credentials, private windows, DNR rules or authentication are added by C5.
- T2.5/T2.6/T2.7: setup method defaults to ambient and private metadata binds to
  a validated slot. Added vault kind with Store.version still 2. Public state
  excludes profileId; migration tests preserve existing accounts/snapshots/aliases.
  Added Browser login / Saved sign-in / Companion source badges. Native metadata
  retains an unknown lastAttemptAt instead of inventing an attempt on status read.
- Changed: core connection-id/engine/model/schema/account-setup/companion/
  presentation; new injected connection-refresh and host-lock modules/tests;
  controller/adapters; UI source badges; migrations/setup tests, test registration
  and browser regression; status/start/architecture/install docs. No dependencies.
- First fast check passed 148 tests. Lock integration introduced a TypeScript
  narrowing error for tab.id inside a closure; captured the validated numeric ID.
  Expanded fast check passed 157/157. Initial full check/browser run and final
  packaging results are recorded below when completed.
- New core acceptance tests refresh two fictional same-provider connections
  concurrently with different quota values and aliases, then verify failed A,
  wrong identity, late disconnect, coalescing and persisted waits do not damage B.
  New Chromium test verifies an unavailable saved source makes zero ambient HTTP
  reads, retains its alias/timestamp and does not affect the website connection.
- Live status: simulated sources only. Independent login, provider quota access,
  normal/private isolation, logout survival and renewal are NOT verified/delivered
  by this refactor. Stop after C5 review delivery; do not start C6 in this task.
- Final checks: npm run check passed **159 core, 20 native, 24 connection and
  4 transport/runtime tests**, TypeScript and Chrome build. Full Chromium suite
  passed **42/42**. The earlier 157/41 full run also passed; final review scoped
  cookie/tab/setup signals to website only and kept discovery concurrent, then
  reran the full checks. No existing assertion values were changed or weakened.
- Added 12 unit regressions in total: IDs (1), host locking/cancellation (2),
  actual injected connection collection/isolation (5), additive migration (1),
  setup-slot selection (1), source labels (1), native unknown timestamps (1).
  Added two Chromium cases: no ambient borrowing by a reserved saved source,
  plus eligible website collection while an optional helper deliberately stalls.
- Server typecheck, Edge/Firefox builds and all three package contract checks
  passed. All builds ran sequentially after browser testing. No new Windows
  installer is needed for this extension/source-contract refactor.
- npm run zip passed: .output/mylimits-3.4.0-chrome.zip, **314271 bytes**;
  SHA-256 **802cbe9f92cf8de3a68fbd6f578640b892aca4469c07fcd70fa99bd8c991484e**.
  Whitespace and 56 relative documentation links passed. Original R2 plan unchanged.
  C5 installation/manual review is in INSTALL.md, source contracts in ARCHITECTURE.md.
- Delivery: source checkpoint 2ea79cd is pushed on codex/c5 in
  [PR #6](https://github.com/voiddev011/mylimits/pull/6), targeting
  feat/persistent-accounts. Rebasing onto the C4 integration commit preserved the
  tested source tree exactly. GitHub CI results remain pending; local results are
  above. Stop at Checkpoint B. No main merge, C6 spike, G0/G1 approval, production
  saved-account login or live provider result is claimed.

### C6 — isolated evidence spike (T0.2 only)

- Read AGENTS and the entire unchanged R2 plan; corrected the prompt's repeated
  docs/.md path to the actual existing file. Started from a clean worktree.
  C5's complete push CI run 39918937787 passed all six jobs. Its duplicate PR
  run was still installing Chromium when inspected; no failure was hidden.
  Integrated C5 PR #6 only into feat/persistent-accounts as 9234c86, then created
  codex/c6 from that latest baseline. Main remains f755671. No agents were spawned.
- Added a flag-only entrypoint/runtime, isolated .output-spike output and clear
  diagnostic manifest/options/toolbar naming. Without the flag, the entrypoint,
  dynamic runtime and required cookies/DNR/webRequest grants are excluded.
  Normal C3 optional cookies remain, following the previously recorded baseline
  adaptation. Package directory/ZIP guards enforce both boundaries.
- A–F are implemented: names/flags across stores; explicit in-memory consent
  capture; three reader transports; decoded exp and Bearer checks; name-only
  response observation; owned private-window dry run; and F status-only usage
  with credentials omitted and no DNR rule. No prompts/model generations.
  Diagnostics do not print bodies, account IDs, headers, tokens or cookie values.
- Spike mode deliberately does not start automatic production collection, so
  ordinary account storage/aliases/history are untouched and no background jobs
  compete with an experiment. Existing normal entrypoints remain buildable;
  toolbar/options open the evidence page. Spike support is Chromium-only.
- Temporary rules require exact host, tabIds [-1] and initiatorDomains [runtime.id].
  Each request uses C5's host lock and finally cleanup; stale spike rules are
  cleared on startup. Unsupported scoping is never relaxed. Feedback unavailable
  remains unverified even when a request succeeds. Cleanup failure blocks probes.
- Only the exact normal same-extension spike page can own a diagnostic port.
  Inputs are strict; website/private/extra-field/credential-bearing commands are
  rejected. Closure cancels work, waits for cleanup, drops capture/token memory,
  removes observation listeners and closes only its owned private window.
  Captures are never written to Store, local storage, IndexedDB, logs or sync.
- Retry-After/429 and per-provider 15s test waits persist in session metadata.
  Memory retains waits if persistence fails; failed/corrupt storage blocks further
  traffic. Capture enforces expiry/path/domain/partition and 16KB limits. D stops
  after 60s; existing private windows prevent automatic creation of another.
- Initial typecheck found closure narrowing and WebRequest callback typing;
  fixed with explicit never/undefined signatures and root-relative URL construction.
  An early spike-only entrypoint filter regenerated incomplete WXT types; retained
  normal entrypoints in the diagnostic build and restore normal generated types
  in build/test scripts. Node strip-only tests required an explicit error property
  instead of a TypeScript parameter property. No test assertions were weakened.
- First fast checks passed 171 then 172 unit tests as coverage expanded. Separate
  spike Chromium suite passed 3/3, using a temporary fixture site grant, simulated
  provider responses and no external provider HTTP. The normal full suite passed
  42/42. Final safety review added cancellation/disposal, failed persistence and
  malformed-message coverage; final full/package results follow below.
- Changed: wxt/env/background flagging; new core spike contracts/tests, injected
  platform spike/runtime/tests, A–F page/styles, build/test scripts and release
  directory/archive guards; test registration/CI; status/start/index/install/
  architecture/privacy and the new live evidence ledger. No dependencies or
  writable account-schema changes; original plan untouched.
- Added SESSION-PERSISTENCE-EVIDENCE.md with E1–E8 and scenario rows all PENDING.
  It is a blank live ledger, not a C7/G0 report. Installation gives exact clicks,
  empty-jar testing, memory/lifetime limits and the distinction between success
  and rule-match feedback. No real provider, logout, rotation, private browser
  or independent-account result has been established. Stop before C7.
- Final lifecycle review added late capture/window regressions. The first late
  capture test failed (176 pass / 1 fail): Clear waited for initialization before
  cancelling, allowing a late credential assignment. Cancellation now happens
  before that await and after every capture callback; the regression passes.
  Late-created owned windows are closed, and Clear can retry failed rule cleanup.
  No existing assertions were changed or weakened.
- Toolbar popups close when a private sign-in window receives focus. The spike
  toolbar action now promotes to a persistent extension tab before opening a
  diagnostic port. A separate Chromium fixture covers this bootstrap; the normal
  compact popup is unchanged. This is not proof of a real private login.
- Final frozen-source validation passed: npm run check (**178 core, 20 native,
  24 connection, 4 transport/runtime tests**, TypeScript, Chrome build), followed
  by npm run test:browser (**42/42**) and npm run test:spike (**4/4**).
  The spike tests use fictional responses, fake worker HTTP and a temporary
  fixture host grant; actual provider HTTP and real DNR header effects were not
  tested. Real DNR API installation/removal is exercised in Chromium.
- Server typecheck, Edge/Firefox builds, scripts/check-packages.mjs,
  npm run zip, npm run zip:firefox, scripts/package-checksums.mjs and
  scripts/check-archives.py passed. npm run zip:spike passed separately and
  restored normal WXT generated types. Release archives contain no spike files,
  runtime marker or diagnostic required grants. No new dependencies, account
  schema migration or Windows installer is needed for C6.
- Local artifacts (ZIP timestamps mean CI checksums can differ):
  - .output-spike/mylimits-3.4.0-chrome-spike.zip: **315762 bytes**, SHA-256
    `417d23bb7778a0d1614989f44e14548de05a419ebff4d84447918cd9f9409bdc`.
  - .output/mylimits-3.4.0-chrome.zip: **314271 bytes**, SHA-256
    `96d8e0597ec4e16ef191adf3470153bed9b3e382202410f4bf6b7e5112b3f42e`.
  - .output/mylimits-3.4.0-firefox.zip: **312216 bytes**, SHA-256
    `fc4c3ddb40cbdd7df0479079c9fba5e15b0a22d7ede516133881d4cf4dc8683c`.
- Both C5 GitHub workflows have now completed all six checks successfully.
  Whitespace and 62 relative documentation links passed; the unchanged original
  proposal's archived links are excluded from that link check. The separate
  spike ZIP also passed manifest/archive hygiene inspection.
  C6 source checkpoint a60bb25 is pushed on codex/c6 in
  [PR #7](https://github.com/voiddev011/mylimits/pull/7), targeting
  feat/persistent-accounts with the full §11.3 handoff as its description.
  Both C6 verify and connected-services runs passed, as did the Node matrices.
  One Windows run passed and its duplicate exposed a shutdown metadata race;
  the correction and actual rerun results are recorded below. Human E1–E8,
  Checkpoint A's trial and real account/logout/rotation/isolation remain PENDING.
  Next action: review C6, collect evidence using INSTALL.md, then stop for the
  separately authorized C7/G0 task. No gate decision or next group was executed.

### C6 review correction — Windows shutdown race

- User authorized safe main integration and branch reduction before continuing.
  The worktree was clean; no unique user edits were overwritten. C6 PR #7 remains
  the active review branch while fixing its failing Windows CI job.
- The failing job read a null StartTime/CreationDate after process enumeration
  and called ToUniversalTime on it. Added Test-DesktopSameProcess, which refuses
  termination on missing, unreadable or mismatched timing metadata. The existing
  bounded exit wait still preserves recovery/account files if a process remains.
- Changed companion/windows/desktop-runtime.ps1 and scripts/test-windows-setup.ps1.
  Added deterministic timing/exit-race checks alongside the actual Windows
  owned-child shutdown and unrelated-child survival checks. No assertions weakened.
- PowerShell/Windows execution is unavailable locally; the actual Windows job
  validates this path in run 39929586829 (all six jobs passed, including Windows
  setup/installer). Local npm run check passed 178/20/24/4 tests and Chrome build;
  npm run test:browser passed 42/42; npm run test:spike passed 4/4. No live provider
  traffic or real account acceptance was performed.
- Merged PR #7 as 8916220 into feat/persistent-accounts, then PR #8 as 2c2be4f
  into main under the user's explicit authorization. The main integration tree
  exactly matches the validated C6 tree. No conflict or user edit was discarded.
- Reduced remote/local task branches by six: codex/c1–codex/c5 were already
  ancestors of the integration branch; codex/c6 was removed only after confirming
  its tip is an ancestor of main. Retained main and feat/persistent-accounts.
- Main integration: 72 files, +3344 / -185 lines. The PR #8 description contains
  every filename with its exact added/deleted counts. The Windows correction alone:
  companion/windows/desktop-runtime.ps1 +10/-1; scripts/test-windows-setup.ps1
  +12/-0; docs/IMPLEMENTATION-STATUS.md +26/-1 (commit 3af2cf4).

### C7 — G0 report, evidence HOLD

- Started codex/c7 from the latest integration branch after merging validated C6
  into main. Created G0-GATE-REPORT.md using §7.3; E1–E8 remain PENDING and no
  G0/G1 decision is approved. C8 needs E2 benefit; C9 needs G0/G1 plus E3/E4 and
  an evidence-derived allowlist. E6 may move T4.2 into C9; E7 controls T3.5's route.
- Updated START-HERE, INSTALL and the evidence preface. Installation now uses main
  because the merged codex/c6 branch was deleted. No provider code, credentials,
  schemas, dependencies, permissions or live evidence values were changed.
- C7 checks passed: 68 relative documentation links, whitespace and unchanged
  original plan; npm run check (178 core, 20 native, 24 connection, 4
  transport/runtime tests, TypeScript and Chrome build); npm run test:browser
  42/42. No test assertion was changed. No new live provider result was obtained.
- Both C6 workflows now passed all six jobs. Main integration PR #8 also passed
  actual Windows checks; the already-validated integration source tree is unchanged.
  C7 adds only the gate report and current documentation; per-file line counts
  are supplied in its §11.3 PR handoff. Merge this documentation checkpoint under
  the user's existing authorization, then remove its merged task branch.
- The user asked whether testing can wait. Explained the difference between
  routine/final acceptance tests and E2/E3/E4 feasibility evidence that determines
  the implementation. No instruction waiving the real-evidence gates was given.
  Next required input: sanitized real-account results; update G0, then obtain G1.
  Do not start C8/C9 from unverified assumptions. This historical restriction is
  amended for disabled C9 coding only by the latest instruction below.

### C9 — coding authorized before live gates, activation still off

- Latest user instruction permits holding intermediate tests/decisions and
  starting C9. This overrides the prior stop for coding only. C8, E1–E8, G0/G1
  remain deferred/unverified; all provider policies are off and allowlists empty.
  Created codex/c9 from the latest integration branch with a clean worktree.
- T3.0: added immutable policy/allowlist tables. No provider names, challenge
  cookies or captured credentials are guessed into an allowlist. No UI route is
  exposed; C10/C11 private sign-in and refresh/management remain unimplemented.
- T3.1: strict bounded payload/envelope validation; AES-GCM-256 with slot/provider
  AAD and random 96-bit nonce; non-extractable CryptoKey in injected IndexedDB;
  separate mylimits:vault:v1 storage with required TRUSTED_CONTEXTS protection.
  Metadata projections exclude ciphertext/nonces/values; key loss fails closed
  without regenerating over entries; explicit deletion works without decryption.
  The injected cross-writer lock must be shared (Web Locks in future wiring).
- T3.2: fixed reader endpoints, scoped per-provider DNR rule IDs, omitted ambient
  credentials, shared host locking and finally cleanup. Failed removal poisons
  the host so queued ambient work cannot borrow its cookies. Startup cleanup is
  wired into the ordinary controller's HTTP readiness barrier; Firefox bypasses
  this Chromium-only cleanup. No manifest permission added or provider activated.
  The transport consumes that same one-time readiness barrier; it never repeats
  startup cleanup during another active account request.
- Reused the existing reader endpoint allowlist by moving it into a neutral pure
  module; C6 keeps its original re-export/API. No account Store/schema change,
  dependency, model prompt or real provider traffic. Optional E7 token storage
  and conditional E6 rotation are deliberately not inferred from missing results.
- Initial typecheck found a typed empty-allowlist construction; fixed with an
  explicit frozen provider record. Fast suite reached 197 passing tests. Actual
  Chromium tests passed 3/3 for non-extractable key persistence, concurrent atomic
  creation and corrupt-key rejection. The first browser fixture run failed because
  Vite returns an array for library output; fixed fixture result handling and
  reran unchanged security expectations. No existing assertion was weakened.
- Additional missing/expired credential, partial rule installation, key/write
  failure and parallel-provider regressions added. Final full/browser/package
  results and file-level line counts follow after validation. G0/G1 remain HOLD.
- The full extension-storage fixture exposed a CSP-dependent Zod JIT compile
  error after an asynchronous lock callback. Vault payload/envelope validation
  now explicitly uses jitless parsing; the unchanged security assertion passes.
  Web Locks callback typing was corrected as well. Temporary exception debugging
  printed only class/location, never credential values; it has been removed.
- Four actual Chromium fixtures now pass: key persistence/non-extractability,
  concurrent atomic creation, corrupt-key rejection, and encrypted storage across
  reload plus exclusion from actual public-state/history-export responses. They
  inject only fictional credentials into test-only ports; production stays off.
- Final transport review closed a Retry-After gap: successful responses now
  persist supplied waits too, and 429 without a valid wait uses a 60s fallback.
  The new regression passes. Source then stayed frozen for the final full run.
- Final local validation passed: npm run check (**203 core, 20 native, 24
  connection, 4 transport/runtime**, TypeScript, Chrome build), followed by
  npm run test:browser (**46/46**) and npm run test:spike (**4/4**).
  Added 25 unit regressions (3 contract/policy, 8 vault, 12 transport, 2 host-lock)
  plus four actual Chromium storage/key fixtures. No existing assertion changed.
- Server typecheck, Edge/Firefox builds, all package-directory contracts, both
  release ZIP inspections, checksum generation and separate spike packaging
  passed. Both normal release ZIPs exclude spike code, diagnostic required grants
  and the in-memory browser-test helper/fictional credential marker. 68 relative
  documentation links and whitespace checks passed; the original R2 plan is unchanged.
- Local ZIPs (CI timestamps can change hashes):
  - Chrome **314736 bytes**, SHA-256
    `fb5639402ee7acf9f0f672f944b531e1f34616afb472d43521f274869ac2c017`.
  - Firefox **312533 bytes**, SHA-256
    `b1d33b8c2a94e5b62ef7890c23bfa404c281e092a9827432705563362b8b42b6`.
  - Separate spike **315961 bytes**, SHA-256
    `12320e44f0afe184b48cb116e6c7211835bd0708183bee34d519f8cfd07718b5`.
- C9 code is ready for PR/CI review and the user-authorized main merge; exact
  added/deleted file counts are in its §11.3 handoff. Only the dormant foundation
  is implemented. Production provider activation, live request/header effects,
  actual private login, identity proof, logout survival and other-device refresh
  remain UNVERIFIED. No G0/G1 or inferred E6/E7 decision was made.

### C10 — private sign-in and saved-source refresh (in progress)

- Baseline: C9 PR #11 merged into the integration branch; PR #12 merged into
  main (`9b1c6a3`). Both six-job workflows passed. Created `codex/c10` from
  the latest integration branch. No user edits were present at inspection.
- Implementing T3.3/T3.4/T3.5 only. All production policies remain off,
  allowlists empty, and the normal manifest has no new required grants. C8,
  G0/G1, E1–E8 and the live trial are still deferred/PENDING.
- Added injected private/current-store capture, metadata-only restart journal,
  ten-minute timeout, strict dashboard-only commands, consent before encryption,
  identity confirmation, pending-source isolation and cleanup. Normal browser
  credentials are never substituted for a saved source. C11's UI is not included.
- Wired the C9 vault/transport into source-bound refresh with persistent provider
  waits and three-consecutive-401 parking. Challenge errors never use the
  ambient tab ladder. No E7 Bearer cache or E6 rotation is inferred.
- Initial typecheck found an inferred empty-record index type in persisted waits;
  corrected the return type. First registered unit run passed 214/215: the new
  disabled-policy fixture expected null instead of the old optional undefined
  setup; corrected that fixture. Existing expectations were not weakened.
- Changed areas: core setup/schema/connections/scheduler; new private-sign-in
  contracts and platform flow; saved-session runtime; controller/messages/shared
  lock wiring; focused unit/browser fixtures and this status/start documentation.
  Final commands, results, file counts and next action follow after validation.
- Focused regression suite now passes 227/227: 17 injected sign-in cases,
  three strict-command/sender/journal cases, migration preservation, vault retry
  scheduling and two consecutive-401 collector cases. Tests cover cancellation
  both before encryption finishes and after the accepted Store write begins.
- First full check passed (224 then-current core tests, 20 native, 24 connection,
  four transport/runtime, TypeScript and Chrome build). The first full browser
  run passed 47/48; the new composed sign-in fixture found CSP-sensitive snapshot
  validation. Explicit jitless parsing fixed that path. Its next run exposed a
  real persisted-cooldown schema bug: z.record(enum, ...) demanded all providers.
  Changed it to z.partialRecord; all six focused Chromium vault fixtures now pass.
- The browser fixture uses actual encryption, IndexedDB, local/session storage,
  Web Locks, private-sign-in runtime and quota reader, with injected fictional
  window/cookie/DNR/HTTP APIs. It connects B/C without reading normal A, confirms
  aliases and distinct identities, reloads the runtime, refreshes from both slots,
  rejects a duplicate, and verifies HTTP401/challenge classification. This is
  simulated provider evidence, not proof of live DNR or provider/login behavior.
- Temporary debugging emitted only error class/code and stack locations; it was
  removed. No credential value or raw provider error was logged. Actual HTTP401
  rejections now have a saved-source-only code, so missing identity fields cannot
  be miscounted as three real HTTP401s. Existing website error codes are unchanged.
- Full validation before final lifecycle review: npm run check passed (**226 core, 20 native,
  24 connection, four transport/runtime** tests, TypeScript and Chrome build),
  followed by npm run test:browser **48/48**. npm run test:spike **4/4**, server
  typecheck, Edge/Firefox builds and three package-directory checks passed.
  No existing assertion was weakened. New fixtures exercise fictional providers;
  all E1–E8/live browser/logout/other-device checks remain PENDING.
- Built both normal ZIPs plus the separate spike. Actual archive inspection and
  checksum generation passed; normal ZIPs exclude spike code/grants, private-flow
  browser helpers, fictional credential markers and temporary debugging. Checked
  68 relative documentation links, whitespace and the unchanged original R2 plan.
  No new dependencies or production permissions, version bump or release.
- Local artifacts (CI timestamps may change hashes): Chrome **322422 bytes**,
  SHA-256 `e1fd9577819c548591584eb7ef6d8ca6560970f6b0b814a5407b21c248523591`;
  Firefox **320283 bytes**, SHA-256
  `81fb1a3dec7e3e5cfa290a525f6ca93eb00e74080fc57c00efb98e63788a2d39`.
- C10 is implemented and locally validated as dormant code. Publication/CI and
  the authorized main merge follow this checkpoint; the PR handoff supplies the
  per-file +/− counts. The next group is C11, not activation. No new second-account
  user setup is exposed yet, and no real provider/logout behavior is claimed.
- Final lifecycle review added a serialized guard against website setup replacing
  a pending private flow. It also closed browser-exit recovery: when session storage
  loses the journal, remove orphaned unconfirmed metadata/slot without closing
  unowned windows. Retain already accepted accounts, aliases, history and slots,
  even if that source was later disabled. The new restart regression passes.
  Final corrected-source checks pass: 227 core, 20 native, 24 connection and four
  transport/runtime tests; Chrome build and the complete 48-test browser suite.
  Edge/Firefox builds, directory/ZIP guards and refreshed packaging pass too.
- Saved-sign-in error codes now cross the runtime message boundary as a bounded
  VaultError code; the UI command helper retains it. C11 can distinguish incognito
  access denial, policy off, consent and recovery errors without parsing sentences.
  Website errors retain their existing messages and shape. The production-disabled
  Chromium fixture checks the structured disabled response as well.

### C11 — gated setup, conversion, deletion and leak tests

- C10 merged through PRs #13/#14 into main (`ab6ee29`); source checkpoint
  `cd3d164` passed all six CI jobs. Created `codex/c11` from the latest integration
  branch after a clean worktree and remote inspection. No user edits were present.
- Scope is T3.6/T3.7/T3.8 and R2 source conversion only. Providers remain off,
  allowlists empty; no guessed cookies or inferred live/logout behavior. C12 is
  separate. Website tracking and the optional Desktop route remain available.
- Inspected the controller, private flow, schema/public projections, React setup,
  exports, sync and diagnostics. Reuse C10's runtime; add safe public expiry/method
  metadata, explicit consent/identity UI, same-identity source conversion and
  fenced credential deletion. Actual commands/results and blockers follow here.
- Implemented additive source method/expiry metadata (schema version still 2),
  consent/nickname/identity flow, private-access guidance and explicit weaker
  current-login choice. Private choices stay hidden for off providers. Grants
  remain unchanged in actual manifests; optional DNR is conditional on future
  evidence-approved provider policy, and current release guards stay strict.
- Same verified identity converts its website source with a generation fence,
  preserving account ID/alias/history. Disconnect/forget fence refresh first,
  erase encrypted slots, then remove source metadata; deletion failure retains
  a disabled retryable source instead of claiming successful removal.
- npm run typecheck and npm test pass: **243/243**. Added 16 regressions across
  migration, privacy, conversion/alias editing, permissions/UI helpers, encrypted
  deletion and leak boundaries. No existing assertion changed. Initial typing
  fixes restricted permission names and declared the browser-only fixture global.
- Chrome build passes. The first focused Chromium run failed all ten fixtures
  before application assertions: the expanded in-memory React test bundle left
  process.env.NODE_ENV unresolved in library mode. Added a test-only production
  React define and automatic JSX configuration; rerunning the same expectations.
  All provider/window/cookie/DNR HTTP in these UI fixtures is fictional.
- The corrected focused Chromium suite passed **10/10**, including all six
  existing vault fixtures plus four new real React consent-flow fixtures. It
  covers first-account default, two saved accounts beside normal A, denied
  incognito with explicit current-login fallback, Privacy mode, cancellation and
  denied grants. Actual worker disconnect/forget messages erase encrypted slots
  created by the fixture and preserve unrelated accounts. No provider traffic.
- Updated privacy/architecture/install disclosure for the gated flow, local
  encryption limits, current-login warning, conversion and retryable deletion.
  Added a consent-screen screenshot artifact for visual review. Full check,
  complete browser suite, variant/package guards and CI still follow.
- Full check passed: **243 core, 20 native, 24 connection and four transport/runtime**
  tests, TypeScript and Chrome build. Complete Chromium suite passed **52/52**;
  server typecheck and Chrome/Edge/Firefox directory contracts passed. The separate
  spike suite passed **4/4**. Reviewed the actual consent screenshot: readable
  layout, unchecked consent, disabled Save and collapsed privacy disclosure.
- Final source-isolation review found website disconnection unconditionally
  revoked the shared site grant. Retain that grant while another enabled saved
  source needs it; release it after the last website/vault source is removed.
  Added an actual Chromium permissions regression. Re-running full browser and
  variant/package checks on this final correction; core/full check still passes.
- The 53-test browser run passed 52; only the new final-grant removal assertion
  failed. Diagnosis: its existing fixture grants required host access, so Chromium
  reports "You cannot remove required permissions." Production grants are
  optional. Model that removal in the fixture explicitly and assert zero removal
  requests while B needs the host, exactly one after the last source is gone.
  This proves controller ownership/routing, not the real approval/removal prompt.
- Final frozen-source validation passes: npm run check (**243 core, 20 native,
  24 connection and four transport/runtime**, TypeScript/Chrome build), followed
  by the complete Chromium suite **53/53**. Separate spike **4/4**, server
  TypeScript, Chrome/Edge/Firefox build-directory guards and actual normal ZIP
  inspection pass. No pre-existing assertion was weakened. 68 relative Markdown
  links, whitespace and the unchanged original R2 plan were checked.
- Packaged normal Chrome/Firefox ZIPs and the separate spike; generated checksums.
  Normal archives exclude spike entrypoints/grants, in-memory UI/provider helpers,
  fictional credential markers and debugging. No new dependencies, required
  permissions, version bump or release. Local ZIPs (CI timestamps change hashes):
  - Chrome **325321 bytes**, SHA-256
    `85baed98f77ef5b62bc1a32419a240fd4c6c3546a568cd2e626eba66e49300cb`.
  - Firefox **323281 bytes**, SHA-256
    `4b9f5d82dd002b2c144a0fcfc63106767cbd3e44181937bfbac989e0f5e45757`.
- C11's code is implemented and locally validated behind off policies. The PR
  handoff records exact file +/− counts, simulated versus live evidence and manual
  steps. Publish/CI and the authorized integration/main merge follow. Only main
  and the integration branch should remain after pruning the merged C11 branch.
  C12, the live trial, E1–E8, G0/G1 and real provider/logout/other-device acceptance
  remain PENDING. Installing this checkpoint does not expose an enabled private
  login route or prove the requested overall feature works live.

### Minimal UI follow-up — requested after C11

- C11 is merged into main through PRs #15/#16. It added gated setup and deletion,
  not a dashboard-wide simplification. This separate user-requested polish branch
  is `codex/minimal-ui`, from the current integration tree. No user changes were
  present. C12 is not started; provider policies and human gates stay unchanged.
- Removed repeated dashboard branding text, the extra overview title/intro/Add
  button and duplicate Accounts-page Add button. Limits move closer to the top.
  Search and Low only stay visible. Sorting, attention and provider filters are
  behind Filters, with a visible active-count badge and Reset filters control.
- Service cards keep logos, capability labels, + and errors visible. Less-used
  website links, individual refresh and reading-mode controls move into existing
  Connection details. Shortened the connection-method explanation without hiding
  Desktop requirements. Popup account names grow from 14px to 15px; its essential
  actions and six-row layout remain. No data model/authentication changes.
- Added one browser regression for keyboard filter disclosure, sorting/search,
  hidden active filters/reset, accessible service controls, visible errors and
  unchanged account/source records. Existing mode-switch test now opens details;
  the popup font assertion now expects 15px. Full check/browser and visual review
  follow before delivery.
- npm run check passed: **243 core, 20 native, 24 connection and four
  transport/runtime tests**, TypeScript and Chrome build. Initial browser run:
  53 passed, one new-test failure (sample data has three GPT accounts, not two).
  Corrected that test-data expectation; focused rerun passed, then the complete
  final npm run test:browser passed **54/54**. No production workaround and no
  pre-existing safety assertion weakened. All provider behavior remains fictional.
- Reviewed actual Chromium screenshots: minimal dashboard/services and six-account
  popup. Existing regressions still verify six rows without scrolling, ten-row
  internal scrolling/search, dark/narrow layouts, privacy and 200% text enlargement.
- Chrome/Edge/Firefox builds and directory guards passed. Packaged Chrome/Firefox
  ZIPs and actual archive guards/checksums passed. Normal archives exclude fixtures
  and spike code; no dependencies, permissions or version changes. Local ZIPs:
  - Chrome **325504 bytes**, SHA-256
    `d89e4f7936ec18072a2467cecf94dac610c18ce95be4e70ad5e2fe5061684cdc`.
  - Firefox **323474 bytes**, SHA-256
    `29cf6d779e28944658983fccaab5b99b5dd7c7d6524e1aedd9e7ea39b0fb19ac`.
- Whitespace checks pass; original R2 proposal unchanged. Publish the narrow PR
  with per-file +/− counts, wait for full CI, then merge through integration into
  main under existing user authorization and prune the merged task branch. No
  release or provider activation. Next separate group remains C12; live gates,
  provider/logout/other-device acceptance and the 3–4 day trial stay pending.

### C12 — expiry watchdog and final persistence documentation

- Created `codex/c12` from the latest integration tree, identical to main after
  the UI merge. Worktree was clean; no user edits to preserve. Scope is T4.1 and
  T4.3 only. E5 remains pending: expiry is supplied cookie metadata, never an
  assumed provider lifetime. All provider policies stay off and allowlists empty.
- Added pure expiry selection/48h/24h warning decisions and an injected watchdog.
  It reuses notification permission, quiet hours, account mute/snooze and privacy
  labels. Only valid enabled saved sources with known future expiry qualify.
  Unknown, expired, rejected, wrong-bound or off-policy sources cannot alert.
- Reuses the existing bounded local alert ledger; no Store schema/version change.
  Warnings deduplicate by source/expiry, survive reload, and rearm when the supplied
  expiry changes. Late wake sends only the urgent warning. Failed delivery restores
  its ledger entry for retry. A daily alarm is installed only when needed, retained
  across repeat checks and removed after last-source/permission/policy removal.
- Controller checks on startup/open/regular refresh, successful source reads,
  relevant settings/deletion changes and the daily alarm. Rechecking after quiet
  hours needs no new alarm/grant. In-flight checks coalesce with a trailing pass
  for changed settings/disconnect; final decisions use serialized current Store.
  This path never decrypts credentials, opens provider tabs or sends HTTP.
- TypeScript and core tests pass while developing. Initial new-test failures
  exposed test round-trip defaults/undefined properties, not changed account data;
  canonicalized the fixture and compare the complete serialized public projection.
  No pre-existing assertion weakened. Full checks/browser/package results follow.
- Added the required `SESSION-PERSISTENCE.md` summary and updated architecture,
  privacy, docs README, install/start links and evidence/browser ledgers. The
  README update is directly in docs per the user's Markdown-location rule.
  G0's historical implementation table is explicitly dated; its HOLD remains.
  No experiment, trial, OS notification or provider acceptance was marked PASS.
- Final npm run check passes: **255 core, 20 native, 24 connection and four
  transport/runtime tests**, TypeScript and Chrome build. Twelve new core/platform
  cases cover expiry bounds, delivery/restart/ledger, metadata/privacy, alarm
  ownership, concurrent disconnect, quiet hours and the supplied cookie timestamp.
- First complete browser run: 55 pass, one new-fixture failure before application
  assertions (optional notifications namespace was absent). Defined only that
  fictional API in the fixture; focused rerun passes **1/1**. Production code and
  permissions were not loosened. Final full browser and package verification follow.
- Final complete browser suite passes **56/56** on the frozen C12 source. The new
  production fixture verifies that even a granted notification port and supplied
  expiry cannot arm a production-off provider; the UI shows 1 day, removes unknown
  expiry labels and preserves the last reading time. The injected watchdog fixture
  uses actual browser storage/alarms with fictional clock/account/notification
  delivery, verifying persisted 48h/24h decisions and last-source alarm cleanup.
- C12 code and documentation are implemented; provider policies/allowlists, E1–E8,
  G0/G1 and the 3–4 day trial are unchanged. T4.4 real Chrome/Edge/Brave and real
  OS-delivery/lifetime checks remain pending. C8, conditional T4.2/E6 work and
  optional C13 are not implemented or activated by this checkpoint. Original R2
  proposal unchanged; 82 local documentation targets checked, none missing.
- Chrome/Edge/Firefox builds and directory guards pass. Normal Chrome/Firefox
  ZIPs pass actual archive guards; C12 fixture-only keys/names/failure markers
  are absent. Checksums generated; no version/dependency/manifest/policy changes.
  Local ZIPs (CI timestamps can change hashes):
  - Chrome **326309 bytes**, SHA-256
    `b967c8c77d54aa8c0ff9f805c922e22e17d6d4ed584478d65e7a085167c98052`.
  - Firefox **324269 bytes**, SHA-256
    `513d0e7bf5af165272476d32619c2e7847dac0b60073f0f89167762cfea201e1`.
- Publish C12's §11.3 PR handoff with exact file +/− counts and actual CI results,
  then use the existing authorization to merge the validated checkpoint through
  integration to main and prune only its merged task branch. No release or
  provider activation; no next group started.
