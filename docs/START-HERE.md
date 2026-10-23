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

The current persistent-accounts task is **C4 / Checkpoint A**: bounded normal-tab
recovery and Phase 1 validation. C1–C3 are integrated into
`feat/persistent-accounts`; C4 is on `codex/c4`. Review the C4 handoff/status and
perform the plan's 3–4 day trial before authorizing C5. No session-vault or new
browser-only independent login has been delivered by these checkpoints.

[Documentation index](README.md) · [Research](COMPETITOR-RESEARCH.md)
