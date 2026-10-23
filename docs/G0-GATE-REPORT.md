# C7 — G0 evidence assessment

Gate: **G0 — HOLD, awaiting human evidence**

This is the C7 assessment. Later C9–C12 code was authorized behind off policies;
its implementation is recorded in [current status](IMPLEMENTATION-STATUS.md) and
[session persistence](SESSION-PERSISTENCE.md). The implementation/dependency table
below records the C7 baseline, not missing code after those later checkpoints.
Activation blockers and all PENDING live evidence still apply.

Completed experiments: **None recorded. E1–E8 are PENDING.**

This report assesses the current [evidence ledger](SESSION-PERSISTENCE-EVIDENCE.md)
against the unchanged [R2 plan](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md), §6 Gate
G0 and §7.3. It does not approve G0/G1, cancel a provider on missing evidence, or
substitute automated fixtures for live results. Updated 23 October 2026.

Execution amendment: the user subsequently authorized coding C9 before these
experiments. This permits a disabled foundation only: all production provider
policies stay off, cookie allowlists stay empty, and C8 remains deferred. It does
not change any live result or approve provider activation. The original proposal
is preserved unchanged; this amendment and IMPLEMENTATION-STATUS record the order.

## Findings

- C1–C6 are integrated into main through [PR #8](https://github.com/voiddev011/mylimits/pull/8),
  commit 2c2be4f. C6's source and main integration have identical trees. This merge
  was explicitly authorized by the user; it does not establish the earlier
  Checkpoint A trial, provider behavior or gate acceptance.
- C6 supplies an isolated diagnostic build. There is no production saved-session
  vault or browser-only independent sign-in. The ordinary extension and its
  website tracking remain distinct from the evidence build.
- C6 local checks passed: 178 core, 20 native, 24 connection, 4 transport/runtime
  tests; 42 normal Chromium tests and 4 spike Chromium fixtures. The actual
  Windows shutdown correction and all six jobs passed in
  [run 39929586829](https://github.com/voiddev011/mylimits/actions/runs/39929586829).
  These results establish component behavior, not live authentication or logout.
- The evidence ledger has no provider/browser/date observations for any E1–E8.
  Therefore no live benefit, safe cookie scope, logout survival, cookie allowlist,
  lifetime, rotation requirement or Bearer-only support can be concluded.

| Experiment | Recorded result | Decision still unresolved |
| --- | --- | --- |
| E1 | PENDING | Real overnight/no-tab behavior and earlier live trial |
| E2 | PENDING | Whether normalized headers improve rejections; whether C8 should run |
| E3 | PENDING | Cookie replay with an empty normal jar; minimal allowlist; extension initiator/tabIds scope and unaffected website requests |
| E4 | PENDING | Ordinary logout vs private logout vs global revocation, separately by provider |
| E5 | PENDING | Original captured session lifetime at 24h, 72h and 7d; no recapture substitution |
| E6 | PENDING | Rotation and rejection of old values; whether T4.2 must move into C9 |
| E7 | PENDING | Bearer-only usage without cookies/DNR; whether C10's T3.5 can use it |
| E8 | PENDING | Actual private-window access, store enumeration and policy constraints by browser |

## Recommended branch of the decision table

**HOLD.** There is no supported decision-table outcome yet. Missing results are
neither PASS nor FAIL. Do not turn on normalization or saved-session transports
while the observations that justify them are absent. Disabled C9 code may be
implemented under the amendment above; it cannot establish the technical findings.

| Group | Current disposition | Required evidence or change |
| --- | --- | --- |
| C8 | BLOCKED | G0 human decision and E2 showing benefit. If E2 shows no benefit, skip C8 rather than add dead rules. |
| C9 | Disabled foundation allowed; activation BLOCKED | G0 and G1 decisions; provider-specific E3/E4 route proof and an evidence-derived cookie allowlist. If E6 proves rotation plus old-value rejection, T4.2 must be added before activation. |
| C10 | BLOCKED by C9 | Private sign-in, refresh wiring and fallback stay unimplemented. Use Bearer-only T3.5 only if E7 passes. |
| C11 | BLOCKED by C10 | Saved-session UI/management cannot imply a working connection before the verified transport exists. |
| C12 | BLOCKED by C11 | Expiry/final acceptance follows real integration; do not claim a completed feature from documentation. |
| C13 | OPTIONAL, not started | Separate authorization/scope; not a substitute for the required G0 evidence. |

If E3 shows unsafe/unavailable request scoping, apply the R2 cancellation rule;
never remove initiatorDomains to force replay. If E4 fails for one provider,
cancel Phase 3 for that provider and describe logout behavior honestly. Neither
cancellation has been inferred from the present lack of results.

## Open risks

- HTTP success alone does not prove that an extension-scoped DNR rule matched.
  Real header effects and unaffected unrelated traffic must be established by E3;
  routed/fake-fetch tests cannot do this.
- A normal website logout may revoke the captured session; E4 must distinguish
  that from global revocation. No browser-only architecture can promise survival
  if the provider invalidates the independent credential.
- Session cookies may rotate; omit credentials discards Set-Cookie. Name-only
  observation does not prove renewed values or rejection of the original session.
- Lifetime evidence is lost when the volatile diagnostic capture disappears.
  Recapturing starts a new trial; it cannot establish survival of the old one.
- G1 has not selected a provider vault policy. Claude remains off under the
  proposal unless a human changes that decision after considering the provider
  conditions. Merging preview code into main is not policy approval.
- The earlier 3–4 day live reliability trial and the provider/browser acceptance
  scenarios remain pending independently of C6's automated results.

## Question for the human

Please run the [C6 experiments](INSTALL.md#c6-evidence-spike-test-accounts-only)
on your own disposable test accounts and record sanitized E1–E8 results in the
ledger: provider, browser/version, date, statuses, selected cookie names, actual
rule-match evidence and separate logout outcomes. Never send cookie values,
tokens, raw headers/bodies or account IDs.

Once those observations are available, update this report, apply each relevant
R2 decision-table row and request the actual G0 decision. G1 follows G0 as a
separate per-provider policy decision. Do not activate normalization or saved-session
connections before their prerequisites; the disabled C9 exception is recorded above.
