# MyLimits 3.1 independent-account handoff

21 October 2026 · branch `feature/independent-accounts` · preview, not release-ready.

## Implemented

- Provider-neutral protocol 2 over the existing allowlisted native host and local
  authenticated pipe. Website tracking remains usable without native access.
- Isolated official Codex App Server login per UUID with fresh external browser
  directory per attempt. First-party completion matching, cancellation, reconnect,
  before/after identity fencing, duplicate hints and profile-scoped logout.
- Independent authentication state, quota availability and reading age. Structured
  retry hints where exposed, persisted two-minute minimum cooldown, failure backoff,
  per-account serialization and two-process maximum. No quota-generating prompts.
- OpenAI usage is scoped to actual returned Codex/Work buckets; no all-ChatGPT claim.
  Missing values stay unknown; empty/failing reads retain old values and timestamp.
- Native metadata retains existing homes, local account/connection IDs and aliases.
  Existing extension history is preserved; diagnostic profiles are not auto-imported.
- Extension + offers website detection vs independent connection. Dashboard provides
  current helper checks, signup progress, local verified email (privacy concealed),
  duplicate warning, cancel, reconnect, disconnect and old-helper upgrade guidance.
  No current-browser authentication-tab fallback. Popup stays compact.
- Windows guided installer includes the connection modules and pinned official
  Node/Codex runtime. Runtime operation is from the extension. Startup failures
  instruct GUI retry rather than a recurring terminal command.
- Claude unavailable capability is enforced in the service and UI before creating
  a profile. Existing Claude website reader and experimental diagnostic remain.

## Actual verification

- TypeScript and **101 core tests passed**, including migration metadata and same-ID
  disconnected/reconnected reading preservation.
- **20 legacy helper tests passed** with actual fictional child RPC.
- **13 new connection tests passed**: distinct homes/browser directories, scoped
  completion/cancel, duplicate hints, identity/generation changes, expiry, timestamp
  retention, restart, retry hints, bounded processes, logout isolation, legacy ID
  migration and actual integrated fictional CLI subprocess shutdown.
- **28 account-proof tests passed**, including real local PTYs. Shared utility
  extraction preserves the existing diagnostic; no Claude probe shipped in helper.
- **28/28 full real Chromium tests passed**. Includes native setup, transient identity
  privacy, old-helper refusal, explicit Claude unavailable and existing UI regressions.
- Chrome/Edge/Firefox builds/manifests, actual Chrome/Firefox ZIP safety contracts
  and SHA256 generation passed. Screenshot `artifacts/independent-account-preview.png`
  inspected visually. Assets are local; no provider requests were used in tests.
- Windows NSIS installer compiled on Linux with integrity-checked official Node
  and Codex assets. This does not establish interactive Windows installation or
  real Windows provider login; Windows CI is a separate check.

An initial restricted-sandbox child test failed; the approved process-capable run
passed. First browser run had one obsolete button selector, corrected before the
full 28-test success. A follow-up focused run overlapped an extension rebuild and
failed one reload with ERR_FILE_NOT_FOUND; the final sequential setup verification passed **4/4** and is recorded in
IMPLEMENTATION-STATUS.md. These failures are not counted as passes.

## Live verified

**No real OpenAI or Claude account behavior was verified.** No provider credentials
were available. Fictional subprocess/PTY/browser tests establish software behavior,
not successful first-party signup, phone propagation, logout survival or renewal.

## Still blocked / required before release

1. Two real OpenAI accounts on Windows: A/B identity, primary-browser preservation,
   actual quota scope/value matching, other-device-only usage, tab closure, restart,
   ordinary website logout vs global revocation and actual expiry/renewal.
2. Claude automatic isolated browser signup and reliable fresh upstream monitoring.
   Current official auth documentation supports separate CLAUDE_CONFIG_DIR folders;
   this does not solve its default-browser launch. No custom OAuth/cookie fallback.
3. Confirm the proposed Claude monitoring/distribution route against its published
   credential/product conditions. No provider clarification message was sent.
4. Interactive clean-user Windows install/upgrade/uninstall, stable store-ID setup,
   signed installer and beta soak. Current GUI keeps a manual unpacked-ID fallback.
5. Other services require validated adapters. OpenRouter is the next documented
   API candidate; consumer Gemini/ChatGPT allowances are not inferred from API quotas.

## Install and test

Follow [MULTI-ACCOUNT-INSTALL.md](MULTI-ACCOUNT-INSTALL.md). Load the 3.1 Chrome ZIP
or `.output/chrome-mv3`, install the matching 3.1 Windows helper, then + → OpenAI →
Connect an independent account → Enable helper connection → Sign in to OpenAI.
The old 3.0 helper is intentionally refused for signup. Claude independent setup
will say unavailable; current-browser tracking still works.

Builds: `.output/mylimits-3.1.0-chrome.zip`,
`.output/mylimits-3.1.0-firefox.zip`, `.output/SHA256SUMS`,
`artifacts/mylimits-companion-windows-unsigned.exe` and its `.sha256`.
These generated binaries are not Git source files. CI uploads extension/helper
artifacts under [branch checks](https://github.com/voiddev011/mylimits/actions?query=branch%3Afeature%2Findependent-accounts).
See implementation status for the exact published source/CI evidence.

No main merge, public release/store submission, new backend or provider credential
upload was performed. Do not advertise this preview as completed Claude/GPT universal
multi-account tracking.

## Published source and CI evidence

- Application commit: `e29a7d2571211bac4f82fc733fe531451749d340`, exact tree
  `89b9e596132777e11f6fc7aaba28075579e39c06` equals local `00437a8`.
- Preceding plan commit: `6e87354a9287fcf603b49b9b0a63e9e6537f170f`, tree
  `59842650db84199211347113aab6157442940eca` equals local `6142aa6`.
- [CI run 39579243525](https://github.com/voiddev011/mylimits/actions/runs/39579243525):
  **all three jobs succeeded** on that exact application source.
- Linux: 101 core, 20 legacy native, 13 new connection, 28 proof and 28 Chromium
  tests pass; browser variants/manifests and clean archive contracts pass.
- Windows: 101 core, 20 legacy native, 13 new connection tests pass; proof 27 pass,
  one intentional POSIX-only skip, zero failures. Actual Windows child processes,
  ConPTY, PowerShell parser/GUI construction and NSIS compilation passed.
- Connected-services: existing isolated PostgreSQL/auth/API/job/phone/extension
  transport regressions passed. No backend was deployed or used for provider auth.
- [Extension artifact 12335143318](https://github.com/voiddev011/mylimits/actions/runs/39579243525/artifacts/12335143318).
- [Windows artifact 12336221223](https://github.com/voiddev011/mylimits/actions/runs/39579243525/artifacts/12336221223).
  CI EXE: 196,628,503 bytes. Artifact ZIP digest (not the EXE digest):
  `sha256:14359b522dae4c9bdce154dd5e2903ce6f0e2e8f9cc18a96594f6e4c886e6551`.
  The artifact includes its own EXE checksum; do not compare it to the separate
  local Linux-compiled installer checksum.
- The following evidence commit changes documentation only and skips redundant CI.
  No new application source follows the successful run at this checkpoint.

CI success remains fixture/build evidence, not real provider signup/logout/renewal
or interactive clean-user Windows proof. Claude remains unavailable.
