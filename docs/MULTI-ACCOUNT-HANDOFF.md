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

- TypeScript, 102 core, 20 legacy native, 16 connection and 28 proof tests pass.
  Connection tests include actual fictional CLI processes/PTYs for mixed accounts,
  successful Claude login, cancellation, organization isolation, restart and logout.
- Full Chromium suite: 29 passed, including provider-specific connection setup,
  transient identity privacy, nickname preservation and missing dependency state.
- Unmodified official Claude Code 2.1.301, downloaded with its published integrity,
  ran an unauthenticated capability test: BROWSER marker invoked, official loopback
  callback verified and login cancelled with shutdown confirmation. No account
  credentials, login codes, authorization URLs or model requests were used/exported.
- Windows repeats that exact interface check on CI with the pinned official native
  binary and compiled router. This is distinct from a fictional CLI test and still
  does not prove real account authentication.
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
