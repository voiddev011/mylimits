# Current implementation status — Desktop + extension

Updated 22 October 2026. Working branch:
`feature/desktop-independent-accounts`, created from clean
`docs/desktop-accounts-execution-plan` (`3f218f6` locally).

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
| D01 Existing local path audit/reproduction | COMPLETE | Not provider proof |
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
- Publication: Git CLI could not reach its configured proxy; the connected GitHub
  tools published this branch while preserving the remote parent. Source checkpoint
  `fba0e3829f37d7da9cc3738244b786a2e73b5ef6` matches local `73df840` exactly
  (tree `b18d76fd81ff66ff23e0bc46e20aa192a3c10080`). This documentation follow-up
  records that publication. Do not force-push older divergent commit IDs.

## Next action

Execute D02: preserve the real managed OpenAI path and add explicit identity
confirmation before accepting the connection, then D03's Claude equivalent.
Do not spend another cycle on hosted scaffolding or a new desktop framework.

After each task record changed files, commands/results and skips, evidence level,
decisions, blockers and next action. Final reporting separates implementation,
automated tests, live verification and blocked/unverified work.

## D01 — inspected and reproduced

- Inspected required documents and existing connections, App Server, Claude adapter,
  isolated browser/router, native host, storage contracts, controller, + UI and
  Windows installer/dependency packaging. No user edits were present.
- Gaps: default + selects empty hosted drivers; login presently auto-accepts the
  reported account; identity is email-only for Codex; installer requires a separate
  registration GUI, carries all dependencies and has no bootstrapper/update staging.
- Baseline: `npm run test:account-proof` 30/30 passed and
  `npm run test:connections` 18/18 passed with real fictional subprocesses/PTYs.
  Initial sandbox runs failed from EPERM on child-process execution; rerunning
  the same commands through permitted local execution passed. No tests were weakened.
- Measured existing unsigned installer: 211310699 bytes. Cached official Node ZIP:
  37733703 bytes; Codex TGZ: 167618721 bytes. Installed official Codex executable
  alone is 341270320 bytes; a bootstrapper cannot erase those runtime requirements.
- Refreshed official App Server/login/rate-limit and Claude auth/credential-use
  documentation. Official local-profile routes remain the selected integration;
  public product/distribution eligibility is not claimed from code inspection.
- Real accounts and a Windows interactive desktop are unavailable. All real-provider
  matrix rows stay PENDING. No compiler for the Windows installer was found on PATH;
  build access will be addressed in packaging rather than reporting an EXE prematurely.
- Changed file: this status ledger. Next: D02 account confirmation and OpenAI tests.
