# MyLimits

Your AI usage limits, account nicknames, and reset times in one place.

MyLimits is a local-first Chrome extension built with TypeScript, React, WXT,
and Manifest V3. It uses existing website sessions after you approve Chrome's
site access. An optional **Linux OpenAI companion** uses an explicit official
sign-in flow and an independent Codex connection. No MyLimits cloud account or
cloud server is required. See the [companion setup guide](docs/OPENAI-COMPANION.md).

## Development status

**Initial prototype.** Core account, alert, and parser tests run with Node 24
without dependencies. A complete browser build requires installing the listed
packages. Internal website interfaces must still be verified with real signed-in
accounts before a release can claim reliable provider support.

| Website | Implemented source | Important limit |
| --- | --- | --- |
| Claude | Authenticated account, workspace, and usage requests; normalized and legacy usage formats | First eligible workspace; some plans do not expose quotas. Prototype, not live-verified. |
| OpenAI companion (Linux) | Official Codex App Server sign-in, isolated profiles, quota polling and native messaging | Work/Codex buckets returned by OpenAI; live logout/renewal/cross-device validation pending. |
| ChatGPT website | Authenticated Work / Codex usage windows, including code-review windows when supplied | These are not ordinary ChatGPT chat message limits. Prototype, not live-verified. |
| Gemini | Successful, recognized browser request observations | Local counts only; account quota and cross-device usage are unknown. |
| Grok | Successful, recognized browser request observations | Local counts only; account quota and cross-device usage are unknown. |
| Perplexity | Successful, recognized browser request observations | Local counts only; Pro/Research balances are unknown. |

See [supported providers](docs/SUPPORT.md) for the validation checklist and
[architecture](docs/ARCHITECTURE.md) for the account and quota model.

## Features in this prototype

- Optional Linux OpenAI companion: independent profiles, one-minute polling, and
  a native bridge with credential-free quota snapshots. Live verification pending.
- Compact limit rows, search, low-only filtering, and sorting by balance or reset.
- Popup, side panel, and full extension dashboard with light/dark themes.
- Choose websites once; reuse existing sessions where the provider permits it.
- Rename individual saved accounts, such as **Claude Work** or **GPT Personal**.
- Preserve each account's nickname and last reading when the website login changes.
- Show reported quotas, reset countdowns, and the time of the last reading.
- Clearly separate saved accounts and browser-only activity counts.
- Configurable low-balance warnings, critical warnings, per-account thresholds,
  and per-account notification muting.
- Optional desktop notifications; no alerts from unknown, inactive, expired,
  or stale balances. Notification thresholds are deduplicated per reset window.
- Local reading history with 30-day time retention.
- Explicit preview mode with fictional accounts; preview data never becomes
  connected account data or requests browser permissions.

## Multiple accounts

One Chrome profile normally exposes one current login per website. MyLimits
remembers different verified accounts as you switch those website logins, and
you can rename each independently. An inactive account retains its dated last
reading; it is not polled with copied credentials.

Website tracking keeps one current session per website. The optional OpenAI
companion adds isolated connections for up to 20 OpenAI accounts, separately
from website cookies. Each profile has its own official Codex authorization and
nickname. This implementation still needs live account verification. Companion
connections do not add independent Claude/Gemini/Grok/Perplexity authorization.

## Run locally

Use Node.js 24 or later.

```sh
npm install
npm test
npm run typecheck
npm run build
```

In desktop Chrome, open `chrome://extensions`, enable Developer mode, choose
**Load unpacked**, and select `.output/chrome-mv3`.

Open MyLimits, choose **Websites**, and enable the websites you want. Chrome
asks for their exact site access. If the site requires a page context, open
its existing signed-in tab and refresh; MyLimits never silently creates one.

The popup's **Full dashboard** link opens the extension's own dashboard.
**Preview with sample data** is available without granting website access.

```sh
npm run dev            # WXT development
npm run check          # full type check, core tests, production build
npm run test:browser   # build first; Playwright fixture tests
npm run zip            # installable Chrome archive under .output/
```

Browser tests use an isolated temporary Chrome profile and fictional readings.
They deny real HTTP traffic. Set `CHROMIUM_PATH` if using a specific local
Chromium executable; otherwise Playwright's managed Chromium is used.
Install it first with `npx playwright install chromium`.

## Privacy and permissions

Usage data stays in the local Chrome profile. Account identifiers are salted and
hashed for website readers. Website authentication stays in request-local memory;
companion authorization is managed separately by Codex in protected local storage
and never sent to the extension. Prompt and response
bodies are never collected by the activity observer. API keys are not accepted
by this version. See [PRIVACY.md](PRIVACY.md).

Required permissions are `storage`, `alarms`, `scripting`, and `sidePanel`.
Site access, `notifications`, and companion `nativeMessaging` access are optional. Turning a website off removes
its site permission. Notification permission is only requested after a click.

## Next steps

1. Verify Claude and Work/Codex sessions, accounts, plans, and reset fields in
   real browsers; replace unsupported assumptions with captured, sanitized fixtures.
2. Add verified quota connectors for Gemini, Grok, Perplexity, and more websites.
3. Add better workspace selection and explicit support for multiple profile snapshots.
4. Add token-saving guides, task-to-model/mode recommendations, and prompt templates.

See [the roadmap](docs/ROADMAP.md). Guidance is separate from the tracking core
and will never silently read conversations or claim a local count is an exact quota.

## Research and originality

[TokenYou](https://github.com/diegoparras/tokenyou),
[AI Limits](https://github.com/TiantianFlow/ai-limits), and
[WXT](https://github.com/wxt-dev/wxt) informed the research into session-based
usage and extension tooling. The application, connectors, account engine, alert
logic, interface, and tests in this repository were written for MyLimits.
External packages retain their own licenses. No existing extension was copied
wholesale or forked as the application.

No project-wide distribution license has been selected yet. The repository is
intended to remain private during initial development.
