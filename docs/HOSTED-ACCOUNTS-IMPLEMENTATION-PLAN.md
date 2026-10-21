# MyLimits: simple independent accounts — execution plan

Historical foundation plan, updated 21 October 2026. Superseded by the
[real-provider-first execution plan](INDEPENDENT-ACCOUNTS-FINAL-PLAN.md).
Retained for contracts and earlier acceptance criteria, not as the current work order.

## 1. Exact product contract

Install the browser extension, open MyLimits, and select **+** beside a provider.
Offer two actions:

1. **Use current account**: request the necessary site permission, focus an
   existing provider tab or open one, and detect its signed-in identity. This
   remains local website tracking; it needs no MyLimits login or helper.
2. **Connect another account**: authenticate the MyLimits user if necessary,
   then open a small first-party authorization window using a supported provider
   flow. The user chooses/signs into Personal while Work stays signed into the
   normal browser. Verify identity on the server, ask for an optional alias,
   then show its actual available quotas alongside Work.

Remove provider enable/disable switches. Keep explicit Connect, Reconnect and
Disconnect actions; disconnecting a provider must not delete other connections.
Permission revocation and data deletion remain available in Settings. Do not
remove unrelated alert, privacy or accessibility settings.

The target requires **no local helper, CLI, Node, terminal, token copying or
200 MB download for end users**. Provider consent, MFA and selecting an account
are legitimate sign-in steps: do not promise literally one click for authentication.
A one-time device code is a possible fallback, not the exact requested popup UX;
label that limitation and do not silently substitute it as completion.

Personal may be used on a phone or another laptop. The backend fetches the
provider's account-level readings and the extension shows the latest successful
result. Polling is not instantaneous real time. Website logout must be tested
separately from provider-wide revocation; expired/revoked authorization requires
reconnection. Never promise permanent login.

OpenAI Codex/Work quotas are not every ChatGPT message/image/voice limit. Claude
subscription usage is not Anthropic API credits. Show only actual returned scopes.
Other services retain website tracking; add independent adapters only after proof.

## 2. Honest baseline and reuse

- Existing WXT, React, TypeScript, Zod MV3 extension: reuse it, including provider
  logos, compact popup, account aliases/history, permission and website readers.
- Existing local helper adapters and account-proof diagnostics: reuse normalizers,
  identity isolation and retry logic where appropriate. Do not require their
  installers for this target. Preserve the legacy path under advanced dashboard
  settings until migration is safe; do not silently upload local credentials.
- Existing Fastify/TypeScript/PostgreSQL service supports snapshot sync. In
  `server/src/jobs.ts`, `productionCollectors` is empty. Snapshot sync is not
  independent provider collection. The credential abstraction needs real protected
  storage/KMS integration, not just an environment flag.
- Official hosted probe: OpenAI device-code issuance and cancellation observed;
  Claude loopback callback observed. Neither authenticated anyone or read quotas.
- No hosted production service, registered hosted provider integration, real
  two-account acceptance or exact popup account-selection behavior is proven.

Read HOSTED-ACCOUNTS-TRIAL-PLAN.md for recorded observations and primary sources.
Read ACCOUNT-PROOF.md and MULTI-ACCOUNT-HANDOFF.md only when reusing their code.
Prior local-helper code completion does not establish this hosted product.

## 3. Architecture and trust boundaries

Extension website reader → existing local account store (website mode).
Extension → authenticated MyLimits API → connection/job store → isolated provider
adapter/official runtime → provider quota source (independent mode).

MyLimits authentication identifies the owner of connections; it does not authorize
OpenAI/Claude access. Separate consent and verified provider identity are required.
Keep provider credentials in permitted encrypted server storage or CLI-owned
private profiles with protected encrypted persistence. Never send provider secrets
to the extension. Browser-session and hosted connections must remain distinguishable.

A normal popup shares cookies. Neither a popup, incognito window nor a different
tab inherently proves independent authorization or preservation of Work. Use the
provider's supported account selection/authorization mechanism. Do not invent OAuth
clients, copy cookies, extract CLI caches or implement a generic credential proxy.
If an unmodified CLI is needed on the server, check its hosted use conditions,
run per-connection isolated profiles/processes, and let that CLI own credentials.

## 4. Sequential work packages for Sol 6.1

Use one workstream, no parallel agents. After inspection, implement each available
package; do not repeatedly research all competitors or stop at another plan.
Provider blockers gate provider activation, not unrelated UI or backend work.

### H01 — Baseline and supported-route decisions

Inspect git status/instructions and relevant UI, native service, server auth,
credentials, jobs and diagnostics. Preserve user changes on a new feature branch.
Verify only unresolved official integration facts: hosted eligibility, supported
account selection, callback/device flow, quota source and allowed refresh behavior.
Record each provider as unsupported, experimental, or eligible for private testing,
with dated primary-source evidence and unresolved questions in status.
OpenAI: validate hosted entitlement and device-code versus registered popup route.
Claude: resolve remote callback and permitted monitoring with unmodified official
components; do not invent custom consumer OAuth. Request external registration or
provider approval only if evidence shows it is needed; do not send messages yourself.
Acceptance: provider-specific decisions, never a blanket “multi-account supported.”

### H02 — Connection and lifecycle contracts

Define typed, versioned capabilities/list/start/status/cancel/rename/refresh/
reconnect/disconnect operations and shared validation. Use immutable random
connection IDs plus owner ID, provider, method, verified identity/workspace,
alias, capabilities, auth state, exact quota scope/value/unit/reset, fetchedAt,
providerObservedAt (nullable), nextEligibleAt, stale reason and safe error code.
Keep historical snapshots immutable. Email/nickname alone never establishes identity.
Deduplicate verified identities within the correct owner/provider/workspace/method
scope; explain duplicates without overwriting the first connection.
Use attempt IDs, expiry and generations to reject late login/refresh responses.
Acceptance: cancellation, duplicate and cross-owner tests; schema migration preserves
IDs, nicknames, histories, alerts and prior connection types. No invented zeros.

### H03 — Simplify the interface now

Inspect `src/ui/AccountConnect.tsx`, `Popup.tsx`, `App.tsx`, `OpenAICompanion.tsx`
and their platform messages. Replace provider toggles with + and the two choices.
Focus an existing tab for website mode. Independent mode uses server capabilities:
show “Not available yet” with a short reason when a route is blocked; never route
that choice to the ordinary website and call it independent.
Popup: logo/alias, available quota bars/reset, last update/state, refresh, + and
Full dashboard only. Keep readable text, restrained spacing and responsive width.
Dashboard: sign-in steps, account management, diagnostics, history and settings.
Guide stays removed; existing optional Coming soon widget is outside this work.
Acceptance: keyboard/screen-reader labels, loading/error/cancel/offline states,
small-screen and zoom screenshots; no false connected state when popup closes.
This UI can ship as UI work, but must not be called a completed independent flow.

### H04 — Authenticated backend connection orchestration

Reuse existing API, MyLimits identity and database. Implement owner-scoped
connection attempts, idempotent actions, safe polling/status updates and durable
cancellation. Bind callbacks to owner + attempt + provider, verify state, nonce/
PKCE where applicable, strict redirect allowlists, expiry and one-time consumption.
Do not accept arbitrary callback URLs, upstream hosts or command arguments.
Add provider adapter capabilities; unsupported methods fail closed. Keep fixture
adapters test-only. Never enable production collectors using fictional results.
Acceptance: unauthenticated and cross-tenant access rejected; replay, late callback,
cancel/reconnect/disconnect races and credential-free responses/logs tested.

### H05 — Private secure runtime and deployment package

Prepare reproducible server/worker/database build and operator configuration,
HTTPS callback requirements, MyLimits identity, real KMS/private credential store,
secret rotation, per-connection isolation, bounded processes and cleanup.
Keep encrypted secrets out of snapshots, exports, telemetry and exception text.
Design deletion of provider auth state, worker leases, snapshots and account data;
use documented provider revocation when available and disclose its limits.
Estimate hosting/storage/worker cost with measured assumptions; small client size
moves cost to the service. Define rate/tenant limits and backup/retention policy.
Acceptance: integration tests use real PostgreSQL; operator setup fails clearly if
required security configuration is absent. Prepare private deployment instructions.
Public deployment, purchases, app registration/submission and release need separate
authorization; finish reviewable local artifacts before asking for those actions.

### H06 — OpenAI adapter and exact login proof

Implement only the allowed route identified in H01, using official documented
methods and isolated server-owned auth state where supported. Verify identity after
login and around reads; official runtime owns renewal if used. Handle wrong-account
selection, duplicate A, cancellation, expiry, restart and renewal failure.
Expose actual returned Codex/Work scope, values and reset times, not “all ChatGPT.”
Private live acceptance: normal browser on A, sign into B through official UI,
confirm B independently connected and A still signed in; read both distinct quotas.
A device-code flow must explicitly disclose its extra step and prerequisites.
If unavailable: keep provider disabled, record exact blocker, continue H08–H10.

### H07 — Claude adapter and exact login proof

Use the permitted first-party route established by H01; if unmodified Claude Code
is allowed and suitable, use separate CLAUDE_CONFIG_DIR per connection and an
approved remote sign-in completion mechanism. Reuse /usage parsing only where
current output is validated. No model prompts merely to measure usage.
Prove remote callback completion and identity; a captured loopback URL is not proof.
Apply the same A/B, browser preservation, duplicate, cancellation, expiry and
read-scoping criteria as OpenAI. Test actual current readings, not cached terminal
output. If no supported route exists, expose explicit unavailable status and record
what is required; do not deliver custom OAuth or call the overall goal complete.

### H08 — Collection and truthful freshness

Implement account-level serialization, bounded global/tenant concurrency, durable
jobs, timeout, Retry-After, backoff and jitter; deduplicate manual/automatic refresh.
Do not prescribe aggressive intervals without provider support. Preserve fetchedAt
and prior values on failures; reset-time passage alone does not reset quota to100%.
Only successful provider reads create new snapshots. Store source observation time
separately, if supplied. Reopening the extension requests eligible refresh, shows
cached state immediately, and updates upon success. Hosted polling can continue
independently of the browser subject to service policy/cost; do not promise instant
changes or invent freshness while a worker is down.
Acceptance: offline, throttling, stale, process crash, job replay, disconnect during
read, cross-device changes and per-account failure isolation covered separately.

### H09 — End-to-end browser integration and manual proof

Connect H03 to actual H04 operations. MyLimits login is required only for hosted
connections. Explain cloud storage and consent briefly before first connection.
Show verified account confirmation then alias; allow reconnect and independent
removal. Keep website mode functional without backend/helper; preserve legacy data.
Automate browser/API integration with fictional providers clearly labeled as such.
Maintain the manual matrix below with dated outcome and safe evidence, no secrets.
If user account access is unavailable, finish code/testing and mark live cases
PENDING; never promote adapters to release-ready based on fixtures.

### H10 — Delivery, docs and measured claims

Run appropriate existing checks, build/zip extension, measure actual artifact size,
and ensure end-user ZIP does not bundle helper/CLI/server runtime. Test Chrome and
Brave on Windows; keep browser-specific constraints explicit. Provide short install,
update, rollback and connection instructions, plus operator deployment instructions.
Update existing docs rather than creating duplicate plans; write a final handoff
only when delivering implementation. Commit coherent checkpoints and push with
access; never merge main, force-push or publish automatically.
Acceptance: list IMPLEMENTED, AUTOMATED TESTED, LIVE VERIFIED and STILL BLOCKED
separately; link actual branch/artifact and report actual commands/results.

## 5. Required manual acceptance (each provider, independently)

| Scenario | Passing evidence |
| --- | --- |
| Add B while normal website uses A | Verified distinct B identity; normal browser still A |
| Combined dashboard | A and B each show their own available scoped quotas |
| Use B on another device | B's provider reading changes on eligible refresh; A not overwritten |
| Close provider tabs/browser | Hosted data refreshes under policy; extension catches up on reopen |
| Ordinary website logout | Record actual hosted behavior, not assumptions |
| Global revoke/expired authorization | Honest reconnect state; no fabricated successful refresh |
| Renewal/restart | Actual renewal when possible; persisted identities and safe recovery |
| Cancel/duplicate/wrong account | No orphan successful connection or overwrite of A |
| Disconnect B | B stops refreshing; A remains functional; B credentials cleaned up |
| No helper installed | Entire independently supported flow works in Windows Chrome/Brave |

Record PENDING if not exercised. Overall requested product is complete only when
both requested providers pass the required flow, scope limitations are visible,
and the no-helper experience is exercised. A partial OpenAI release is an explicit
scope decision, not fulfillment of the two-provider request.

## 6. Verification and progress discipline

Use Node24+, existing lockfiles. Relevant root scripts: `typecheck`, `test`,
`test:companion`, `test:account-proof`, `test:hosted-probe`, `build`, `test:browser`,
`zip`. Server scripts: `typecheck`, `test`, `test:web`, `test:transport` (run from
server; inspect environment/database requirements first). Do not call skipped
checks passed or treat fixture coverage as live provider proof.

After each H task, update IMPLEMENTATION-STATUS.md: state, changed files, exact
checks/results, decisions, blocker, next runnable action. If blocked on a provider,
continue other tasks and keep its production capability off. Resume from that ledger
without repeating research. Keep all maintained project Markdown directly in docs/.

## 7. Documentation consolidation

Removed superseded V2/V3 plans, phase handoffs, old build status, old roadmap and
local-integration duplicate implementation/checklist documents. Git retains them
at published checkpoint `73799f592b43a8aeac89776700239a42a06056b8`; historical links
now point there. Keep operational install/privacy/support/architecture docs and
unique research/probe evidence. Historical docs are references, not active tasks.
