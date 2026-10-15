# Phase 2 quota integration evidence

Checked 15 October 2026. Sources describe interfaces, not MyLimits live acceptance.
No authenticated provider requests were made during research; no credentials copied.

## Selected scope

- **Grok website:** source-backed `/rest/subscriptions` identity (`xaiUserId`) and
  `/rest/rate-limits` read-only POST. Require one unambiguous account ID across
  returned subscriptions before publishing a quota. A rolling window length is
  not an actual reset timestamp; reset remains unknown when omitted.
- **Perplexity website:** `/api/auth/session` requires a signed-in `user.id`, then
  `/rest/rate-limit/all` reports remaining Pro/Research/Labs/Agentic counts.
  Missing totals/reset times remain unknown; never guess a percentage or cap.
- **Cursor website (coding-plan fallback):** `/api/auth/me` stable subject and
  `/api/usage-summary` included/on-demand usage. Report true coding-plan scope,
  cents-to-USD values, returned billing window and separate reported percentages.
  Never average unrelated Auto/API percentages or equate plan fees to spend.

Gemini's quota RPC has source evidence, but stable consumer account binding and
live response semantics are not verified here. Keep its existing local activity
source. Code Assist/CLI/Antigravity/API budgets are distinct products and are not
substituted as Gemini app quotas. Cursor is the explicitly named alternative.

## Source references

- [TokenYou Grok adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/grok.js)
- [TokenYou Perplexity adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/perplexity.js)
- [TokenYou Gemini adapter](https://github.com/diegoparras/tokenyou/blob/main/src/adapters/gemini.js)
- [Grok MCP subscription payload](https://github.com/Hirasawa69/grok-mcp/blob/main/src/models/subscriptions.rs)
- [Grok MCP fixed client routes](https://github.com/Hirasawa69/grok-mcp/blob/main/src/client/mod.rs)
- [Grok MCP authentication check](https://github.com/Hirasawa69/grok-mcp/blob/main/src/main.rs)
- [Perplexity session evidence](https://github.com/mvanhorn/agent-tincan/blob/main/extension/README.md)
- [CodexBar Cursor sources](https://github.com/steipete/CodexBar/blob/main/docs/cursor.md)
- [CodexBar Cursor response models](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Cursor/CursorStatusProbe.swift)
- [CodexBar Gemini scope/migration notes](https://github.com/steipete/CodexBar/blob/main/docs/gemini.md)

Implementation is original MyLimits TypeScript with strict identity checks,
validated numeric fields, explicit evidence/scope, transient authentication,
generation fencing and sanitized synthetic tests. No source project was copied
wholesale. Current user/account/plan behavior, tab closure, other-device usage,
logout and renewal require owner-authorized live tests and remain pending.
