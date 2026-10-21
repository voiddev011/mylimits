# Starter prompt for Sol 6.1

Use the branch containing this file. Select Sol 6.1 and paste:

```text
Implement the installer-free, independent multi-account MyLimits experience.

Read repository instructions, docs/START-HERE.md, docs/IMPLEMENTATION-STATUS.md,
docs/HOSTED-ACCOUNTS-IMPLEMENTATION-PLAN.md and
 docs/HOSTED-ACCOUNTS-TRIAL-PLAN.md. Inspect existing code before changing it.

Execute H01–H10 sequentially on a new feature branch. No parallel agents.
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
Claude's remote completion is unresolved. Do not invent custom OAuth, copy
cookies, extract CLI credentials, collect passwords or bypass restrictions.

Implement independent UI/contracts/backend/tests while provider proof is blocked.
Leave blocked adapters unavailable; never present fixtures as live capabilities.
Codex quotas do not cover every ChatGPT limit. Keep timestamps/stale states honest.
Preserve account IDs, aliases and history. Protect server credentials and tenants.

After every task update docs/IMPLEMENTATION-STATUS.md with changed files, actual
checks/results, decisions, blockers and next action. Keep Markdown directly in
docs/. Record unavailable live checks as PENDING and continue independent work.
Resolve routine choices without repeated permission requests. Before any public
deployment/purchase/provider submission, prepare concrete reviewable artifacts
and request the necessary authorization. Do not merge main or publish a release.

Commit coherent checkpoints and push when access permits. Finish with a packaged
extension, short Windows Chrome/Brave instructions, operator setup and a handoff.
Report IMPLEMENTED / AUTOMATED TESTED / LIVE VERIFIED / STILL BLOCKED separately.
Do not claim the full goal is complete until both providers meet the plan's actual
account and no-helper acceptance criteria. On resume, continue from the ledger.
```
