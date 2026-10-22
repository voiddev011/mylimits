# MyLimits 3.4 Desktop accounts — implementation handoff

22 October 2026. Branch `feature/desktop-independent-accounts`, based on
`docs/desktop-accounts-execution-plan`. Work was sequential, without parallel
agents. No main merge, public release or hosted deployment was performed.

**Delivery: implemented experimental code and packages. Real account acceptance
is incomplete for BOTH OpenAI and Claude. This is not release-ready.**

## Implemented

- The extension's provider + offers website tracking and Desktop independent
  connections. OpenAI/Claude independent choices invoke the actual local service;
  they do not use the empty hosted provider registry or switch the normal tab.
- Official Codex App Server owns OpenAI login/account/quota calls, one CODEX_HOME
  per connection. Claude Code owns Claude subscription login, status and /usage,
  one CLAUDE_CONFIG_DIR per connection. Actual provider processes are packaged or
  installed through the official route; they are not replaced by mock collectors.
- Fresh external browser profiles are used for authorization. Login completion
  stages the provider-reported identity; explicit generation-bound confirmation
  and an optional alias precede acceptance/quota collection. Wrong/duplicate
  accounts are visible, not relabelled as B. Pending confirmation resumes on restart.
- Identity is rechecked around reads. OpenAI currently reports email/plan, not a
  verified immutable workspace identity: same-email ambiguity stays explicit and
  is never auto-merged. Claude requires documented config-directory/subscription
  metadata and uses organization identity where returned. Missing values stay unknown.
- Serialized account operations, bounded global work, one login at a time,
  cooldown/backoff, scoped reconnect/disconnect, preserved successful timestamps
  and dated cached readings. OpenAI minimum 2 minutes; Claude minimum 5 minutes.
  Periodic reads run while an authenticated browser client is attached. Closing
  provider tabs does not supply credentials or stop this designed native route.
- Official first-use Claude setup stays in its own visible provider terminal;
  trust/terms choices are not auto-accepted. No model prompts are generated.
- Strict Native Messaging and local HMAC transport, protected per-user stores,
  normalized credential-free extension messages, alias/history-preserving metadata
  migration, owned-process recovery fences and staged program-file rollback.
- A guided Windows online bootstrapper detects existing MyLimits installations,
  installs selected official runtimes with integrity checks, registers origins,
  confirms bridge health and returns to the extension. No user Node/npm install,
  extension-ID entry, copied token or recurring terminal command in that path.
  Uninstall offers keeping/deleting local profiles after confirmed owned shutdown.

Core changes: `companion/connections.mjs`, provider adapters/proof runtime,
`owned-processes.mjs`, `runtime-update.mjs`, native protocol/daemon/install,
`companion/windows/*`, `scripts/desktop-package.mjs` and package scripts;
extension contracts/controller/native transport and `AccountConnect`,
`OpenAICompanion`, App/Popup; lifecycle/native/Windows/browser regression tests.
See IMPLEMENTATION-STATUS for each D01–D10 checkpoint, files and decisions.

## Automated tested

Green [CI run 39756974345](https://github.com/voiddev011/mylimits/actions/runs/39756974345)
at code checkpoint `8f43c21c0934774cbcea810667579d162346961f`:

| Check | Actual result / evidence |
| --- | --- |
| TypeScript + `npm test` | Passed; 109 core tests |
| `npm run test:companion` | Passed Linux and Windows: 20 legacy native + 24 connections + 4 real native transport/runtime tests |
| `npm run test:account-proof` | 30 passed on Linux and Windows; fictional accounts, real subprocesses/PTYs |
| `npm run test:hosted-probe` | 10 passed; sanitized transport/lifecycle regression, no hosted account integration |
| `npm run test:desktop-package` | 1 passed on Linux/Windows; real Windows PTY dependencies and clean lean payload |
| `npm run test:browser` | 31 passed in Chromium; simulated provider/native responses |
| Windows PowerShell 5 setup tests | Parser, actual GUI construction without installation, discovery, integrity rejection, file/directory rollback and owned process shutdown passed; unrelated process remained alive |
| Official Claude browser-interface check | Passed unauthenticated on Windows; confirms routing interface, not account sign-in or quota retrieval |
| Chrome/Edge/Firefox build/package contracts | Passed; both extension ZIPs checked, hashes generated |
| Windows NSIS setup build | Passed, EXE and size/dependency/checksum artifacts uploaded |
| Existing optional server regression | Passed: 43 PostgreSQL/API/worker tests, responsive web fixture and actual extension/API pairing/upload/delete transport; hosted provider in that test is fictional |

Local final reruns passed core/native/proof/browser suites. The final code
checkpoint includes safe recovery of exited process records after restart and UI
instructions to use Desktop setup for repair. It is the exact source of both
linked artifacts. A final documentation-only commit adds this handoff.

Windows headless ConPTY regressions emitted third-party `AttachConsole failed`
cleanup-agent warnings while the tests and owned-shutdown assertions passed.
Interactive Windows terminal/login/cleanup still needs the live matrix below;
passing CI does not certify those warnings harmless for every laptop.

## Packaged artifacts and measured sizes

Download from the run above:

- [Windows Desktop artifact](https://github.com/voiddev011/mylimits/actions/runs/39756974345/artifacts/12415693128)
  contains `mylimits-desktop-windows-x64-unsigned.exe`, `.sha256`, `.json`.
- [Extension packages](https://github.com/voiddev011/mylimits/actions/runs/39756974345/artifacts/12415824156)
  contain Chrome/Firefox ZIPs and SHA256SUMS. Use Chrome for Desktop testing.
- Current source builds also produce `.output/mylimits-3.4.0-chrome.zip`,
  `.output/mylimits-3.4.0-firefox.zip`, `.output/SHA256SUMS`.

Actions artifacts require repository access and expire; they are development
delivery, not a permanent public download. No release was published. Cross-compiled
NSIS artifacts can differ in bytes from Windows builds; use each artifact's own
hash, not a hash from another build.

| Size | Measured bytes | Meaning |
| --- | ---: | --- |
| Old bundled installer | 211,310,699 | Existing baseline artifact |
| New Windows-built initial EXE | 1,500,185 | Unsigned online bootstrapper |
| Bootstrapper's unpacked program payload | 3,110,365 | Excludes acquired provider/Node runtimes |
| Node official archive | 37,733,703 | Required on first setup; reused if compatible |
| Codex official archive | 167,618,721 | Additional if OpenAI is selected |
| EXE + first Node/Codex archives | 206,852,609 | Excludes Claude, failed transfer retries and network overhead |
| Installed Node executable | 93,882,184 | Extracted official binary, not full Windows install measurement |
| Installed Codex vendor directory | 465,689,987 | Extracted official runtime/support files |
| Complete clean Windows installed size/time | PENDING | Requires actual clean installer execution |
| Claude download/installed bytes | UNKNOWN | Official installer/version/system dependent |

Windows EXE SHA-256:
`8c4651c2bd21801b7ed9ec0927d7480fe9409317ac1b3c74d8abd5321d8d2e74`.
This is the actual retrieved CI EXE; its hash was verified locally. The downloaded Chrome ZIP is 307,211 bytes, SHA-256
`603c04c659c644acd1d38df7674ff8f3a43dba315314024890103085d73457dd`;
Firefox ZIP is 305,119 bytes, SHA-256
`a05881180fcaae3e5c32adf25280eb143c71883f3aaf3d77bcbf5ff0eb39b867`.

The small initial download does **not** remove the large official runtime cost.
Successful setup deletes archive cache and records actual local setup/service bytes
and verified archive-download bytes in `desktop-install-sizes.json`. Partial failed
transfers and official Claude downloads are excluded/unknown, not silently counted
as zero. Rerunning setup reuses pinned compatible private executables.

## Install and test

Follow [INSTALL.md](INSTALL.md). Short path: load the extension → run the guided
Desktop EXE → provider + → Connect another account → Connect Desktop → official
sign-in → inspect identity → alias → Confirm account. Repeat for A and B.
Keep the normal website signed into A throughout. Source users must update both
the extension branch/build and the installed Desktop, not just run git pull.

Refresh B after usage on another device only after its next eligible check. Record
the provider's own before/after display and MyLimits fetch date separately.
Do not submit credentials, full terminal output, browser profiles or authorization
URLs with test reports. Report alias, provider/version, scope, dates, outcome and
sanitized error code only. Never mark an old reading fresh by editing fixtures.

## Live verified

**None of the authenticated provider acceptance rows below.** This environment has
no authorized account A/B pair or interactive Windows laptop. Official docs/interface
observations and fictional tests are not live provider evidence.

| Required live check | OpenAI / Codex | Claude |
| --- | --- | --- |
| Actual eligible A and B authorized independently | PENDING | PENDING |
| B added while ordinary browser remains A | PENDING | PENDING |
| Reported identity/scope confirmed against official display | PENDING | PENDING |
| Both accounts return independent current quotas | PENDING | PENDING |
| Other-device usage reflected after eligible refresh | PENDING | PENDING |
| Provider tabs closed; checks still work | PENDING | PENDING |
| Browser and Desktop restart preserve connections/refresh | PENDING | PENDING |
| Ordinary website logout behavior recorded separately | PENDING | PENDING |
| Global revocation and reconnect behavior recorded | PENDING | PENDING |
| Actual credential renewal observed | PENDING | PENDING |
| Disconnect B leaves A usable | PENDING | PENDING |
| Clean Windows Chrome setup/update/rollback/uninstall | PENDING | PENDING |
| Clean Windows Brave setup/update/rollback/uninstall | PENDING | PENDING |

## Blocked or unverified

- Full feature completion requires both live columns to pass. Official login or
  quota failure is a provider/integration failure to investigate, not a passed
  account merely because a browser window opened. Neither provider is certified.
- Claude's terminal-rendered /usage interface can change. Its reset times and
  upstream observation time are unknown unless reliably provided; parsing never
  manufactures them. Actual current server freshness must be compared live.
- OpenAI currently exposes the actual Codex buckets only. General ChatGPT chat,
  image and every-model allowances are not implemented. Immutable OpenAI workspace
  discrimination remains unsupported by the inspected official account metadata.
- Official local-use docs were reviewed: [Codex App Server](https://developers.openai.com/codex/app-server/),
  [Claude auth/config directories](https://code.claude.com/docs/en/authentication),
  [CLI reference](https://code.claude.com/docs/en/cli-reference),
  [Claude conditions](https://code.claude.com/docs/en/legal-and-compliance).
  Claude is installed as unmodified official software and subscription credentials
  stay with it; no custom Claude OAuth client/API or token export is added. This
  review is not provider endorsement or commercial/distribution approval. Confirm
  current product eligibility before publication; no approval was obtained here.
- Public download signing/hosting, browser store identity/publication and managed/
  nonstandard browser-policy behavior remain external delivery prerequisites.
  Default beta setup button points to branch Actions artifacts; an operator can set
  `MYLIMITS_DESKTOP_SETUP_URL` to the eventual public HTTPS installer page.
- Firefox native setup, macOS Desktop and unrelated independent providers are not
  implemented. Website modes remain separate and do not survive logout by magic.

Next action: install the exact Windows artifact on the user's laptop and execute
the matrix for two actual accounts per provider. Investigate any real failures
before removing experimental labels, merging main or considering a public release.
