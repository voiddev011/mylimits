# Provider capabilities — Phase 1

> Historical scope/evidence reference. 3.4 adds Desktop + integration and explicit
> confirmation for the existing official adapters, with no newly live-verified
> provider capability. See [the current handoff](DESKTOP-ACCOUNTS-HANDOFF.md).
> OpenAI remains Codex-scoped; Claude /usage is experimental and its freshness,
> logout/renewal and Windows A/B isolation still require real account acceptance.

Checked: 15 October 2026. Evidence is code/documentation plus fictional fixtures;
no real signed-in provider account is available in this environment. A successful
fixture test never establishes live quota access or survival of website logout.

Implemented build: **2.0.0 Phase 1 preview**, branch `v2/phase-1`.
Evidence: production Chromium fixtures, pure domain/parser tests and native
service fixtures. The [handoff](https://github.com/voiddev011/mylimits/blob/73799f592b43a8aeac89776700239a42a06056b8/docs/PHASE-1-HANDOFF.md) lists exact commands/results.
Runtime connection kinds remain independent; merely having a `cloud` type does
not make cloud collection available.

| Provider / source | Quota scope | Tab requirement | Account-wide | Website logout / renewal | Multiple live accounts | Hosted |
| --- | --- | --- | --- | --- | --- | --- |
| Claude website | Reported subscription/workspace windows where returned | Background first; existing permitted tab fallback | Unverified live; intended provider account/workspace reading | Session-bound; logout independence unsupported by this connection | One current website session; remembered accounts retained | Unverified; not implemented |
| ChatGPT website | Work/Codex and code-review windows when returned; not ordinary chat limits | Background first; existing permitted tab fallback | Unverified live; intended provider-reported pool | Current website session needed to obtain transient bearer | One current website session; remembered accounts retained | Unverified; not implemented |
| OpenAI optional companion | Returned Codex App Server buckets | No website tab needed by design | Unverified live | Separate native authorization; actual logout/renewal behavior unverified | Isolated native profiles implemented; live verification pending | Not implemented; local support does not establish hosted eligibility |
| Gemini browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |
| Grok browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |
| Perplexity browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |

## Evidence and release boundaries

- Existing website adapters use exact HTTPS provider origins and request-local
  authentication. Claude selects a workspace and reads its usage; ChatGPT reads
  the website session and Work/Codex usage response. Internal interfaces are not
  stable public contracts. Fixture evidence is separate from a live acceptance.
- [Official Codex App Server](https://developers.openai.com/codex/app-server/)
  documents rate-limit reads, not a universal consumer ChatGPT quota endpoint.
- [OpenAI sign-in overview](https://developers.openai.com/siwc/token-sharing-open-source)
  distinguishes local/open-source plan integration from remotely hosted offerings.
  It does not establish that a MyLimits hosted quota reader is authorized.
- Tab closure, browser restart, activity elsewhere, website logout, collector
  revocation and global logout must be recorded separately for each connection.
- Actual Windows Chrome/Brave popup scaling, native host launch and provider
  behavior remain manual acceptance checks. No passwords/tokens are requested.

Phase 1 retains the current source scope. Additional providers, new independent
grants and hosted collection belong to Phase 2, which has not started.

## Capability declarations

Values below describe this connection method, not all possible provider tools.
`unverified` means no qualifying live evidence here; it must not be advertised
as supported. Checked **15 October 2026**; evidence **code + fixture** unless
the linked provider documentation is explicitly cited above.

| Connection kind / source | Tab-independent quota | Account-wide quota | Independent authorization | Renewal / website logout independence | Hosted deployment |
| --- | --- | --- | --- | --- | --- |
| Website / Claude | unverified | unverified | unsupported (session-bound implementation) | unsupported (depends on browser session) | unsupported in Phase 1 |
| Website / ChatGPT Work-Codex | unverified | unverified | unsupported (session-bound implementation) | unsupported (depends on browser session) | unsupported in Phase 1 |
| Companion / OpenAI | unverified live; fixture transport needs no tab | unverified | unverified live; isolated official sign-in path implemented | unverified | unverified, not implemented |
| Website / Gemini-Grok-Perplexity observer | unsupported (no quota reader) | unsupported | unsupported | unsupported | unsupported in Phase 1 |

Claude workspace selection now uses validated membership choices; the legacy
first-eligible default is used only when no explicit workspace is selected.
Source generations, independent remembered accounts, denied access and cold
native restart are fixture-tested. Ordinary logout, native revocation, global
logout, other-device usage and actual expiry/renewal remain separate pending
checks for every provider/source. No support level changed merely because the
interface or schema was upgraded.

## Phase 2 hosted gate — 15 October 2026

P2-01 reviewed current first-party OpenAI App Server/SIWC and Google/xAI/Perplexity
API documentation. **No independently hosted collector passed.** Hosted OAuth
registration, appropriate quota scopes and an owner-authorized test account are
not configured. Consumer quotas cannot be replaced by these products' API limits.
See [HOSTED-FEASIBILITY.md](IMPLEMENTATION-HISTORY.md) for evidence, per-case pending
checks and the snapshot-sync-only decision. Local/companion support levels above
are unchanged. No provider password/cookie/authentication was uploaded.

## Phase 2 website readers — implementation evidence

The current Phase 2 branch adds these **fixture-tested, live-unverified prototypes**.
No scope here inherits independent hosted authorization from snapshot sync.

| Source | Identity / quota resource | Scope / missing data | Tab / logout | Evidence |
| --- | --- | --- | --- | --- |
| Grok website quota mode | Unambiguous subscriptions.xaiUserId; fixed rate-limits POST | Grok 4 default-mode requests; actual remaining/total; rolling length does not establish reset time | Background first / existing tab fallback; session-bound | Published protocol/model sources + synthetic parser/identity tests; real plans pending |
| Perplexity website quota mode | Signed-in session user.id; rate-limit/all | Returned remaining Pro/Research/Labs/Agentic counts; no fabricated total, percentage or reset | Background first / existing tab fallback; session-bound | Published source + synthetic fixtures; live access pending |
| Cursor website | auth/me sub; usage-summary | Included coding-plan/model pools and on-demand USD spend; not consumer chat or subscription fee | Background first / existing tab fallback; session-bound | Published response models + fixtures; live account/plan validation pending |
| Gemini website | Existing local observer only | Consumer quota/account binding still unverified; no CLI/API budget substitution | Existing page required; no independent tracking | Local-observation fixtures only |

Grok/Perplexity keep an explicit activity-only mode. Upgraded existing browser-only
records retain that mode until the user chooses quota mode. Cursor adds a disabled
source on V1/Phase 1 upgrade; no extra host access is granted automatically.
Readers validate identity before and after a quota response to reject account
changes mid-read. Scope, zero/unknown and partial count/spend data stay distinct.
See [source/selection notes](PROVIDER-CAPABILITIES.md). All real-device,
website logout, renewal and actual plan comparisons remain pending per source.

## Historical website integration notes

These are earlier interface/source observations, not fresh live acceptance.


Checked 15 October 2026. Sources describe interfaces, not MyLimits live acceptance.
No authenticated provider requests were made during research; no credentials copied.

## Selected scope

- **Grok website:** source-backed `/rest/subscriptions` identity (`xaiUserId`) and
  `/rest/rate-limits` read-only POST. Require one unambiguous account ID across
  returned subscriptions before publishing a quota. A rolling window length is
  not an actual reset timestamp; reset remains unknown when omitted.
- **Perplexity website:** `/api/auth/session` requires a signed-in `user.id`, then
  `/rest/rate-limit/all` reports remaining Pro/Research/Labs/Agentic counts.
  Missing totals/reset times remain unknown; never guess a percentage or cap.
- **Cursor website (coding-plan fallback):** `/api/auth/me` stable subject and
  `/api/usage-summary` included/on-demand usage. Report true coding-plan scope,
  cents-to-USD values, returned billing window and separate reported percentages.
  Never average unrelated Auto/API percentages or equate plan fees to spend.

Gemini's quota RPC has source evidence, but stable consumer account binding and
live response semantics are not verified here. Keep its existing local activity
source. Code Assist/CLI/Antigravity/API budgets are distinct products and are not
substituted as Gemini app quotas. Cursor is the explicitly named alternative.

## Source references

- [TokenYou Grok adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/grok.js)
- [TokenYou Perplexity adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/perplexity.js)
- [TokenYou Gemini adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/gemini.js)
- [Grok MCP subscription payload](https://github.com/Hirasawa69/grok-mcp/blob/main/src/models/subscriptions.rs)
- [Grok MCP fixed client routes](https://github.com/Hirasawa69/grok-mcp/blob/main/src/client/mod.rs)
- [Grok MCP authentication check](https://github.com/Hirasawa69/grok-mcp/blob/main/src/main.rs)
- [Perplexity session evidence](https://github.com/mvanhorn/agent-tincan/blob/main/extension/README.md)
- [CodexBar Cursor sources](https://github.com/steipete/CodexBar/blob/main/docs/cursor.md)
- [CodexBar Cursor response models](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Cursor/CursorStatusProbe.swift)
- [CodexBar Gemini scope/migration notes](https://github.com/steipete/CodexBar/blob/main/docs/gemini.md)

Implementation is original MyLimits TypeScript with strict identity checks,
validated numeric fields, explicit evidence/scope, transient authentication,
generation fencing and sanitized synthetic tests. No source project was copied
wholesale. Current user/account/plan behavior, tab closure, other-device usage,
logout and renewal require owner-authorized live tests and remain pending.
