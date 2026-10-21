# Hosted account foundation handoff — 3.3 preview

22 October 2026 (Asia/Calcutta). Branch: `feature/hosted-connections`.
No main merge, release, provider registration or public deployment.

## Verdict

**The full requested installer-free OpenAI + Claude experience is NOT complete.**
H01–H05 and H08–H10 available foundation work is implemented. H06/OpenAI and
H07/Claude remain blocked on supported hosted provider routes and actual-account
acceptance. The app must show Not available yet for both production providers.
No user should download the legacy200MB helper to test this preview.

## What users can see now

- Provider + buttons replace provider on/off switches.
- Use current account focuses an existing website tab or opens one, requests
  optional site permission and confirms detection. It does not create a separate
  account session. Existing aliases, alerts and history remain intact.
- Connect another account checks hosted capabilities. Unsupported providers do
  not open the existing website login or claim success.
- Legacy helper controls move to advanced Settings. Explicit website disconnect
  and permission revocation remain; notification/privacy controls are preserved.
- Popup retains logos, aliases, scoped quota bars/reset/freshness and dashboard
  access. Hosted readings use the same account view when a supported adapter exists.
  Guide remains removed. The optional Coming soon widget is unchanged.

## Implemented source and trust boundaries

- Shared strict contracts (`src/core/hosted-contracts.ts`), immutable hosted IDs,
  additive projection (`src/core/hosted.ts`) and background client (`src/platform/hosted.ts`).
- MyLimits pairing authenticates the owner independently of provider sign-in.
  Hosted-only pairing does not enable website snapshot uploads. Provider secrets
  never enter extension messages/storage. Safe pending IDs can resume after view
  closure; auth URL/state/code are not persisted. Account-ID confirmation comes
  from server-verified identity and is hidden by privacy mode.
- Durable owner-scoped attempts and connections, exact identity/workspace duplicate
  checks, request idempotency, bounded attempts, cancellation/expiry, wrong-account
  reconnect rejection and generation fencing (`server/src/hosted.ts`). No generic
  external callback relay or provider-token upload endpoint exists. Real drivers
  must implement their provider-supported callback, nonce/PKCE and verified reads.
- Vault-transit wrapping behind the existing AES-GCM envelope credential contract;
  private token-file checks, authenticated binding, redacted errors and no redirects.
  Actual Vault deployment/policy/rotation remains an operator acceptance item.
- Durable hosted jobs: per-account serialization, global4/owner2 concurrent leases,
  provider30/min budget ceiling, adapter interval with minimum60s safety floor,
  cooldown/Retry-After/backoff/jitter, hard request timeout, bounded crash retries,
  timestamp preservation and late-response rejection. These ceilings do not claim
  a provider permits that rate; approved adapters must use their actual limits.
- Disconnect removes stored credentials and attempts supported adapter revocation;
  unsupported/failed revocation is explicitly unconfirmed. Forget removes hosted
  attempts/readings/jobs/credentials/connection without touching other accounts.
- Additive migrations006–008 preserve existing local and snapshot-sync IDs/history.
  Hosted history retains up to5000 readings/connection and30 days plus latest.
- Non-root read-only private operator image/Compose API+worker+PostgreSQL package.
  No provider CLI/runtime is bundled into this server image yet; those routes remain
  blocked. Operator deployment is in [SERVER-SETUP.md](SERVER-SETUP.md).

## Actual verification

| Check | Actual result |
| --- | --- |
| Root and server TypeScript | Passed |
| Core unit suite | 109 passed |
| PostgreSQL API/job/credential suite | 43 passed |
| Browser suite, Linux Playwright Chromium | 31 passed |
| Actual Chromium → HTTP API → PostgreSQL transport | 2 passed; fictional providers only |
| Legacy native helper suite | 20 legacy +18 integrated connection tests passed |
| Account-proof regressions | 30 passed; fictional accounts |
| Hosted-probe regressions | 7 passed; no live account authentication |
| Responsive server dashboard | 1 real-DB/browser test passed |
| Chrome/Edge/Firefox builds and package contracts | Passed; optional grants preserved |
| Private Docker image | Built; API and worker started with read-only filesystem |
| Image health/auth smoke | /health200, unavailable capabilities200, unauthenticated hosted list401 |
| Public hosting, real Vault/OIDC and actual provider accounts | Not performed |
| Windows Chrome/Brave manual acceptance | PENDING |

Initial execution issues were resolved: restrictive sandbox blocked subprocess/TCP
checks; system Chromium did not load extensions; the matching Playwright Chromium
worked. An obsolete toggle selector and an asynchronous disconnect assertion were
corrected. The first server dashboard invocation omitted its database setting;
rerun with the isolated test DB passed. None of these are provider-account proof.

The transport provider is injected only in test environment; a production process
rejects fixture drivers. Tests simulate verified identities, never contact provider
accounts, and do not prove that real sign-in preserves the normal browser session.

Idle container snapshot on this test host: API82.68MiB, worker90.45MiB, with **zero
active providers/accounts**. This is not an active-runtime capacity or pricing
estimate. No provider refresh latency/memory was measured.

## Packaged extension

Local file: `.output/mylimits-3.3.0-chrome.zip`.
Size: **306395 bytes** (about306KB decimal /299KiB).
SHA-256: `756ef7c86087bb1595815ba9383bacae51a0ba6f7243e83650c8db78242f4325`.
ZIP inspected: no helper, CLI executables, server runtime, node_modules, PEM or key
files. No production service URL is configured. [Windows install/test steps](INSTALL.md).
CI builds packages for the pushed feature branch; a queued run is not a passed run.
Do not confuse GitHub's source ZIP with the built extension ZIP.

## Real provider acceptance matrix — all pending

| Check | OpenAI | Claude |
| --- | --- | --- |
| Permitted hosted integration and exact login mechanism | BLOCKED | BLOCKED |
| Add B while normal website stays on A | PENDING | PENDING |
| Verify A/B identities and actual scoped quotas together | PENDING | PENDING |
| Other-device usage changes the matching reading | PENDING | PENDING |
| Provider tabs closed and browser reopened | PENDING | PENDING |
| Ordinary website logout | PENDING | PENDING |
| Provider-wide revocation/expiry/reconnect | PENDING | PENDING |
| Actual credential renewal and worker restart | PENDING | PENDING |
| Cancel/duplicate/wrong-account sign-in | PENDING | PENDING |
| Disconnect B leaves A working | PENDING | PENDING |
| No helper installed on Windows Chrome/Brave | PENDING | PENDING |

OpenAI's prior official device-code initiation/cancellation was observed without
signing in. Hosted entitlement, exact account selection and quota reads are not
established. Claude's unmodified CLI has documented hosted conditions, but tested
callback was loopback; automatic remote completion and applicable monitoring route
remain unresolved. See [trial evidence](HOSTED-ACCOUNTS-TRIAL-PLAN.md). No custom OAuth,
cookie copying or CLI-token extraction was added to bypass those gaps.

## Next executable work

Resume H06/H07 from the [active plan](HOSTED-ACCOUNTS-IMPLEMENTATION-PLAN.md), not old
helper checklists. Establish each provider's supported hosted route/registration,
then implement and privately exercise its real driver through this foundation.
Prepare a reviewable secure deployment before requesting any external hosting or
provider submission action. User completes first-party sign-in; never request
passwords, cookies or tokens in chat. Keep unsupported providers unavailable.
Do not call this release-ready until both requested providers and the no-helper
Windows user journey pass the required acceptance matrix.

## Published checkpoint

Published source: `195ac07938e40da46235aa985dc02fd6cd61675b` on
`feature/hosted-connections`; tree `05b94ec9ea2fa81246b0e51700b09987ab6db642`.
Matching local checkpoint: `2966719`. Commit SHAs differ because publication used
GitHub Git-data tools; source trees match. Do not force-push/reset to reconcile
those histories. Main and the documentation branch are unchanged.

[CI run39661885089](https://github.com/voiddev011/mylimits/actions/runs/39661885089)
was queued when checked. No CI success is claimed here. The verification table
above records actual local results. This documentation follow-up changes no
production source or packaged extension bytes.
