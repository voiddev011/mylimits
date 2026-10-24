# Provider capabilities

MyLimits tracks provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex** and **Cursor** through the account currently signed into each website. Ordinary ChatGPT message/image quotas are not inferred from Codex buckets. Unknown quotas and reset times stay unknown.

Saved-sign-in code remains present with every provider policy **off** and empty cookie allowlists. Private sign-in is hidden until evidence and approval enable a provider. Website cards remember prior identities without independent logged-out refresh. Copilot has separate token connections, described below.

| Provider | Website scope | Independent saved sign-in |
| --- | --- | --- |
| Claude / Claude Code | Reported website subscription/workspace windows | Disabled |
| ChatGPT / Codex | Returned Work/Codex/code-review buckets | Disabled |
| Cursor | Returned coding-plan pools and spend | Disabled |

Display labels do not add new authorization routes. Readers use website interfaces, not a new coding-tool integration. Ordinary website logout or expiry can stop reads. Background recovery cannot authenticate users or solve interactive challenges. Real two-account isolation, lifetime, renewal and logout survival are unverified.


## GitHub Copilot

Official REST API premium-request monthly gross quantities; fine-grained PAT with
Plan: read. Multiple per-token connections, verified numeric user IDs. No cookies,
website endpoints or scraping. Explicit user-selected allowance until GitHub exposes
a documented allowance field. Minimum refresh 15 minutes. Real-token acceptance
is pending; see [COPILOT.md](COPILOT.md).
