# Architecture

MyLimits tracks provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex** and **Cursor** through the account currently signed into each website. Ordinary ChatGPT message/image quotas are not inferred from Codex buckets. Unknown quotas and reset times stay unknown.

Saved-sign-in code remains present with every provider policy **off** and empty cookie allowlists. Private sign-in is hidden until evidence and approval enable a provider. Website accounts are remembered on verified login switches; remembered cards do not independently refresh. Copilot connections use separate REST tokens (below).

Website readers use exact provider origins: background requests, an existing normal tab, and bounded inactive-tab recovery for eligible browser challenges. Plain unauthorized/rate-limited responses do not open recovery tabs. Cookie signals use only the normal cookie store, not private sessions. Scheduler cooldowns/backoff, per-host locks and connection-generation fences isolate requests and reject late results.

Version-2 local Store holds settings, accounts, website/vault/Copilot connections and dated snapshots. IndexedDB holds reading history. Writes are serialized. Failed reads preserve their observation time. Preferences control refresh, optional notifications, privacy, text size and retention.

The dormant saved-sign-in path uses a private-window verification flow, explicit per-account consent, AES-GCM storage with a non-extractable IndexedDB key, source-bound reads, encrypted-slot deletion and expiry warnings. No credential or ciphertext enters account state, diagnostics, history or exports. Copilot PAT input crosses only the internal setup message before encrypted background storage.

U1 compatibility filtering runs before strict Store parsing. It drops retired providers and connection kinds and their accounts/snapshots. A durable cleanup journal records deleted IDs before state rewriting. IndexedDB cleanup and obsolete-key removal finish before completion is marked; interrupted cleanup retries. Remaining identities, aliases, settings, snapshots and history are retained. Legacy V1 parsing is compatibility-only. Runtime initialization removes obsolete alarms and registered scripts.

The separate evidence build has no automatic tracking and keeps explicitly captured test credentials in memory only. See [installation](INSTALL.md).


## U2 · GitHub Copilot

`copilot-accounts.ts` verifies identity and usage before committing a `copilot:<slot>`
connection. `copilot.ts` exclusively uses GitHub REST with cookie omission and
redirect rejection. `token-vault.ts` protects PATs in a separate storage key;
`connection-refresh.ts` integrates source-bound reads, generation fences, history
and backoff. The scheduler enforces 15 minutes even for manual clicks and parks
401 failures until replacement. Allowance is an explicit account-setting override
because the documented usage response exposes no allowance. See [COPILOT.md](COPILOT.md).

## Combined main

Website account changes use generation fences, verified identity and workspace
selection to reuse earlier accounts or create numbered defaults. Projected resets
are display-only; history, badge and alert decisions keep real readings.

History uses existing page/insights/export commands, groups source windows under
account-limit charts without joining gaps, and keeps privacy and pagination.
The static site and release/Pages workflows do not add a provider backend.
