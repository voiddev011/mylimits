# Current work: independent-account extension integration

Latest authorization: implement on `feature/independent-accounts`. Read
[MULTI-ACCOUNT-IMPLEMENTATION.md](MULTI-ACCOUNT-IMPLEMENTATION.md) and current status.
The user authorizes integration while unavailable live checks remain explicitly
pending. Version 3.2 implements the Claude CLI adapter and first-party BROWSER routing.
Read [MULTI-ACCOUNT-CODE-CHECKLIST.md](MULTI-ACCOUNT-CODE-CHECKLIST.md). Manual
provider acceptance is separate; do not restore the old unavailable-only stub.

# Previous checkpoint: independent-account connector proof

Latest authorization: implement the connector-proof milestone on `v3/account-proof`.
Read [INDEPENDENT-ACCOUNTS-RESEARCH-AND-PLAN.md](INDEPENDENT-ACCOUNTS-RESEARCH-AND-PLAN.md)
and [ACCOUNT-PROOF.md](ACCOUNT-PROOF.md). The diagnostic is separate from the
extension; Gate 1 requires real accounts. Do not enable or market independent
Claude, or start Gates 2–5, on fixture evidence alone.

# Previous release: MyLimits 3.0

Latest authorized upgrade: `v3/redesign`. Read [V3-IMPLEMENTATION-PLAN.md](V3-IMPLEMENTATION-PLAN.md),
[IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) and [V3-HANDOFF.md](V3-HANDOFF.md).
The Phase 1/2 instructions below describe earlier releases; do not restore Guide
or the old quota widget from them. Use [INSTALL.md](INSTALL.md) to test this build.

# Start here — GPT-6.1 Sol execution guide

This is the implementation handoff for MyLimits 2.0. It is designed for one
GPT-6.1 Sol workstream using bounded tasks, shared contracts and durable progress
notes. The latest user-authorized upgrade is **2.2** on `v2/compact-accounts`;
read the [compact accounts handoff](COMPACT-ACCOUNTS-HANDOFF.md) and current status.
The historical [Phase 2 handoff](PHASE-2-HANDOFF.md) covers its preserved base.

## Read in this order

1. [Implementation status](IMPLEMENTATION-STATUS.md): determine what actually
   exists, the current work package, decisions, blockers and next action.
2. [Master plan](V2-IMPLEMENTATION-PLAN.md): read the product/authorization
   boundaries and sections 6–7, 11 and 14–15 for shared implementation contracts.
3. The requested phase: [Phase 1](PHASE-1.md) or [Phase 2](PHASE-2.md).
4. Read the existing files named in the current task, plus applicable repository
   instructions. Consult [research](COMPETITOR-RESEARCH.md) only for a concrete
   connector/design question; do not reload every competitor on every task.

The [starter prompt](STARTER-PROMPT.md) is the original Phase 1 entry point.
Do not repeat completed tasks. Further product work requires the user’s next instruction.

## Current baseline

- Project: `voiddev011/mylimits`, an existing React/TypeScript/WXT MV3 extension.
- App version is `2.2.0` with manifest label `2.2 Compact accounts preview` on the
  current working branch. A dedicated popup replaces dashboard tabs in the toolbar.
- Known source boundaries: `src/core`, `src/providers`, `src/platform`, `src/ui`,
  `entrypoints`, `companion`, `tests/browser` `server/` and `.github/workflows/checks.yml`.
- Existing website readers are prototypes. Claude and Work/Codex quota parsing
  exists; Grok/Perplexity/Cursor add scoped prototype quota readers; Gemini remains activity-only.
- Optional OpenAI native companion exists; real logout/renewal/Windows behavior
  must not be assumed verified from fixture tests.
- `BUILD-STATUS.md` is an initial historical record, not a current green test run.
- The original pre-V2 documentation followed prototype application work;
  inspect actual branch/history rather than assuming code matches a chat.
- A managed workspace may contain pre-existing dirty files whose content was
  already published through another Git tool. Preserve them; inspect status and
  diffs before attributing, committing or resetting anything.

## Work loop

1. Select the next uncompleted task whose dependencies are satisfied. Mark it
   `in_progress` in the status file and record a short implementation approach.
2. Inspect only the relevant code first. Resolve routine choices from the master
   contracts and current patterns; don't restart a broad architecture exercise.
3. Implement a complete, reviewable work package. Avoid speculative abstractions,
   placeholder provider cards, unrelated dependency upgrades and parallel agents.
4. Add meaningful tests for changed behavior. The current unit runner imports
   files explicitly; wire new tests into that runner. Preserve regressions.
5. Run the narrowest relevant checks, then the phase gate when integrated.
   Record exact commands and actual outcomes, not planned commands labeled passed.
6. Update status with changed files, decisions/contract changes, test evidence,
   any external blockers and an exact next action. Commit a coherent checkpoint
   on the working branch; push when repository access permits.
7. Continue through the entire authorized phase. A checkpoint is not a request
   for the user to approve ordinary reversible implementation steps.

Do not treat a task as live-verified because it passed mocks. If a provider login,
approval, OS or network is unavailable, implement/test independent work and record
the exact blocked check. Ask only for information/action genuinely needed; never
ask the user to paste passwords, cookies or access/refresh tokens into chat.

## Tooling and verification

Use Node **24+**, the existing lockfile and package manager. Baseline scripts:

```sh
npm ci                    # only when installation is needed
npm run typecheck
npm test
npm run test:companion
npm run build
npm run test:browser       # requires a built extension and available Chromium
npm run zip
```

`npm run check` already runs type checking, core tests, companion tests and the
production build. Use it at the integrated phase gate; do not repeatedly run all
its subcommands after unchanged success. Install Playwright Chromium only when
needed/available. Report environment blockers separately from code failures.
CI already defines Linux extension checks and Windows logic checks; actual
Windows browser/native behavior still needs its own evidence.

## Git and scope

Start Phase 1 on `v2/phase-1` or a non-conflicting branch. Keep `main` stable
while implementing. Do not force-push, reset user work or blindly commit all
dirty files. If the local checkout history differs from the remote, inspect and
use a safe branch/checkout workflow; do not overwrite remote commits to make
histories match. Tool/access failure should not erase otherwise completed work.

All maintained project Markdown belongs directly in `docs/`, including README,
privacy, generated implementation notes and future handoffs. Do not relocate
third-party/dependency docs or tool-owned instructions. Do not create duplicate
root Markdown stubs. Repair local and application documentation URLs if paths
change. Code/build/test artifacts stay in their appropriate directories.

Phase 1 does not include backend code or new-provider expansion. Phase 2 can
implement local/test cloud services; public hosting, purchases and provider
partnership submission are separate release actions. Never silently upload
provider authorization as a substitute for snapshot sync.

## Context and handoff discipline

Before context becomes tight, update status with the current task, files,
implemented behavior, unrun/failed checks, active decisions, commit/artifact and
the next executable action. On resume read that entry and continue; do not
restart the phase or infer completion from a long previous response.

At each phase gate produce the handoff specified in its task file. A useful
handoff distinguishes implemented code, fixture-tested behavior, live-verified
capabilities and blocked external checks. End with a short user-facing summary,
branch/commit, installation steps and actual verification limits.
