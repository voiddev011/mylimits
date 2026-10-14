# Provider support and acceptance checklist

All network connectors in this initial source are prototypes until exercised
in a real desktop browser with the relevant signed-in plans.

## Claude

The reader uses `/api/account`, `/api/organizations`, and the selected
organization's `/usage` service. It handles normalized `limits` and legacy
`five_hour` / `seven_day` buckets, plus additional model and extra-usage values
when supplied. Identity is required before any reading can become an account.

Before promotion to verified support: test Free/Pro/Max/workspace accounts;
record the real current workspace identity; verify account switching and every
published reset timestamp; test missing or denied usage; sanitize captured fixtures.

## ChatGPT

The reader uses `/api/auth/session` and `/backend-api/wham/usage`. It keeps
Work/Codex windows separate from chat. It also handles code-review windows
when the service returns them. Primary windows are named from their reported
duration, including monthly windows; missing secondary windows are not invented.

Before promotion to verified support: verify personal/workspace identity;
confirm which quota pools the endpoint currently covers; test plan differences,
session expiry, account changes, and returned credits/windows. Do not relabel
these data as ordinary ChatGPT chat, image, upload, or tool quotas.

## Gemini, Grok, Perplexity

Currently browser-only request counters. Narrow path matches may miss activity
after a provider redesign, and counts exclude phone apps and other profiles.
They are not token counts, successful model-answer counts, plan caps, or remaining
search quotas. No message-count-to-quota conversion is performed.

Next: capture and validate available provider quota interfaces and identity,
then introduce separate reported meters. A site being enabled does not establish
that every feature's usage is available.

## Browser checks

- Empty install, denied site access, revoked access, and expired sessions.
- Two remembered Claude and three remembered ChatGPT records, separate aliases.
- UI writes persist after reload; disabled refresh cannot reactivate a source.
- Low/critical warning deduplication and reset behavior.
- Unknown, expired, inactive, and stale data never look like fresh empty balances.
- No stored session tokens, prompts, or conversation bodies.
- Preview never persists fake accounts or requests permissions.
- Popup, side panel, keyboard interaction, long nicknames, and dark mode.

Playwright fixture tests do not prove live provider access. Live acceptance
requires a user's already-signed-in desktop browser and comparison against each
provider's own usage screen.
