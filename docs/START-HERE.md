# Start here — GPT-6.1 Sol execution guide

This is the implementation handoff for MyLimits 2.0. It is designed for one
GPT-6.1 Sol workstream using bounded tasks, shared contracts and durable progress
notes. Phase 1 is now implemented on `v2/phase-1`; read the
[Phase 1 handoff](PHASE-1-HANDOFF.md) and status before starting more work.

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
Do not repeat completed tasks. Phase 2 requires the user's next instruction.

## Current baseline

- Project: `voiddev011/mylimits`, an existing React/TypeScript/WXT MV3 extension.
- App version is `2.0.0` with manifest label `2.0 Phase 1 preview` on this branch.
- Known source boundaries: `src/core`, `src/providers`, `src/platform`, `src/ui`,
  `entrypoints`, `companion`, `tests/browser` and `.github/workflows/checks.yml`.
- Existing website readers are prototypes. Claude and Work/Codex quota parsing
  exists; Gemini/Grok/Perplexity currently have browser activity observations.
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
