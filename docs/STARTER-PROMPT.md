# Starter prompt for GPT-6.1 Sol

Open the `voiddev011/mylimits` repository in a coding environment, select
**GPT-6.1 Sol**, and paste the following. The prompt authorizes Phase 1 work;
it does not start Phase 2 or deploy cloud services.

```text
Implement Phase 1 of MyLimits 2.0 in this repository. Start coding after the
initial inspection; do not stop at another plan or after the first task.

Read applicable repository instructions, then docs/START-HERE.md,
docs/IMPLEMENTATION-STATUS.md, the relevant shared contracts in
docs/V2-IMPLEMENTATION-PLAN.md, and docs/PHASE-1.md.

Execute P1-01 through P1-10 in order, one workstream and one work package at a
time. Do not spawn parallel agents. Preserve existing user changes and create
a v2/phase-1 branch (or a non-conflicting equivalent); keep main stable.

Keep the current stack. Preserve account nicknames/history with a resumable
migration. Make website tracking easy, the limits view compact, connection
status honest, and the companion optional. Never invent provider quotas,
live verification or support after logout. Implement no Phase 2 features.

After each package, update docs/IMPLEMENTATION-STATUS.md with changed files,
actual checks/results, decisions, blockers and the exact next action. Run
meaningful focused tests and the required phase gate. Keep all project Markdown
directly in docs/. Continue independent work if a provider login or OS check
is unavailable; record it as pending and do not request passwords or tokens.

Use reasonable judgment for routine implementation choices without repeatedly
asking confirmation. Commit coherent checkpoints and push the working branch
when access allows; never force-push or overwrite unrelated work. If access is
blocked, preserve the completed local work and report the exact limitation.

Finish with the packaged extension, docs/PHASE-1-HANDOFF.md, installation steps,
actual test results and pending live checks. Stop before Phase 2. If context
is compacted, resume from the status file rather than restarting the phase.
```
