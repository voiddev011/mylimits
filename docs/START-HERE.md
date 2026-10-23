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

The current persistent-accounts task is **C5 / connection-scoped refresh** on
`codex/c5`. C1–C4 are integrated into `feat/persistent-accounts`. The user
authorized continuing code work after the C4 review handoff; the 3–4 day live
trial is still pending and main has not been merged. Review C5 at Checkpoint B
before continuing to C6. No session vault or browser-only independent login has
been delivered; G0/G1 are still required before enabling private sign-in.

[Documentation index](README.md) · [Research](COMPETITOR-RESEARCH.md)
