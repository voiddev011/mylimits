# Phase 2 — Expansion and connected services

Budget: **100 relative effort points**, ten work packages. Start only after the
Phase 1 handoff and the user's instruction to begin this phase. Read
[START-HERE](START-HERE.md), [master contracts](V2-IMPLEMENTATION-PLAN.md),
[status](IMPLEMENTATION-STATUS.md), and the Phase 1 handoff produced at execution.

## Outcome and boundary

Expand provider coverage, history/pacing, guidance and an optional page widget.
Offer optional snapshot sync and a phone-readable dashboard. Enable independent
cloud collection only where provider authorization and quota access pass the
hosted feasibility gate. Improve platform/native distribution without making a
companion compulsory. Preserve the fully useful local-only product.

No provider credentials, cloud account, vendor subscription or public deployment
is assumed available. Develop/test runnable service code with isolated synthetic
fixtures; do not claim a configured production provider when only its test seam
exists. Explicitly record external registration, signing and live-check blockers.

## Execution order and effort

| ID | Work package | Points | Depends on |
| --- | --- | ---: | --- |
| P2-01 | Hosted authorization and quota feasibility | 8 | Phase 1 handoff |
| P2-02 | Optional cloud identity, tenancy and snapshot API | 12 | P2-01 |
| P2-03 | Gated collector, secrets and renewal jobs | 12 | P2-01, P2-02 |
| P2-04 | Opt-in sync and phone-readable dashboard | 8 | P2-02, P2-03 |
| P2-05 | Three prioritized provider quota integrations | 12 | Phase 1 adapters; P2-01 decisions |
| P2-06 | Rich history, reset timeline and pacing | 10 | Phase 1 history; P2-04, P2-05 |
| P2-07 | Local task/model guidance and prompt utilities | 10 | P2-05, P2-06 |
| P2-08 | Optional in-page usage widget | 8 | Phase 1 UI; P2-05 |
| P2-09 | Platform compatibility and native distribution | 10 | Phase 1 packaging; P2-03 decisions |
| P2-10 | End-to-end hardening and release handoff | 10 | P2-01 through P2-09 |
| **Total** | | **100** | |

Keep one workstream. A blocked independent-collector gate does not block useful
snapshot synchronization: document the alternative mode and keep independent
collection unavailable. Do not fill the gate with a fake production connector.
Record any material scope/estimate change rather than declaring identical work
or a successful live connection without evidence.

## P2-01 — Hosted authorization and quota feasibility (8 points)

**Read:** Phase 1 capability matrix and handoff, current first-party provider
authorization/deployment documentation, existing Codex companion boundaries and
master sections 2–3. Recheck time-sensitive provider access conditions.

**Implement the proof only where access is available:**

1. For the best candidate, establish the supported application/deployment type,
   allowed registration, exact quota resource and required scopes. Identity or
   inference access alone is not sufficient. Record whether a self-hosted user
   environment differs from a multi-user hosted offering.
2. Use a separately authorized test connection, not an invisible copy of the
   current browser session. Validate the account/workspace and quota pool.
3. Record tab closure, browser restart, other-device usage, ordinary website
   logout, collector revocation, global logout where offered, expiry/renewal and
   behavior from the intended network/deployment context.
4. Record whether a remote browser is permitted/useful only if lightweight
   supported collection is unavailable. Do not add verification bypasses or an
   automatic password replay service.
5. Add the result and sanitized evidence references to
   `docs/PROVIDER-CAPABILITIES.md`; record an architecture decision in the status.

**Acceptance:** supported cloud collector and exact limitations are identified,
or a concrete unsupported/unverified decision is recorded. Missing provider
registration is an external blocker, not something mock tests can satisfy.
Existing local flows must not be reclassified as independent cloud access.

## P2-02 — Optional cloud identity, tenancy and snapshot API (12 points)

**Suggested files:** a separate `server/` package, SQL migrations, Zod contracts
shared with the extension only where needed, server tests and a local setup doc
under `docs/`. Do not introduce a monorepo framework.

**Implement:** TypeScript/Fastify API with PostgreSQL, environment-validated
configuration, a managed-auth/OIDC integration boundary and tenant-owned tables
for device registrations, accounts, connections, preferences, snapshots and jobs.
Never trust an owner/tenant ID submitted by the client; derive it from validated
application authentication. Provider sign-in is not the MyLimits session.

Initial routes or equivalent:

```text
GET    /v1/accounts
GET    /v1/snapshots?accountId=...&cursor=...&limit=...
POST   /v1/snapshots/batch
PATCH  /v1/preferences              # expected revision required
POST   /v1/connections/:id/refresh   # enqueue/coalesce, not unrestricted fetch
DELETE /v1/connections/:id
DELETE /v1/account-data             # explicit authenticated deletion
```

Validate body/page sizes, schemas, UTC times, clock skew, origins where relevant
and rate budgets. Snapshot uploads retain original observation time and source;
receipt by our server is not proof of a provider reading. Idempotency keys are
tenant/device/snapshot scoped. Account mappings cannot be established merely
because browser-installation hashes happen to match. Link only through verified
owner/provider identity or explicit safe source mapping.

**Tests:** two users cannot read/change/delete each other's accounts, snapshots
or connections; authentication failures; forged owner fields; invalid callback
ownership; malformed/oversized input; paging; duplicate upload; old snapshots;
preference revision conflict; deletion; unconfigured auth fails closed.

**Acceptance:** locally runnable authenticated snapshot API and repeatable DB
migrations. Production identity uses a real configured verifier; development
fixtures never silently authorize requests outside the test environment. Vendor
selection/deployment remains distinct from runnable service implementation.

## P2-03 — Gated collector, secrets and renewal jobs (12 points)

**Suggested files:** server connection/OAuth handlers, provider collectors,
credential store, durable jobs, generation fencing and focused server tests.

**Implement:** a PostgreSQL-backed lease/queue with bounded jobs/retries, one
refresh/renewal at a time per connection and provider-wide budgets. A successful
job validates account/workspace and meter scope before persisting a snapshot.
Retries never duplicate events or accept data from an old connection generation.

Provider authorization uses the permitted flow, short-lived state bound to the
initiating user, PKCE/nonce and exact callback validation as appropriate. Rotate
refresh tokens atomically; a stale worker cannot overwrite newer credentials.
Credential envelopes use an authenticated encryption/KMS boundary and tenant
binding. Workers can decrypt only authorized credential records; snapshots,
logs, queues and UI responses contain opaque references instead of secrets.
Use a test-only fake KMS/issuer, never a hard-coded production encryption key.

Disconnect cancels collection, advances its generation and attempts supported
provider revocation. Distinguish local disconnection from confirmed provider
revocation; any failed cleanup has a bounded retry/status without claiming
success. Rejected authorization pauses jobs and exposes a reconnect action.

**If P2-01 did not pass:** keep independent collection disabled, allow a clearly
named snapshot-only mode and test the job/credential interfaces with fixtures.
Do not expose an enabled cloud-login button or claim that generic infrastructure
has solved the provider integration. Record the remaining blocked collector work.

**Tests:** lease expiry; worker crash/retry; duplicate refresh; token rotation
race; throttling; network failure; revoked grant; stale result after disconnect;
tenant-bound decryption; plaintext redaction; no old job recreates deleted data.

**Acceptance:** production-enabled collectors correspond only to passed
capabilities. Any server-held authorization is explicitly opt-in and described
in privacy documentation; do not describe a credential-decrypting service as
zero-knowledge or as snapshot-only sync.

## P2-04 — Opt-in sync and phone-readable dashboard (8 points)

**Likely files:** extension sync transport/preferences, shared snapshot mapper,
responsive React web view alongside the optional server and its auth entrypoint.

**Implement:** an explicit cloud opt-in/login, device registration, bounded
batched snapshot upload, revisioned preference sync and account/source mapping.
Website credentials and native bridge secrets never enter snapshot sync.
Keeping local-only mode off the cloud path must require no MyLimits account.

Persist queue progress; retain `observedAt` separately from server receipt.
Retry with idempotency and bounded backoff. Handle account removal and device
revocation so stale queued uploads cannot resurrect deleted data. Describe
account-merge/preference conflicts explicitly; do not silently merge identities
or erase nicknames using last-writer timestamps from unsynchronized devices.

Provide a small responsive read-focused dashboard using the same account/meter
semantics, meaningful age/status and sign-out. On mobile, a last reading remains
a last reading. Independent hosted collection is shown only when actually
active. Use authenticated fetch first; SSE is optional for active web sessions.
The extension must not depend on a permanently connected service worker.

**Tests:** offline queues and reconnect; repeated/old upload; conflicting edits;
revoked device; deleted account tombstone; local-only no requests; tenant isolation;
responsive phone layout; missing/stale versus active collector status.

**Acceptance:** cross-device viewing works in the configured local/test service;
no claim that sync itself collects fresh quota after a website logout. Do not
publish a public site or purchase hosting as part of ordinary local verification.

## P2-05 — Three prioritized provider quota integrations (12 points)

**Likely files:** provider catalog, per-provider transports/parsers, sanitized
fixtures, runtime messages and provider capability/support docs.

Target **three additional useful quota integrations**, prioritizing Grok,
Perplexity and Gemini. If a candidate lacks a usable quota resource, record the
reason and choose the next feasible Cursor/Copilot/coding-plan candidate. Do not
silently substitute a different product's API budget for a consumer quota.

For each: establish fixed hosts and optional grants; account/workspace identity;
unit and scope; actual reset semantics; tab requirements; account-wide versus
device scope; authentication/expiry; and response-shape validation. Implement
read-only adapters through the shared contract, with supported contexts rather
than arbitrary injected requests. Existing local activity remains distinct.

Test normal/missing/unknown quota, zero, scope/model windows, changed account,
reset formats, permissions, 401/403/429 and malformed responses. One broken
connector cannot stop others. Custom provider imports must not introduce remote
executable code or unconstrained credential-bearing URL requests.

**Acceptance:** deliver viable implementations and their actual evidence, aiming
for three integrations rather than three placeholder cards. If live checks or
the quota source are blocked, state exactly which integration remains incomplete.
Existing coding/native/API quotas are labeled with their true product scope.

## P2-06 — Rich history, reset timeline and pacing (10 points)

**Likely files:** history queries/downsampling, new pure insight selectors,
dashboard History/Overview components and export tests.

**Implement:** useful per-account/window charts, comparison filters, a reset
timeline, optional 30/90-day retention and downsampling with gaps preserved.
Do not interpolate through missing collection periods or combine reset windows.
Use lightweight accessible chart rendering; add a library only with a concrete
benefit and justified bundle impact.

Forecast from enough fresh samples for the same meter/window, using a documented
minimum sample count/time span and a robust rate estimate. Exclude resets,
source changes, negative deltas from renewal and clock anomalies. Report a range
or insufficient data; no exact future cutoff claim. Model-specific messages-left
needs actual relevant evidence and must remain unavailable when it cannot be
derived reliably. Percent remaining alone is insufficient.

Keep subscription fees, provider-reported API spend and local token cost estimates
separate, with currency/source. Account comparison respects task/model quota
applicability rather than ranking unrelated percentages as equivalent budgets.

**Tests:** reset boundaries; sparse or bursty samples; identical timestamps;
source changes; stale reads; daylight-saving display; retention/downsampling;
confidence suppression; export formatting. **Acceptance:** insights show their
basis, never turn sparse historical snapshots into fabricated exact usage.

## P2-07 — Local task/model guidance and prompt utilities (10 points)

**Likely files:** a pure rules/metadata module, dated provider capability data,
dashboard Guide and optional account recommendation components.

**Implement:** task selector (coding, writing, research, extraction, reasoning),
speed/quality/usage preferences and explainable recommendations using actual
applicable supported model capabilities, fresh limits and reset/pacing context.
Metadata has an update date; recommendations do not claim benchmark certainty.
Stale/unknown accounts are excluded or clearly explained, not silently favored.

Add local context/attachment/conciseness tips, prompt templates and analysis of
text explicitly supplied by the user. The first version needs no paid inference
API, hidden provider requests or silent conversation reading. Do not claim fixed
token savings from a concise-output toggle or universally fixed model ratios.

Offer a user-triggered conversation handoff helper only with explicit selection
and content preview; manual copy/download is a valid first implementation. Show
what leaves the current app and where. Generating a recap or sending to another
AI is a separate opt-in action, not an automatic response to low quota.

**Tests:** task/model applicability, conflicting preferences, unknown metadata,
stale source, excluded account, reset-related suggestion, deterministic rule
explanations, private text never sent by local guide, explicit handoff preview.

**Acceptance:** Guide adds useful decisions and education without cluttering the
popup or pretending estimates are reported quota. No AI calls are required for
core functionality; any optional inference integration remains separately gated.

## P2-08 — Optional in-page usage widget (8 points)

**Likely files:** dedicated content entrypoint, shared public view-model formatting,
widget styles/components, optional permission registration and browser tests.

**Implement:** a small provider/account usage strip, collapse/hide, drag or safe
position choices, reset/status text and open-dashboard action. Widget is off by
default and only runs on explicitly enabled provider origins. Use style isolation
and narrow DOM placement; reading a chat's contents is not necessary to show quota.

Handle single-page navigation, remounts, detached anchors and multiple tabs
without duplicate widgets or listeners. Disabling removes injected UI and stops
updates. Do not request all-site access, mutate the composer or trigger provider
generation. Page-side events cannot invoke privileged extension actions; feed
the widget only validated, deliberately public readings.

**Tests:** toggle off/on, SPA navigation, disappearing anchor, dark/light page,
keyboard/contrast, collapse/position persistence, two tabs, stale snapshot,
permission removal and unsupported site. Test page styles cannot collapse the
extension UI or leak private runtime messages.

**Acceptance:** a small optional monitoring aid; all core tracking continues
without the widget, and exact quota support remains determined by its connector.

## P2-09 — Platform compatibility and native distribution (10 points)

**Likely files:** WXT manifest/build targets, browser capability wrappers,
`companion/` installation/packaging, CI and install documentation.

**Implement:** actual Chrome/Brave Windows acceptance, Edge compatibility checks
and a Firefox build with appropriate fallbacks for missing side-panel/native APIs.
Do not report Firefox as supported just because a bundle builds; explicitly
document unverified browser/provider combinations.

Preserve optional native bridge authentication and credential-free snapshots.
Package a normal Windows companion installer/start-menu flow that registers the
correct per-user native host and startup entry and offers uninstall. Avoid
requiring users to copy extension IDs/commands when distribution IDs can be
configured. Keep Linux setup working; do not promise macOS native support without
implementation/verification. An installer may auto-launch a registered host;
the extension cannot silently install native executables.

Use release assets and checksums; production code signing is a separate external
certificate prerequisite. An unsigned development artifact is labeled accordingly,
not represented as a signed consumer release. No purchase of certificates or
public store publication is implied by this implementation task.

**Tests:** no native API, missing host, permission revoked, successful fixture
handshake, wrong bridge secret/origin, clean install/update/uninstall on available
OS, browser-specific host registration. **Acceptance:** basic extension works
without native installation; each optional native/platform claim has evidence.

## P2-10 — End-to-end hardening and release handoff (10 points)

**Implement and verify:**

1. Run the extension phase gate plus server unit/API/database integration checks
   where implemented. Add server verification to CI without uploading credentials
   or requiring real customer accounts.
2. Exercise local-only, snapshot-sync-only, independent-cloud-collector (where
   passed), optional native and unavailable-provider modes. None can silently
   switch authentication/storage mode or block basic offline/cached views.
3. Verify migration from the original V1 and Phase 1 data; no duplicate accounts,
   reset alerts, history samples or deleted-account resurrection during sync.
4. Verify cloud ownership, credential redaction, callback binding, rotation,
   disconnect races, deletion and data retention. Document worker-decryptable
   authorization separately from credential-free snapshot sync.
5. Measure bundle size, popup responsiveness and background request/job counts.
   At five-minute polling, one refresh is 288 cycles/day/connection before retries;
   several upstream requests per refresh multiply that. Bound provider concurrency,
   retries, retention and hosted-browser resource use before a real rollout.
6. Update all user/developer/privacy/provider documents under `docs/` to actual
   behavior. Label actual live/OS results and external blockers. Keep maintained
   product instructions distinct from historical research claims.
7. Produce build artifacts and `docs/PHASE-2-HANDOFF.md` with commit, tests,
   install/run/configuration instructions, provider matrix, operational limits,
   unconfigured cloud prerequisites and remaining work. Commit/push scoped work.

**Final gate:** usable local product plus implemented opt-in features; no
universal logout guarantee; no fabricated live verification; accurate platform
and provider scope; all planned code checks pass or are explicitly blocked with
reproduction details. Public deployment, paid resources, signing and provider
partnership submissions remain separate concrete release actions.
