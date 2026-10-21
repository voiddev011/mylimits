# Independent accounts — blocked implementation handoff

22 October 2026 (Asia/Calcutta). Branch: `feature/independent-provider-proof`.
Base: `feature/hosted-connections`. No main merge, release or deployment.

## Verdict

**The requested feature is INCOMPLETE. Neither real hosted provider connection
is implemented. This is not merely awaiting account testing.**

This run stopped at the real-provider gate rather than building more surrounding
infrastructure. A supported hosted authorization/quota contract and access were
not established. No invented production driver was written.

## Implemented this run

- New active [execution plan and live matrix](INDEPENDENT-ACCOUNTS-FINAL-PLAN.md),
  corrected entrypoint/starter prompt/status and preserved historical evidence.
- Repeatable official Codex browser-login observation in the existing proof tool:
  `probeCodexBrowser`, strict callback classification, safe cancellation and no
  credential/URL export. `--codex-browser` requests the documented hosted success
  page to test whether that changes the callback. It does not.
- [Prepared provider requests](PROVIDER-ACCESS-REQUESTS.md): actual OpenAI form
  fields, quota-only mismatch, both use cases and private deployment inputs.
  These drafts have NOT been submitted.
- Rebuilt the existing 3.3 extension preview. No user-facing independent-login
  feature or version change is claimed. Existing UI/data/tracking are preserved.

## Actual official-binary observation

Official Codex **0.163.0**, obtained from its official package in the prior trial,
ran with a fresh isolated temporary profile. No ambient auth cache was opened.

```text
transport: official-managed-browser
initialAccountAbsent: true
hostedSuccessPageRequested: true
issued: true
callback: loopback
cancelAcknowledged: true
shutdownConfirmed: true
authenticated: false
quotaFetched: false
```

This is an unauthenticated transport observation, **not** real-account
verification. No login window was opened or model prompt submitted. Raw
URL/state/code, account details and credential files were never exported.

The binary's public `app-server generate-ts` output was inspected in a disposable
directory. `Account.chatgpt` contains email and plan, without immutable subject/
workspace. Caller-supplied external-token identity is not provider verification.
Managed-login parameters expose hosted success-page selection, not a custom remote
redirect in that generated contract. This finding is version-specific; a different
documented interface can be evaluated later.

The initial restricted run could not complete/confirm shutdown. Its exact owned
process was identified/stopped and retained profile removed. Permitted local
execution produced the result above and cleaned up normally. No provider auth
restriction was bypassed.

Operator/developer reproduction, with official software already installed:

```sh
npm run probe:hosted -- --codex-browser /absolute/path/to/official/codex
```

This starts/cancels login only; it cannot establish a connection or fetch quotas.
It is not end-user setup. Successful exit is not feature acceptance.

## Why production routes remain blocked

**OpenAI:** [hosted guidance](https://developers.openai.com/siwc/token-sharing-open-source)
and [client availability](https://developers.openai.com/siwc/request-client-id)
point to provider onboarding; no hosted registration is configured. The
[OSS registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
uses loopback. The [App Server browser flow](https://learn.chatgpt.com/docs/app-server)
also returns locally; the hosted success page follows that callback. Device code
is a distinct flow, not the requested automatic popup. Supported identity and
quota-access contracts remain unresolved. Identity-only sign-in is insufficient.

**Claude:** [conditions](https://code.claude.com/docs/en/legal-and-compliance)
allow certain unmodified hosted-binary use but restrict custom subscription
authentication. The [remote fallback](https://code.claude.com/docs/en/troubleshoot-install#oauth-login-fails-in-wsl2-ssh-or-containers)
requires manual code entry. Automatic hosted completion and permitted quota-only
monitoring remain unresolved. This does not mean all hosted Claude Code is
forbidden. Missing help flags are not proof that no supported mechanism exists.

No authenticated quota read, renewal, two-account isolation, browser-session
preservation or logout behavior was tested. Both production capabilities remain
unavailable. All live rows in the active plan remain PENDING.

## Checks performed this run

| Check | Actual result and limits |
| --- | --- |
| `node --test --test-isolation=none --test-reporter=spec companion/proof/hosted-login.test.mjs` | 10 passed; fictional/redaction/lifecycle cases |
| `npm run test:account-proof` | 30 passed; fictional accounts, real subprocess/PTY mechanics |
| Official managed-browser start/cancel | Loopback observed; confirmed cleanup; no authentication |
| Official public protocol generation | Exit 0; static types inspected, no credentials |
| `node --check` on changed executable modules | Passed |
| `npm run zip` | Built existing Chrome 3.3 preview |
| Real provider/Windows Chrome/Brave acceptance | PENDING; feature not ready |

No backend/extension production code changed. Previous backend/browser results
remain historical in HOSTED-ACCOUNTS-HANDOFF.md, not rerun or relabelled here.

## Package and short installation

Local ZIP: `.output/mylimits-3.3.0-chrome.zip`, **306395 bytes**.
SHA-256: `85f3190ad92f6d376128ef4443d54e28768926bde05cc0d6e0f81ef138dfb811`.
Archive metadata changed on rebuilding; it still packages the same 3.3 source/UI.
No helper/CLI/server runtime is included. No hosted URL is configured.

[Windows commands and folder selection](INSTALL.md) point at this branch.
Build/extract preview → Chrome/Brave extensions → Developer mode → Load unpacked
→ `.output/chrome-mv3` (or extracted ZIP manifest folder). Reload the existing
installation to preserve its data. Website tracking can be tested; independent
real-account sign-in cannot. No command unlocks missing provider adapters.

## Next action

Use the prepared request packet to establish supported hosted quota-only access.
Owner contact/product domain are absent and were not invented. No external
messages/forms were submitted. Submission alone does not establish an API.

Once a supported contract/access is supplied, implement the actual
login → immutable identity → quota retrieval first. Then finish A/B acceptance
and server runtime packaging using the existing foundation. Do not repeat a UI/
infrastructure cycle or call the product complete before these gates pass.

## Published checkpoint

Published source: `6ac9ae6b3582f666d8d52c23f7a7eb41e48480f8` on
`feature/independent-provider-proof`; tree `68c60057ea29ff60865062201cacc28359f81484`.
Matching local checkpoint: `95eb7e8`. GitHub connector publication preserves the
remote parent; local/remote commit IDs differ but source trees match. Do not
force-push/reset to reconcile them. Main and the prior branch are unchanged.

[CI run39665803268](https://github.com/voiddev011/mylimits/actions/runs/39665803268)
was in progress when checked; no CI success is claimed. This documentation
follow-up changes no executable code or extension package.
