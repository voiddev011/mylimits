# Starter prompt for Sol 6.1

Use the branch containing this file. Select Sol 6.1 and paste:

```text
Implement the installer-free, independent multi-account MyLimits experience.

Read repository instructions, docs/START-HERE.md, docs/IMPLEMENTATION-STATUS.md,
docs/INDEPENDENT-ACCOUNTS-FINAL-PLAN.md,
docs/INDEPENDENT-ACCOUNTS-FINAL-HANDOFF.md and docs/PROVIDER-ACCESS-REQUESTS.md.
Retain the older hosted plan/trial only as historical evidence. Inspect existing
code before changing it. The production provider map is still empty.

Execute the real-provider-first plan sequentially on a new feature branch.
No parallel agents. Do not repeat H01–H10 foundation implementation.
Preserve user changes. Reuse existing extension/server/diagnostic code; do not
restart the project or repeat broad competitor research. Start implementation
after inspection; do not stop at another plan.

Required UX: remove provider toggles; + beside each service offers Use current
account or Connect another account. Personal and Work must appear together;
adding Personal must preserve the normal browser's Work login. Target a small
first-party sign-in window and hosted quota refresh without any local helper,
CLI, terminal commands or token copying for users. Keep website tracking working.

Treat the provider mechanism as unresolved until verified. A regular popup
shares cookies. Never use opening a website as independent connection success.
Verify permitted hosted authorization, account selection, identity and quota
scope per provider. OpenAI device-code initiation is observed, not real login;
the managed-browser route was observed with a loopback callback even when
useHostedLoginSuccessPage=true. Public managed account metadata lacks immutable
subject/workspace. Claude's automatic remote completion and permitted monitoring
remain unresolved. Do not invent custom OAuth, copy
cookies, extract CLI credentials, collect passwords or bypass restrictions.

First establish supported hosted authorization, identity and quota contracts/access.
Implement a real login -> verified identity -> actual quota read, then prove A/B
isolation, before further UI/backend expansion. If the contract/access is absent,
finish the reviewable provider prerequisite from the request packet and report
the blocker immediately. Do not substitute another UI/infrastructure cycle.
Leave blocked adapters unavailable; never present fixtures as live capabilities.
Codex quotas do not cover every ChatGPT limit. Keep timestamps/stale states honest.
Preserve account IDs, aliases and history. Protect server credentials and tenants.

After every task update docs/IMPLEMENTATION-STATUS.md with changed files, actual
checks/results, decisions, blockers and next action. Keep Markdown directly in
docs/. Record unavailable live checks as PENDING. Missing provider integration
is incomplete implementation, not just pending manual testing.
Resolve routine choices without repeated permission requests. Before any public
deployment/purchase/provider submission, prepare concrete reviewable artifacts
and request the necessary authorization. Do not merge main or publish a release.

Commit coherent checkpoints and push when access permits. Finish with a packaged
extension, short Windows Chrome/Brave instructions, operator setup and a handoff.
Report IMPLEMENTED / AUTOMATED TESTED / LIVE VERIFIED / STILL BLOCKED separately.
Do not claim the full goal is complete until both providers meet the plan's actual
account and no-helper acceptance criteria. On resume, continue from the ledger.
```
