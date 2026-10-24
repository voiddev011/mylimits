# Start here

Read root AGENTS.md, [status](IMPLEMENTATION-STATUS.md), [architecture](ARCHITECTURE.md) and [installation](INSTALL.md).

MyLimits tracks provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex** and **Cursor** through the account currently signed into each website. Ordinary ChatGPT message/image quotas are not inferred from Codex buckets. Unknown quotas and reset times stay unknown.

Saved-sign-in code remains present with every provider policy **off** and empty cookie allowlists. Private sign-in is hidden until evidence and approval enable a provider. No independent multi-account or logout-survival behavior is claimed.

U1 removes unused features without adding tracking capabilities. The previous source is recoverable from `archive/pre-simplify`. The working branch is `codex/u1-simplify`, with a PR into main; do not modify the archive.

GitHub Copilot setup and official API details: [COPILOT.md](COPILOT.md).
