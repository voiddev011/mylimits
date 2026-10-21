# Independent accounts — active execution plan

22 October 2026. Branch: `feature/independent-provider-proof`.
**Feature incomplete. No production OpenAI or Claude hosted connection exists.**
This supersedes the H01–H10 execution order, not its useful contracts or evidence.

## Product acceptance

Install extension → provider **+** → **Use current browser account** or
**Connect another account** → small official sign-in window → verified provider
identity → alias → combined independently refreshed quotas. Adding B must leave
the normal browser signed into A. Users install no helper/CLI and copy no tokens,
cookies or authorization codes. The operator runs the backend. Website detection
remains separate; saved readings never imply independent authorization.

## Inspected reusable code

| Component | Existing implementation | Missing for the actual feature |
| --- | --- | --- |
| Extension | `AccountConnect.tsx`, `HostedAccounts.tsx`, compact popup, dashboard, logos, aliases/history | Real provider authorization supplied by backend |
| Background | `src/platform/hosted.ts`, pairing and strict message contracts | A supported provider URL/callback and actual completion |
| Service | `server/src/hosted.ts`, owner-scoped attempts, identity/workspace dedupe, cancellation/generations | Production provider drivers; registry is empty |
| Credentials/jobs | AES envelope boundary, Vault transit, PostgreSQL jobs, cooldown and dated readings | Permitted provider credentials/runtime; live renewal and reads |
| Proof tooling | `companion/proof/`, official App Server and isolated Claude diagnostic | Hosted eligibility, automatic remote completion, verified immutable identities and two-account live evidence |
| Packaging | Small extension ZIP and operator API/worker image | Approved provider software/configuration and deployed private test service |

There is no missing UI setting that enables the empty production driver map.
The current hosted contract only implements popup drivers. Device-code is a
schema possibility, not an implemented hosted route. Its user code is a distinct
UX and cannot silently replace the requested automatic callback.

## Execute sequentially

1. **Audit/checklist** — inspect code/instructions, preserve changes, branch,
   replace active plan/status. Do not reimplement the foundation.
2. **OpenAI route decision** — verify hosted eligibility, registration, allowed
   redirects, account selection, immutable identity, actual quota source, renewal
   and revocation. Check official managed App Server as a separate candidate.
   Prepare provider application requirements if needed. No private-client reuse.
3. **OpenAI real proof** — implement the supported route only after its contract
   is established; sign in user-assisted, verify identity and fetch real quota.
   Then prove A/B isolation. No further feature polish before this gate.
4. **Claude real proof** — assess unmodified hosted Claude Code independently;
   resolve automatic remote sign-in and permitted quota-only monitoring. No custom
   Claude OAuth, CLI-token extraction or callback interception workaround.
5. **Adapters** — promote only supported routes: start/cancel, verified identity,
   duplicates/wrong account, alias, collect, renew, reconnect/disconnect. Isolate
   official-runtime profiles if used and let that runtime own credentials.
6. **Extension** — use actual adapter capabilities and completion; preserve
   website tracking. Resume pending attempts, reject late responses, confirm
   verified identity, keep popup compact and details in dashboard.
7. **Operator setup** — reuse deployment; add only required provider runtime,
   approved callbacks, encryption/private storage, account deletion, backup and
   bounded operational cost. Users install extension and sign in, nothing else.
8. **Verification** — automate identity/tenant/race/expiry/throttle/migration/
   leakage cases. Record real-provider acceptance separately below.
9. **Delivery** — actual deployable adapters, extension ZIP, brief operator/user
   steps and final handoff. Commit/push checkpoints; no main merge or release.

If external approval or a missing supported interface blocks a provider, record
the exact evidence immediately. Finish the reviewable prerequisite/application
packet; do not spend another cycle on unrelated infrastructure or claim success.
Missing accounts make a supported executable route UNVERIFIED. Missing supported
authorization/quota contracts make implementation BLOCKED. These are different.

## Unresolved integration questions

**OpenAI:** hosted permission/client; HTTPS or extension callback; provider account
selection preserving A; immutable account/workspace metadata; read-only quota
permission and endpoint; whether App Server-managed auth may serve this hosted
monitoring product; credential renewal/revocation. Identity-only SIWC and API
billing are not substitutes. Codex/Work scope is not every ChatGPT allowance.

**Claude:** whether quota-only monitoring fits unmodified hosted-binary conditions;
official automatic remote callback; supported account chooser; stable identity/
workspace output; live `/usage` freshness; renewal and per-profile logout. Hosting
unmodified Claude Code is conditionally documented, not categorically forbidden.

## Checklist

- [x] Inspect existing code and required documents; new clean feature branch.
- [x] Make provider proof the first implementation gate.
- [ ] Establish supported hosted OpenAI route and required access.
- [ ] Authorize OpenAI, verify identity, fetch real quota.
- [ ] Prove OpenAI A/B isolation and other-device updates.
- [ ] Establish supported hosted Claude route and required access.
- [ ] Authorize Claude, verify identity, fetch real quota.
- [ ] Prove Claude A/B isolation and other-device updates.
- [ ] Integrate actual drivers, renewal and independent disconnect.
- [ ] Deploy private operator service and complete Windows acceptance.
- [ ] Deliver feature; both provider matrices pass.

## Live matrix — do not tick from fixtures

All entries start PENDING; no real accounts have been authorized here.

| Required evidence | OpenAI | Claude |
| --- | --- | --- |
| Actual A connected and identity verified | PENDING | PENDING |
| Actual B connected and identity verified | PENDING | PENDING |
| B added; normal browser still A | PENDING | PENDING |
| Both real quotas independently refresh | PENDING | PENDING |
| Other-device usage changes matching quota | PENDING | PENDING |
| Provider tabs closed; hosted refresh succeeds | PENDING | PENDING |
| Browser restart; connections remain usable | PENDING | PENDING |
| Backend restart; connections recover | PENDING | PENDING |
| Ordinary website logout behavior recorded | PENDING | PENDING |
| Global revocation/reconnect behavior recorded | PENDING | PENDING |
| Actual credential renewal | PENDING | PENDING |
| Disconnect B leaves A working | PENDING | PENDING |
| Windows Chrome and Brave journey | PENDING | PENDING |

Final report: **IMPLEMENTED / LIVE VERIFIED / BLOCKED OR UNVERIFIED**.
The feature is complete only when both providers meet product acceptance.
