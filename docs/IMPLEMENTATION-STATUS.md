# Current implementation status — Desktop + extension

Updated 22 October 2026. Documentation branch:
`docs/desktop-accounts-execution-plan`, based on local `745bf2a` from
`feature/independent-provider-proof`. Working tree was clean before this task.

## Current decision

The user accepts a desktop app alongside the extension. Execute
[D01–D10](DESKTOP-ACCOUNTS-IMPLEMENTATION-PLAN.md) for a guided Windows installation,
isolated official provider profiles and combined account quotas. The installer-free
hosted route is deferred. It was not completed by earlier infrastructure work.

## Actual implementation baseline

- Existing: website tracking, compact popup/dashboard/logos, aliases/history,
  local independent account service, official Codex and experimental Claude CLI
  adapters, per-account queues, browser router, Native Messaging and Windows GUI/NSIS.
- Existing 3.3 default independent choice uses hosted capabilities. Production hosted
  drivers are absent; local experimental service is available through advanced setup.
- Missing from the agreed upgrade: verified A/B provider behavior, desktop-first +
  integration, revised guided installer/bootstrapper, measured size reduction and
  clean Windows install/update/uninstall acceptance.
- OpenAI email metadata has limited identity confidence; same-email workspaces
  cannot be treated as distinct verified identities without supported evidence.
- Neither real authenticated provider quotas, other-device refresh, browser account
  preservation, logout behavior nor actual credential renewal has been verified here.
- Source/fixture tests and unauthenticated official-binary routing are historical
  evidence only. See [the consolidated record](IMPLEMENTATION-HISTORY.md).

## Execution checklist

| Task | Code status | Live acceptance |
| --- | --- | --- |
| D01 Existing local path audit/reproduction | PENDING | Not provider proof |
| D02 OpenAI isolated-account integration/proof | Existing parts; task PENDING | PENDING |
| D03 Claude isolated-account integration/proof | Existing parts; task PENDING | PENDING |
| D04 Identity/contracts/migration | PENDING audit and changes | PENDING where relevant |
| D05 Refresh/process ownership | PENDING audit and changes | PENDING |
| D06 Desktop/native bridge | PENDING audit and changes | Windows PENDING |
| D07 Extension + connection journey | PENDING | Windows PENDING |
| D08 Guided installer/bootstrapper | PENDING | Clean Windows PENDING |
| D09 Update/uninstall/packages | PENDING | Clean Windows PENDING |
| D10 Acceptance and handoff | PENDING | Both providers PENDING |

## Documentation checkpoint — this task

- Created the single desktop implementation plan and concise Sol 6.1 starter.
- Consolidated eleven superseded Markdown files and the long old status ledger.
  Unique test/provider conclusions are in IMPLEMENTATION-HISTORY; research and
  installation details remain in their relevant reference files. Full originals
  remain recoverable from the baseline Git commits.
- Updated start/index/install/reference links. Provider code, runtime behavior,
  account data, versions and existing extension artifacts are unchanged. Only help
  URL targets outside Markdown may change to follow consolidated documentation.
- Validation: 69 relative Markdown links checked, zero missing targets; 18 project
  Markdown files, all directly in docs/. `npm run typecheck` exited 0 and
  `git diff --check` passed. The two executable-file changes only replace help URLs.
- No application suite or live account test has been run by this documentation task.
- No new Desktop feature, backend deployment, main merge or release is claimed.
- Publication: Git CLI could not reach its configured proxy. Publish this docs-only
  checkpoint through the connected GitHub tools, preserving the remote parent and
  verifying the resulting source tree. Do not force-push older divergent commit IDs.

## Next action

From this documentation branch, create `feature/desktop-independent-accounts`.
Execute D01 by inspecting existing local service/Windows packaging and running
focused connection/proof checks, then D02's smallest real OpenAI connection path.
Do not spend another cycle on hosted scaffolding or a new desktop framework.

After each task record changed files, commands/results and skips, evidence level,
decisions, blockers and next action. Final reporting separates implementation,
automated tests, live verification and blocked/unverified work.
