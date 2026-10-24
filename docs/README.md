# MyLimits

Track provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex**,
**Cursor**, and **GitHub Copilot** in one extension.

- Website tracking uses the current browser login. Switching logins automatically
  remembers earlier accounts with their last readings; it does not independently
  refresh logged-out website accounts.
- Copilot premium requests use official REST and a separately encrypted Plan: read
  token per connection. Choose a plan allowance; checks run at most every 15 minutes.
- History groups readings by account and limit, with range chips, charts and exports.
- No local application or server is required. Website saved-sign-in policies stay off.

Unknown quotas remain unknown. Codex buckets do not cover every ChatGPT limit.
Real provider/token acceptance remains pending; fixture tests do not prove it.

[Install](INSTALL.md) · [Start here](START-HERE.md) · [Architecture](ARCHITECTURE.md) ·
[Privacy](PRIVACY.md) · [Platforms](PLATFORMS.md) · [Capabilities](PROVIDER-CAPABILITIES.md) ·
[Copilot setup](COPILOT.md) · [Remembered accounts](AUTO-REMEMBER.md) ·
[Website operations](WEBSITE.md) · [Status](IMPLEMENTATION-STATUS.md)
