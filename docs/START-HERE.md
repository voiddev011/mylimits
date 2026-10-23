# Start here — MyLimits

The current implementation is the Desktop + extension preview on
`main`. Website tracking works without Desktop.
Independent OpenAI/Claude connections use separate official provider profiles.
**Real two-account acceptance remains pending for both providers.**

Read:

1. Applicable repository instructions and Git status; preserve user changes.
2. [Current implementation status](IMPLEMENTATION-STATUS.md).
3. [Desktop handoff and pending acceptance](DESKTOP-ACCOUNTS-HANDOFF.md).
4. [Installation](INSTALL.md) and relevant [architecture](ARCHITECTURE.md).

Completed execution plans and starter prompts were removed on 23 October 2026.
They remain in Git history. The newly added
[persistent-accounts proposal](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md) is retained
unchanged. It was written against an older baseline and references archived files
and branches; reconcile it with current code before executing it. Implementation now starts on `feat/persistent-accounts`, one task group at a time.
Read root AGENTS.md, the proposal and the current status before coding.
Real-session gates G0/G1 remain required; no saved-session feature is enabled yet.
Keep project Markdown directly in docs/.

The current persistent-accounts checkpoint is **C7 / G0 evidence assessment**.
C1–C6 are merged into main through PR #8. The user authorized merging validated
checkpoints and pruning merged branches. The 3–4 day live trial remains pending.
Read [spike setup](INSTALL.md#c6-evidence-spike-test-accounts-only) and fill
[the live evidence ledger](SESSION-PERSISTENCE-EVIDENCE.md) on your own test
accounts. No session vault or browser-only independent login has been delivered.
The [C7 gate report](G0-GATE-REPORT.md) records **HOLD**: all E1–E8 are pending.
Stop before C8/C9; the evidence and human G0/G1 decisions remain required.

[Documentation index](README.md) · [Research](COMPETITOR-RESEARCH.md)
