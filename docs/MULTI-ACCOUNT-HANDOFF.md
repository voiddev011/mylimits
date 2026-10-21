# MyLimits 3.2 code completion handoff

Branch `feature/independent-accounts`, 21 October 2026.
[Code checklist](MULTI-ACCOUNT-CODE-CHECKLIST.md) · [Install](MULTI-ACCOUNT-INSTALL.md).

## Implemented source

- Independent OpenAI **and Claude Code** profile adapters in one local service,
  combined popup/dashboard and distinct current-browser tracking. Other providers
  keep existing website tracking; no universal independent service support claim.
- OpenAI keeps existing `openai-companion:<uuid>` IDs/homes. Claude adds its own
  `claude-companion:<uuid>` account namespace and distinct CLAUDE_CONFIG_DIR per
  profile. Nicknames, settings and dated history remain separate and preserved.
- OpenAI official App Server sign-in; Claude official unmodified CLI sign-in in a
  real terminal with its documented BROWSER override. A private launcher opens a
  fresh external browser profile; official CLI owns callback, credential exchange,
  storage and renewal. No passwords, pasted login codes, cookies or tokens enter
  extension messages or MyLimits credential storage.
- Native service verifies actual identity before/after usage and fences auth
  generations. Claude uses official email + organization metadata when available;
  OpenAI email remains limited metadata, not a global/workspace ID. Duplicate
  hints never silently merge profiles or announce a second successful connection.
- Claude reads a fresh first-party /usage panel using a short-lived PTY. Actual
  supported session/weekly model percentages are normalized; unknown reset times
  stay null. Provider observation time stays unknown. No model prompt is sent.
- Per-account queues and bounded total processes, persisted two-minute OpenAI /
  five-minute Claude minimum waits, error backoff and explicit retry hints where
  available. Empty/failing reads preserve prior data and age. Startup/open checks
  request eligible refreshes; immediate upstream freshness is not promised.
- Start/cancel/reconnect/rename/refresh/disconnect and Claude setup actions are
  operated from the extension. One-time official onboarding may ask for user
  choices in its own window; close it and check setup afterwards. Trust and terms
  are not auto-accepted. No recurring terminal commands/token copying are needed.
- Windows helper includes pinned Node/Codex and terminal libraries; current-user
  setup compiles its owned browser launcher and offers official WinGet Claude Code
  installation. Claude binary is unmodified/user-installed, not redistributed.
  Linux first-party onboarding requires xterm; Firefox remains website-only.

## Code verification

- TypeScript, 102 core, 20 legacy native and 18 connection tests pass on Linux and
  Windows. Proof suite: 30 passed on Linux; 29 passed and one symlink-privilege
  check explicitly skipped on Windows. Zero failed or cancelled tests.
  Connection tests include actual fictional CLI processes/PTYs for mixed accounts,
  successful Claude login, cancellation, organization isolation, restart and logout.
- Final regressions cover the actual shared Claude browser-launch boundary,
  Windows terminal disposal after natural CLI exit, and acknowledged shutdown of
  cancelled metadata commands. CLI-owned credential writers cannot overlap a new
  operation just because kill was requested. Unconfirmed shutdown fails closed.
- Full Chromium suite: 29 passed, including provider-specific connection setup,
  transient identity privacy, nickname preservation and missing dependency state.
- Unmodified official Claude Code 2.1.301, downloaded with its published integrity,
  ran an unauthenticated capability test: BROWSER marker invoked, official loopback
  callback verified and login cancelled with shutdown confirmation. No account
  credentials, login codes, authorization URLs or model requests were used/exported.
- Windows repeats that exact interface check on CI with the pinned official native
  binary and compiled router. This is distinct from a fictional CLI test and still
  does not prove real account authentication.
- The pinned OS-ConPTY dependency can emit an AttachConsole cleanup warning for
  an already exited provider process. Its public terminal cleanup is still called;
  the native tests must finish without retained workers. No warnings are suppressed
  or raw provider output copied into MyLimits logs.
- Final variant/archive/installer/Windows CI results and downloadable artifacts are
  recorded in IMPLEMENTATION-STATUS.md and the publication note below.

## Manual account acceptance — user

The code checklist is separate from live acceptance. Sign into two eligible
accounts per provider, verify A remains in the normal browser while B signs in,
compare actual quota scopes/values, use another device, close provider tabs,
restart and test ordinary website logout vs global revocation and actual renewal.
These checks were not performed here and cannot be claimed passed from fixtures.

Only exposed quotas are supported: OpenAI Codex/Work does not imply every ChatGPT
image/message/voice allowance. Claude CLI panel reads need live value/freshness
comparison. Missing capabilities/unsupported CLI versions show setup or error state.
Provider product/distribution/trademark review and signing/store publication remain
release work, separate from the implemented first-party local adapters.

No main merge, backend deployment, credential upload, store submission or external
provider message was performed. Use 3.2 packages; 3.1 helper lacks the Claude code.

## Final code delivery

Code source [d3e821ad](https://github.com/voiddev011/mylimits/commit/d3e821ad1d200c16bc6c0b6d6efc4de8315ae7dc)
on `feature/independent-accounts`. The documentation follow-up does not change
production source. [CI 39587512847](https://github.com/voiddev011/mylimits/actions/runs/39587512847):
**verify, windows-logic and connected-services all passed**. This includes the
official Windows browser-routing capability check, actual fictional CLI/PTY
regressions, setup GUI construction, installer compilation and extension archives.

| Download | Contents |
| --- | --- |
| [3.2 extension packages](https://github.com/voiddev011/mylimits/actions/runs/39587512847/artifacts/12340496910) | Chrome/Brave/Edge ZIP, Firefox website-only ZIP, SHA256SUMS |
| [3.2 Windows x64 helper](https://github.com/voiddev011/mylimits/actions/runs/39587512847/artifacts/12339618052) | Unsigned development installer EXE and its SHA-256 file |

Download the two artifacts while signed into GitHub with repository access.
Extract both artifact ZIPs. Run the helper EXE as your normal Windows user.
Extract the inner `mylimits-3.2.0-chrome.zip` into a permanent folder; open
`chrome://extensions` or `brave://extensions`, enable Developer mode and load
that extracted folder containing `manifest.json`. Keep an existing extension's
folder/ID when updating; register its ID in the helper setup. Then open MyLimits
→ + → provider → Connect an independent account. Repeat with a different account
and nickname. See [installation](MULTI-ACCOUNT-INSTALL.md) for all setup steps.

GitHub artifact envelopes (not the files inside): extension SHA-256
`d99bc8dc9cbef5549a5487733b341017c0b6d59c8231000ef4a26af26d256f13`;
helper SHA-256 `d6d2a0d664482f0070e057730ac7f7d5aa60b7494e69dd750f66ba6a65fc5bd3`.
Use the checksum files inside each download to verify the actual ZIPs/EXE.
CI artifacts expire 19 January 2027; these are not published releases.

**Implemented:** complete OpenAI/Codex and Claude Code adapters, integration,
account UI, package/installer and automated regressions. No remaining coding stub
or known code blocker on this checklist.

**Live verified:** official unauthenticated CLI browser-routing interface on
Linux/Windows. No real-account connection, quota, cross-device, logout or renewal
acceptance was performed; the user will run those separately.

**Still blocked:** release readiness awaits that manual acceptance, interactive
clean-user installation/uninstall checks and separate signing/publication review.
No main merge or release was performed.
