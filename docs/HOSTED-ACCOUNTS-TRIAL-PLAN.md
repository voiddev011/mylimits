# Hosted accounts trial — plan and evidence

21 October 2026 · branch `feature/hosted-account-proof`.

## User outcome

Install only the browser extension. Each service has a + button, with two actions:
use the current website account, or connect another account in a small official
authorization window. Work remains signed into the normal browser while Personal
is independently monitored. No site on/off switches or local helper installation
in this target flow. Reauthorization may still be necessary after expiry/revocation.

This is a feasibility trial, not a completed replacement for 3.2. The user's
existing-session report remains unresolved; previous fixture tests did not prove
the actual multi-account sign-in journey.

## Sequential plan and acceptance gates

1. **Try actual remote login transports first.** Run unmodified official CLIs in
   new temporary profiles, without authenticating an account or using a prompt.
   OpenAI: request documented App Server `chatgptDeviceCode`, validate only the
   verification URL/code shape, cancel and confirm process exit. Claude: inspect
   public help, capture only authorization callback classification using its
   documented BROWSER override, cancel and confirm exit. Never log URLs, codes,
   tokens, terminal output or personal account details.
2. **Resolve deployment eligibility and exact sign-in UX.** OpenAI device auth is
   beta, may require a user/admin setting and requires entering a one-time code;
   it is not proof of a one-click OAuth popup. Establish the permitted hosted
   product route separately from a user's own headless machine. For Claude,
   validate the unmodified hosted-CLI conditions; do not create a custom Claude.ai
   OAuth client or relabel Anthropic Console API authentication as subscription
   quota access. A loopback callback on a server points at the wrong machine when
   opened in a laptop browser. Do not silently substitute normal browser tabs,
   cookie copying, CLI token extraction or an unauthenticated callback relay.
3. **Prove two real accounts before implementing the product UI.** In a private,
   properly authorized test deployment: connect A and B; verify distinct identities
   and actual returned quota scope/value; leave the normal website on A; use B
   elsewhere and refresh; restart; test website logout separately from global
   revocation; test renewal when possible. User performs account sign-in through
   provider pages, never by sending secrets in chat. Accounts, a registered/allowed
   hosted integration and a secure test deployment are prerequisites, not fixtures.
4. **Implement hosted collection after the gate passes.** Reuse Fastify/TypeScript,
   PostgreSQL, encrypted credential contracts and durable jobs already in `server/`.
   The existing production collector map is intentionally empty: it cannot become
   functional by setting a boolean. Add validated account-scoped adapters, CLI-owned
   or provider-permitted credentials, KMS/private storage, bounded refresh, retry
   handling, disconnect and strictly dated results. Server infrastructure/costs
   move to MyLimits; they do not disappear when the laptop download is removed.
5. **Replace onboarding and deliver the extension.** Replace service switches with
   +. Focus the existing tab for current-account tracking; request site permission
   only when connecting. Use approved provider authorization for another account,
   verify its identity, then nickname it. Never show connected based solely on a
   popup closing. Expose only available scopes, age, resets and reconnect state.
   Preserve existing accounts/history. Retain an honest unavailable state for any
   provider whose gate has not passed; do not ship it as a working independent flow.

## Trial checklist

- [x] Inspect existing connection service, server, credential store and collector gate.
- [x] Check runtime/network readiness without inspecting credential values.
- [x] Confirm official remote-login documentation and inspect Claude login help.
- [x] Execute repeatable official transport probes; record actual results below.
- [ ] Establish permitted hosted deployment and account-selection mechanism.
- [ ] Pass the two-real-account quota/normal-browser isolation proof.
- [ ] Implement and test gated hosted adapters and simple + onboarding.
- [ ] Package and publish a replacement only after the required gates pass.

## Current prerequisites

Runtime status reports enforced HTTP access and no configured secrets, provider
accounts, OAuth registration, outbound identities, production KMS or deployed
MyLimits account service. GitHub connector publication remains available.

## Sources checked

- [Codex App Server device-code and quota methods](https://learn.chatgpt.com/docs/app-server)
- [Codex headless authentication and beta requirements](https://learn.chatgpt.com/docs/auth)
- [OpenAI local/open-source versus remotely hosted offerings](https://developers.openai.com/siwc/token-sharing-open-source)
- [Claude authentication and remote manual-code behavior](https://code.claude.com/docs/en/authentication)
- [Claude hosted-binary and credential conditions](https://code.claude.com/docs/en/legal-and-compliance)
- [Chrome authorization popup API](https://developer.chrome.com/docs/extensions/reference/api/identity#method-launchWebAuthFlow)

The Google-style popup is a UI mechanism. Authorization for consumer subscription
quotas is a separate provider capability. No ordinary ChatGPT model/image/voice
quota coverage is inferred from Codex quotas or a successful identity-only login.

## Actual experiment results

Executed on the Linux cloud host with official Codex **0.163.0** and unmodified
Claude Code **2.1.301**. Codex npm archive SHA-512 was checked against official
metadata before execution. CLI environments used fresh temporary profiles and
stripped ambient provider account selectors; no existing auth cache was opened.

| Check | Actual result | What it does not establish |
| --- | --- | --- |
| OpenAI account/read before start | Account absent in fresh profile | Any user identity or account eligibility |
| OpenAI chatgptDeviceCode start | Issued a valid first-party verification URL and code | Successful user authentication; automatic account B selection |
| OpenAI cancel | Official cancellation acknowledged; owned process exit confirmed | Authorization renewal or provider quota access |
| Claude auth login help | No custom callback flag advertised | That no other permitted hosted mechanism exists |
| Claude BROWSER capture | First-party authorization with loopback callback observed | Automatic completion from a laptop browser to this cloud host |
| Claude cancellation | Owned terminal process shutdown confirmed | Real account logout or revocation behavior |

Both reports explicitly contain `authenticated:false` and `quotaFetched:false`.
No login URL, code, token, email, raw CLI output or credential was printed or
persisted in the report. Temporary directories were removed after confirmed exit.
The remote experiment did not change normal browser state and had no user browser
attached, so it cannot prove normal-browser A remains unchanged after B signs in.

Automated local checks: **7 hosted-trial tests passed**, existing **30 account-proof
tests passed**, new JavaScript syntax checks and `git diff --check` passed. These
test redaction/lifecycle logic with fictional data and are separate from the actual
official-binary observations above. CI also runs the hosted-trial tests.

Reproduce as a developer with official binaries already on the **server**:

```sh
npm run test:hosted-probe
npm run probe:hosted -- --codex /absolute/official/codex --claude /absolute/official/claude
```

These are developer diagnostics, not setup commands for extension users. A
successful command means the transport observations completed; its report always
says `not-live-account-verified`. It never signs in a real account or reads quotas.
Do not put authorization output into test fixtures or publish CLI profile folders.

## Next bounded attempt

1. OpenAI: determine allowed hosted deployment and whether an app-registered OAuth
   callback can meet the requested popup UX. The device-code route is technically
   observed, but needs code entry and potentially enabling a security/admin setting;
   it is an alternate candidate, not an exact one-click replacement.
2. Claude: resolve the remote callback using a permitted first-party mechanism.
   Documented manual code entry is an extra step. A different normal browser tab
   does not solve account isolation or remote callback routing. No private OAuth
   client impersonation, token extraction or generic callback interception.
3. Once an allowed route and secure private test host exist, user signs in to two
   real accounts through provider pages; prove identities and available quotas.
   No provider accounts, approved hosted registration or public auth host are
   available in this workspace, so these checks remain PENDING rather than passed.

No production cloud collector, login button replacement, removed site toggle,
deployed service or new extension release is claimed by this feasibility trial.

## Published checkpoint

Experiment source: `0e39450974fdad7d7f47900342fd0b57e59bea9e` on
`feature/hosted-account-proof`. [CI run](https://github.com/voiddev011/mylimits/actions/runs/39630930205)
was queued at handoff; no CI success is claimed here. Actual local and official
transport results above stand separately. Documentation follow-up changes no
experiment or production code. Main and the prior feature branch are unchanged.
