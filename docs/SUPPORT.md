# Provider support and acceptance — Phase 2

Code/fixture verification does not establish live provider support. All quota
readers remain **live-unverified prototypes** until tested with the relevant
signed-in plan. See the dated [capability matrix](PROVIDER-CAPABILITIES.md) and
[automated evidence](PHASE-2-HANDOFF.md).

## Implemented sources

| Source | Reading / identity | Current limitation |
| --- | --- | --- |
| Claude website | Account, eligible workspace membership and selected workspace usage | Internal interfaces; exact plan access and logout behavior not live-verified |
| ChatGPT website | Session identity and Work/Codex usage; code review when returned | Not ordinary chat, image, upload or tool quotas |
| Optional OpenAI companion | Independent native profiles; Codex App Server quota snapshots | Real account authorization/renewal/logout and Windows native launch pending |
| Grok | Returned default Grok 4 request allowance and verified subscription identity | Other mode/reset semantics and live access pending |
| Perplexity | Returned remaining counts by named mode and verified user identity | Unknown totals/reset times remain unknown |
| Cursor | Included/model coding-plan pools and provider-reported spend | Not a subscription fee; live access pending |
| Gemini / explicit activity mode | Narrow recognized successful request counters | Browser-local activity only; no cap, token count or cross-device balance |

Claude handles normalized `limits` and legacy `five_hour`/`seven_day` plus other
returned buckets. Workspace selection is explicit after verified memberships;
missing selection fails visibly. ChatGPT windows use their reported duration,
including monthly windows; missing secondary buckets are not invented. Some
plans return no quota. Valid identity with no buckets means **Quota unavailable**.

## Status and recovery

- **Updating**: the source has a usable reading; the last-reading age still matters.
- **Remembered**: an earlier login or disconnected source; reading is dated.
- **Needs sign-in**: sign into that website yourself, then reconnect/refresh.
- **Open website to refresh**: page context was required; no hidden login is opened.
- **Offline / Temporarily unavailable**: keep the previous reading and retry after
  recovery/backoff. Error messages describe the source, not an invented balance.
- **Awaiting fresh reading**: the reading is old or its reset expired; do not
  interpret it as a newly full allowance.
- **Local activity only**: requests observed here; remaining allowance is unknown.

Open **Accounts** to enable exact website access. Keep the companion collapsed
unless you want its separately installed native connection. Missing companion
support does not block website tracking. Disconnect keeps readings; forgetting
requires confirmation and removes saved account data. A native logout failure
keeps the source retryable rather than claiming success.

## Live/manual acceptance still pending

No real provider accounts, another physical device or Windows desktop were
available for this implementation. Do each applicable row separately and record
plan, workspace, browser/version, connection type, date and sanitized evidence.
Never include authorization/cookies or raw session responses in screenshots/logs.

| Check | Expected evidence | Current result |
| --- | --- | --- |
| Actual Windows Chrome, Brave and Edge popup at normal/high scale | Usable width, six representative rows at normal scale, long-name scroll, keyboard focus | Pending; Linux CSS layout fixtures are not Windows DPI tests |
| Claude Free/Pro/Max/team membership and workspace changes | Compare returned windows/identity against provider usage screen | Pending |
| OpenAI supported plans / personal and workspace identity | Compare Work/Codex and code-review pools; ordinary chat stays separate | Pending |
| Provider tab closed, browser kept open | Reading changes only after a successful permitted background read | Pending per provider/source |
| Browser close/reopen | Alarm recovery and preserved age before a new successful read | Real-account check pending; synthetic persistent-profile migration passed |
| Other-device activity | Compare next reading to provider usage screen; record refresh delay | Pending; no real-time guarantee |
| Website logout | Document whether website source stops; independent native source checked separately | Pending; no universal logout independence |
| Native collector revoke, global logout and credential expiry | Reconnect required where revoked; do not report remembered data as fresh | Pending |
| Companion Linux/Windows official sign-in and renewal | Actual native host launch and sanitized quota updates | Pending; fixture/Windows-path logic only |
| Real desktop notification permission/revocation and local quiet time | One applicable alert, no stale/local warnings | Pending desktop UI acceptance |

Automated tests cover migration/restart, aliases, permissions denial, missing
native APIs, source independence, six-row fit, keyboard/shared layouts, history,
exports and stale data. They use fictional data and block real HTTP. They cannot
promote any row above to live-verified.

Phase 2, including hosted feasibility and more provider quota readers, has not
started. Do not add a cloud login workaround to bypass a failed website session.


## Phase 2 manual release checks

- Live Grok/Perplexity/Cursor plan and identity/window comparisons; permission,
  tab-closed, logout, revocation, other-device use and rate-limit responses.
- Firefox 140+ temporary install, sidebar, exact grants and configured sync consent;
  Chromium fixture success does not verify Firefox or a real provider.
- Windows clean install/update/uninstall of the unsigned optional companion,
  Start-menu discovery, per-user registry/task, native handshake and OpenAI sign-in.
- User-owned managed OIDC registration and a real app sign-in/renewal; synthetic
  JWT signature and callback fixtures do not configure an external tenant.
- Widget permission revocation and screen-reader/desktop keyboard behavior on
  real provider pages; synthetic two-tab/style/navigation/isolation checks pass.

See [platform details](PLATFORMS.md). No public deployment, store publication,
certificate signing or live logout independence has been performed.
