# Independent Claude and OpenAI accounts: research and implementation plan

Research date: 16 October 2026. Updated: 17 October 2026. Status: Gate 0/1
developer diagnostic implemented on `v3/account-proof`; real-provider proof and
Gates 2–5 remain pending. See [ACCOUNT-PROOF.md](ACCOUNT-PROOF.md).
Scope: two or more accounts per provider, one dashboard, no switching the user's
normal ChatGPT/Claude browser login. This document supersedes any earlier claim
that V3 completed independent multi-account tracking.

## 1. Decision

Build a single local MyLimits account service, connected to the existing extension
by native messaging. Reuse V3's interface and existing OpenAI helper where useful.
Prove the two provider connectors before expanding setup or doing another redesign.

The service must run each account in its own first-party CLI profile:

- OpenAI: unmodified official Codex App Server, one private CODEX_HOME per connection.
- Claude: candidate adapter around unmodified Claude Code, one CLAUDE_CONFIG_DIR per
  connection, using first-party sign-in and the CLI's /usage display.

The Claude route is conditional on technical proof AND confirming the proposed
product/polling/distribution use fits Anthropic's conditions. Do not implement a
custom Claude OAuth client, import session cookies, or read/export Claude tokens.

A browser-extension-only, installation-free, independently refreshing product
for both providers is not established by this research. Do not sell that promise.
The practical proposal has one user-approved installer with automatic setup. No
terminal commands, Node/npm installation, token copying or manual host-ID entry
in the intended public release experience.

## 2. Evidence and limits

### Provider-supported foundations

| Finding | Source | Consequence |
| --- | --- | --- |
| Codex App Server exposes account login, account info and rate-limit read/notification methods. | [Official App Server](https://learn.chatgpt.com/docs/app-server) | Start with its managed authentication; preserve returned quota buckets/scopes. Do not send model turns to monitor usage. |
| OpenAI documents multiple account registrations, rotating refreshes and protected runtime token storage. | [Accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) | Keep profile ownership separate. Own-app SIWC registration is a distinct alternative, not evidence that its grant can read every quota endpoint. |
| Work/Codex allowances and ordinary ChatGPT message limits differ. | [OpenAI usage explanation](https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex) | Label returned Work/Codex buckets. Ordinary chat/image/upload limits stay unsupported unless individually exposed and proven. |
| Claude Code documents simultaneous claude.ai logins through separate config directories; its credential storage follows that directory. | [Official authentication](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts) | A plausible first-party account-isolation mechanism exists. Console logins without API keys have different isolation behavior and are excluded from the initial consumer-subscription connector. |
| Claude CLI has first-party login/status commands; its auth status can identify the selected config directory. | [CLI reference](https://code.claude.com/docs/en/cli-reference) | Use the CLI's own login and metadata, capability-detect installed versions and verify profile routing. |
| Claude Code can provide quota fields through status-line JSON, but fields may be absent until an API response and scripts can rerun without a new provider reading. | [Status-line documentation](https://code.claude.com/docs/en/statusline) | This is optional passive input, not proof of fresh cross-device polling. A timer callback must not make a cached quota fresh. |
| Claude Pro/Max subscription limits are shared with Claude Code. | [Claude help](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) | Correctly scoped subscription readings can reflect other-device activity. Supported plans/windows must still be tested. |
| Anthropic restricts third-party Claude.ai login/token collection and separately permits end users signing into unmodified Claude Code under stated conditions. | [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use) | Do not copy another tracker's OAuth/cookie approach. Assess the unmodified-CLI exception, distribution terms and polling use before a public connector. |

No accounts were signed in during research. These sources establish documented
capabilities or candidate implementation paths, not a successful MyLimits flow.

### What the inspected tools actually teach us

| Project/source inspected | Mechanism found | Inspiration to retain | Boundary |
| --- | --- | --- | --- |
| [CodexBar Codex documentation](https://github.com/steipete/CodexBar/blob/main/docs/codex.md) | Managed account homes and account-scoped usage snapshots. | Retain readings/errors per account, refresh independently, never change the user's default account as a side effect. | Its implementation is not proof of our Windows login/renewal flow. |
| [CodexBar ClaudeStatusProbe](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeStatusProbe.swift) and [CLI session](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeCLISession.swift) | Runs Claude inside a PTY and reads the rendered /usage panel; scopes reusable sessions. | A credential-free-to-MyLimits CLI adapter is technically plausible. | Terminal parsing, startup/trust prompts, CLI updates and account scoping require independent validation. |
| [CodexBar Claude account decision](https://github.com/steipete/CodexBar/blob/main/docs/claude-multi-account-and-status-items.md) | Distinguishes durable managed credentials from short-lived token entries and remembered readings. | Separate account ownership, freshness and display from account switching. | Account lists and stacked cards do not by themselves imply fresh independent collection. |
| [onWatch status-line bridge](https://github.com/onllm-dev/onWatch/blob/main/internal/agent/anthropic_statusline.go) | Receives first-party CLI status-line data, with staleness handling. | Small local collection path, atomic writes and explicit stale states. | Copy only allowlisted quotas; exclude raw session payloads and do not add OAuth fallback/token extraction. |
| [Claude Usage Monitor cookie design](https://github.com/phucbm/claude-usage-monitor/blob/main/.claude/docs/cookie-auth-flow.md) | Stored cookie headers and private website usage requests. | Account aliases and separate rows only. | This does not provide a permitted, durable connection for MyLimits; do not adopt its cookie storage. |
| [ClaudeHub credential store](https://github.com/tugkanboz/claude-hub/blob/main/Sources/ClaudeHub/CredentialStore.swift) | Keychain credential reads and native credential management. | Account-scoped state and request generations. | Do not copy Claude credential access into this design. |

[CodexBar issue 403](https://github.com/steipete/CodexBar/issues/403) documented
multiple rows receiving the same ambient CLI account's usage. It is closed; its
reported failure remains a useful regression scenario. Its fix rerouted token
accounts; it did not establish that arbitrary per-account CLI relabeling is safe.
[Issue 567](https://github.com/steipete/CodexBar/issues/567) is another ownership/UI
mismatch example, not proof of the current version's behavior.

## 3. Architecture

```text
Existing primary browser: account A remains signed in as before

MyLimits local service
  OpenAI A -> private Codex home A -> Codex App Server A
  OpenAI B -> private Codex home B -> Codex App Server B
  Claude A -> private Claude config A -> unmodified Claude Code A
  Claude B -> private Claude config B -> unmodified Claude Code B
                         |
        account-bound, allowlisted quota snapshots
                         |
               authenticated native messaging
                         |
             MyLimits popup + full dashboard
```

A normal tab, incognito window, popup, iframe or cookie partition flag is not a
replacement for four independently owned authorization contexts. Chrome's
[cookie API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
does not give an extension arbitrary named account jars. Firefox has a genuine
[container API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities),
but container sessions alone do not establish supported quota access, survival
of revocation, or Chrome/Brave parity.

### Technology and reuse

- Keep WXT, React, TypeScript, the compact popup, dashboard, history and alerts.
- Extend the bundled Node 24 local service rather than introduce a new UI framework.
- Official Codex child process uses its documented JSON-RPC interface.
- Claude candidate uses a maintained PTY library with Windows ConPTY support;
  choose/pin it only after a real Windows spike. POSIX success is not Windows proof.
- SQLite can hold local quota history; profile metadata is versioned and written
  atomically. The first-party CLIs remain the only credential owners.
- Native messaging is the UI bridge. Preserve exact extension-ID allowlists and
  the existing authenticated local IPC boundary. No exposed unauthenticated localhost
  endpoint and no arbitrary command/path/URL accepted from website content scripts.
- Public native installers need supported platform packages, integrity checks,
  appropriate signing and reliable discovery. A Chrome extension cannot silently
  install its own native host: [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).

No remote backend is needed for the core. An optional backend may later sync
sanitized snapshots. It cannot create missing provider access. OpenAI's locally
hosted/open-source flow has different distribution boundaries for paid or remotely
hosted apps: [official overview](https://developers.openai.com/siwc/token-sharing-open-source).
Cloud collection would require its own approved architecture; no copied browser
sessions, user passwords or Claude OAuth tokens on a MyLimits server.

## 4. Account and reading contracts

The row's identity must never depend on the account currently signed into Chrome.

Each connection record should contain:

- Immutable local connection UUID and provider.
- Connector kind/version, opaque private profile reference, auth generation.
- Provider subject/workspace identifiers when exposed by a permitted interface.
- Confirmed display identity and alias, independently editable.
- Capability flags: login supported, quota available, passive-only, active check
  supported, identity confidence, live-test status and last successful check.
- States: setting-up, verifying, connected, needs-sign-in, limited, throttled,
  offline, expired, disconnected. Connected alone never means fresh quota exists.

OpenAI's current `account/read` schema returns email/plan, not a universal stable
workspace ID: [Account type](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/Account.ts).
Use the isolated connection UUID as the routing key. Do not pretend an email is a
verified workspace identifier. Same-email connections are not automatically merged;
ambiguous ownership must be surfaced. Own SIWC registration, if later selected,
requires its separate validated-identity flow and quota-access proof.

A quota record includes connection UUID, provider/scope/bucket, real window length,
reported utilization/counts, reset time if supplied, source, fetch-start/completion
and provider observation time if known. Preserve zero, null and absent distinctly.
Record `retrievedAt` separately from `providerObservedAt`. Replaying a file or
rerunning a status-line script is not a new provider observation.

The collector binds identity before and after a check. Reject a result when the
profile, selected identity or auth generation changed. If stable provider identity
is unavailable, do not merge/deduplicate profiles or claim verified cross-workspace
identity. A repeated email is at most a duplicate hint. Tests must explicitly
exercise the limited-identity case instead of manufacturing IDs.

History keys include account/connection, workspace when known, quota scope and
window. Never sum unrelated percentages, conflate chat/context/API tokens with
subscription quota, or calculate message counts from percentages.

## 5. Proposed user experience

### Initial setup

1. Install the extension normally.
2. + -> Independent account explains the one local-service installation once.
3. Run the signed installer as the normal OS user. It installs permitted/pinned
   dependencies and registers the stable store extension ID automatically.
4. Return to MyLimits; connection readiness is checked automatically. Development
   unpacked IDs may retain a clearly developer-only manual fallback.

One installation is a product constraint, not something to hide. Basic website
tracking stays optional and can operate without it, but is separately labeled
“current browser session” and never presented as independently connected accounts.

### Adding each account

1. + -> OpenAI/Codex or Claude Code -> nickname.
2. Allocate a new private profile before starting authentication.
3. Launch the provider's own unmodified login flow in a fresh external browser
   profile/account chooser. Do not reuse the original browser's cookies.
4. Verify the actual account/organization shown after completion. An email hint
   merely pre-fills; it does not force account selection. If the first account
   returns again, explain that and let the user choose again; do not rename it.
5. Show the first genuine quota reading, or explicitly quota-unavailable.
6. Save as independently connected only when the connector's capability gates pass.

For Claude, MyLimits launches and monitors the first-party CLI's auth completion;
Claude Code owns OAuth, callback/code entry, credentials and renewal. MyLimits
must not exchange the OAuth code or implement an embedded Claude.ai sign-in form.
If a supported browser override/fresh-profile launch cannot be made reliable on
Windows without modifying the CLI, the no-primary-account-switching criterion is
not met. Do not replace it with an ordinary `tabs.create` flow.

A genuine provider login/consent step per account remains necessary. The plan
removes manual configuration, not the user's authentication or future reauthorization.

## 6. Work sequence and stop/go gates

### Gate 0: distribution and capability decision

Deliver a short decision record with source versions, supported plans, method,
credential owner, permitted distribution route, refresh behavior and uncertainty.
Confirm applicable Anthropic conditions; obtain clarification if automated quota
monitoring or embedding/distribution is not clearly covered. No custom OAuth/cookie
fallback while that question is unresolved.

Suggested provider clarification request (draft only; not sent):

> MyLimits would run the unmodified Claude Code binary with a separate config
> directory per user-selected account. Users authenticate through Claude Code's
> own flow. MyLimits never reads, collects or uploads Claude credentials and sends
> no model prompts. Can we periodically read its /usage display for a local quota
> dashboard, and what polling/distribution conditions apply?

For OpenAI use managed Codex auth first. If own SIWC registration is investigated,
treat permission to authenticate, permission to infer and permission to read a
particular quota as distinct capabilities. Do not assume one implies the others.

### Gate 1: two-account proof before UI work

Use a small local diagnostic tool and TWO REAL accounts for EACH provider.
Fixtures are necessary regression tests, but cannot satisfy this gate.

OpenAI proof:

- Sign into A and B in separate Codex homes using the existing helper prototype.
- Keep primary Chrome/Brave on A throughout B's connection; verify actual B identity.
- Obtain distinct account-bound `account/rateLimits/read` responses.
- Confirm source/plan/bucket labels against each account's own usage page.
- Keep CLI-owned renewal single-writer, exercise expiry/restart/revocation.
- Check ordinary browser logout separately from provider-wide sign-out/revocation.

Claude proof:

- Sign into A/B through unmodified Claude Code with separate config directories.
- Verify directory routing using supported auth status/metadata, including Windows
  storage behavior; reject API-billed/Console mode for this subscription connector.
- Read each profile's /usage through its own PTY. Use an empty, trusted probe
  workspace with no tools/MCP/hooks enabled for quota collection; preserve all
  built-in authentication choices and do not modify the CLI binary.
- Demonstrate that an explicit /usage invocation actually obtains a new account
  reading while ordinary Claude Code work is idle. Do not equate a TUI redraw or
  old status-line file with an upstream read.
- Use each account normally on a phone/second browser, observe a real published
  usage change, and confirm MyLimits catches up without running a coding prompt.
- Test restart, renewal, partial window data, 429/cooldown and primary-browser logout.

Deliver redacted evidence with versions/plans/account aliases, before/after values,
local request/check times, provider comparison and explicit failures. No tokens,
cookies, raw authorization URLs or chat transcripts in evidence.

**Stop/go:** if Claude cannot produce a fresh, correctly scoped idle reading using
an acceptable method, independent Claude remains unavailable. Passive status-line
support may be offered with an honest label; it does not complete the requested
feature. Seeking approved provider quota access is the next path. Do not proceed
with marketing or UI that promises independent Claude refresh.

### Gate 2: shared local account service

After Gate 1 succeeds:

- Refactor OpenAI-only profile arrays into versioned provider-neutral metadata.
- One adapter per provider, explicit allowlisted operations and capability schema.
- Keep existing OpenAI profile UUIDs/homes; never silently reuse ambient ~/.codex
  or ~/.claude. New Claude profiles have separate directories from day one.
- Queue interactive sign-ins so fixed callback ports and incomplete authorization
  flows cannot collide. Bind each callback/state to the intended profile and
  cancel only MyLimits-owned login attempts. Never terminate another CLI process
  to take its port. Quota polling can continue for already connected accounts.
- Authenticate locally and keep credentials in first-party storage with restricted
  filesystem ACLs. MyLimits stores no Claude credential material.
- Introduce helper protocol/version negotiation. Older helper = OpenAI legacy
  capability only; new Claude UI must not appear enabled against it.
- Keep the existing native-host name as an upgrade alias if a generic host is added.
- Supervise per-profile processes with a small bounded pool. Only reuse a Claude
  process for exactly the same profile/verified ownership/generation; never use one
  active CLI process and relabel its output for every account.
- Use explicit per-child auth selector environments so inherited API/OAuth variables
  cannot silently select another account. Preserve network/proxy configuration.
- Bound CPU/memory/process count, startup/trust-prompt handling, cancellation and
  CLI version changes. Unknown text/schema fails closed and preserves dated data.

### Gate 3: scheduling and trustworthy freshness

Initial targets to validate, not advertised provider guarantees:

- OpenAI: staggered checks approximately every 2 minutes while awake/online.
- Claude: conservative 5-minute active checks only if Gate 1 and provider conditions
  support them; use a slower interval if required. No assumed universal safe rate.
- Opening the popup may request an eligible refresh; it must coalesce with existing
  work and respect provider cooldowns. “Refresh all” cannot bypass throttling.
- Serialize token refresh within each owner/profile. Honor Retry-After, add bounded
  exponential backoff/jitter and pause on reauthentication requirements.
- Provider notifications can request an update when delivered, but are not proof
  of complete push coverage for other-device activity. Polling remains explicit.
- On browser startup, reconnect the local service and check due accounts; tabs for
  ChatGPT/Claude need not be open. This browser-closed/reopen behavior is a real test.
- Default to demand-driven collection with a short idle shutdown grace. Optional
  background-running mode can come later; no polling when the machine is asleep.
- Stale, offline and auth failures retain the last reading and its age. Reset times
  crossing now never create a synthetic full allowance or a reset notification.
- Status-line input is opt-in/allowlisted and passive; no network fallback or raw
  session payload storage. Hook chaining/restoration must preserve user settings.

### Gate 4: integrate the existing extension

- Make independent and current-browser-session connection modes explicit at +.
- For an installed/verified connector, directly start the selected provider's setup.
- For an absent connector, show one concise installer/readiness step rather than
  an unexplained “companion unavailable” error or a fake connect action.
- Four independently owned rows can refresh together; aliases/pins/history/alerts
  stay per connection. Account detail shows source, checked age, scope and reconnect.
- Keep browser-saved readings as their original source. Never upgrade their status
  or move history into a native account merely because a label/email matches.
- Offer explicit user-reviewed linking of views only after ownership is established;
  preserve separate sources and provenance even when they refer to one account.
- Source-specific failures must not pause healthy accounts or erase their readings.

### Gate 5: Windows public-beta packaging and delivery

- Windows x64 first; real Chrome/Brave/Edge. Linux/macOS are separately tested targets.
- One normal-user installer, dependency verification, permitted upstream install /
  redistribution, automatic native registration, update and uninstall.
- Preserve application profile data/settings through upgrades; user chooses local
  data deletion. Call the provider-owned logout operation when disconnecting; report
  unconfirmed remote revocation rather than asserting it succeeded.
- Real clean-machine tests: no global Node/npm/Codex/Claude dependency, paths with
  spaces, browser already open, startup, service crash, update, task/host cleanup.
- Keep basic extension installation and account data migration reversible. Do not
  change the existing user's default Codex/Claude login as an installer side effect.
- Run a proposed seven-day beta/renewal soak before using “reliable multi-account”
  release copy. This is a future acceptance target, not work already performed.

## 7. Required acceptance matrix

| Scenario | Required evidence / behavior |
| --- | --- |
| GPT A + GPT B + Claude A + Claude B | Four distinct account/profile-bound readings in one dashboard; provider comparisons. |
| Primary browser remains on A while adding B | B login is selected/confirmed independently; A's browser session is unchanged. |
| Only phone/other-browser usage changes | Each independently authorized account catches up after a successful due check while local coding work is idle. |
| Normal website logout | Result recorded for each provider/auth method; if native auth survives, tracking continues. If revoked, show Needs sign-in. No universal promise. |
| Sign out everywhere / revoke app access | Stop successful-looking refresh, preserve dated values, reconnect only affected account. |
| Browser closed, usage elsewhere, reopen with no provider tab | Reconnect and read accounts independently; updated values after checks, not instantaneous cached “live” values. |
| Token expiry / rotating refresh / concurrent refresh | First-party owner handles renewal; no competing writers or account overwrite. |
| Same email / different workspace / duplicate add | No auto-merge; stable identifiers when available, explicit ambiguity otherwise. |
| Late response after disconnect/reconnect | Generation rejection; cannot recreate or overwrite an account. |
| Zero / missing bucket / new CLI panel | Zero remains real; absent stays unknown; unsupported format is unavailable, never guessed. |
| Reset while offline | Countdown may expire; no invented 100% or unconfirmed reset alert. |
| 429 / outage / wake / no local CLI activity | No retry storm, token churn, fake recency or automatic prompt sent to trigger telemetry. |
| Privacy / logs / support export | No credentials, authorization URLs, transcripts or account names in safe diagnostics. |
| Uninstall / reinstall / upgrade | Chosen local retention/deletion and explicit revocation result; no orphaned silent collection. |

The release gate is factual evidence for BOTH providers, not the number of passing
fixture tests. Record each result as documented/source-inspected, fixture-tested,
live-passed (version/platform/plan) or blocked. Do not collapse those labels.

## 8. Concrete next implementation milestone

The next authorized build, if the user proceeds, should only be Gate 0/1's account
connector proof: first two real OpenAI accounts with the existing helper, then two
real Claude Code profiles with the credential-free /usage adapter. Deliver a simple
local diagnostic result table and failures. Only after those pass should the team
implement the generalized service, installer and final extension setup.

If no real account access is available in the coding environment, build the
redacted user-run diagnostic harness and continue independent code tasks, but leave
live tests pending. The user runs provider sign-in locally; never request passwords,
OAuth tokens or session-cookie uploads to this chat or GitHub.

Proposed file map, subject to repository inspection at implementation time:

- `companion/service.mjs`: provider-neutral supervisor / profile lifecycle.
- `companion/adapters/codex.mjs`: existing App Server operations behind adapter.
- `companion/adapters/claude-cli.mjs`: first-party PTY/status metadata probe.
- `companion/profile-store.mjs`: versioned metadata migration / private references.
- `companion/auth-browser.mjs`: generalized exact-provider external auth routing.
- `companion/protocol.mjs`, `src/platform/companion.ts`: versioned capabilities.
- `src/core/companion.ts`: generic independent snapshots, preserving old OpenAI IDs.
- `src/ui/AccountConnect.tsx`: independent setup distinct from browser-session saving.
- `scripts/`: user-run redacted proof harness and native/package checks.
- `docs/`: proof matrix, source/permission decisions and handoff evidence.

The research turn added only this document. The subsequent implementation adds a
separate proof tool under `companion/proof/` and `scripts/account-proof.mjs`.
It does not enable independent Claude in the extension or complete Gates 2–5.
