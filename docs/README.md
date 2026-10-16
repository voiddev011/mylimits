# MyLimits 2.2 — Compact accounts preview

Your AI usage readings, named accounts and reset times in one compact view.
This upgrade lives on **`v2/compact-accounts`**. See the
[compact accounts handoff](COMPACT-ACCOUNTS-HANDOFF.md) for installation, actual
verification and remaining provider limitations. All maintained Markdown lives
in `docs/`; run commands from the repository root.

## Install / update

For the current upgrade, download the **mylimits-extension-packages** artifact from
a successful [Checks run on this branch](https://github.com/voiddev011/mylimits/actions?query=branch%3Av2%2Fcompact-accounts).
Extract the artifact, then extract `mylimits-2.2.0-chrome.zip` into a permanent
folder. It must contain `manifest.json` directly. The 2.1 Phase 2 artifact is an
older build; it does not contain this redesign.

Chrome: `chrome://extensions`. Brave: `brave://extensions`. Edge:
`edge://extensions`. Enable Developer mode → Load unpacked → choose that folder.
For an update, replace the files inside your existing unpacked folder, then click
Reload. Keep the path and extension ID; uninstalling deletes your local data.
[Firefox/platform instructions](PLATFORMS.md).

Open MyLimits → **+** → choose a service → **Detect current account**. Allow its
site access; MyLimits reuses the existing website login. For another account,
choose **Connect another account**, switch/sign in on the provider website, then
return and confirm the detected account. Both names/readings remain visible;
website mode refreshes only the current login. The picker also offers an optional
independent OpenAI connection through the existing companion.

No MyLimits account or companion is required for basic tracking. Preview accounts
are fictional and never become saved connected accounts.

## Features

- A 400px quick popup: limits, reset times, refresh, + and Full dashboard. Six
  standard rows fit without scrolling. History/settings/guidance live in the full
  dashboard; clicking an account opens its details there.
- Automatic detection and explicit account setup with saved progress, identity
  checks and nickname confirmation.
- Compact account rows, separate nicknames, order/pins, selected meters, search,
  low filtering, themes, optional low/critical and confirmed-reset notifications.
- Independent readings by source/workspace; unavailable accounts retain dated
  readings. Five-minute default polling with backoff and cancellation.
- History comparisons, separate reset windows and gaps, reset timeline, 30/90-day
  retention, cautious pacing ranges and JSON/CSV export. No invented messages left.
- Local dashboard Guide: task/mode advice, prompt templates/review and an explicit
  user-pasted handoff preview/copy/download. No paid AI calls or chat scraping.
- Optional website widget: exact selected websites, collapse/corners/hide, saved
  public values only. Off by default in Settings; conversation inputs are untouched.
- Optional self-hosted snapshot sync and responsive phone dashboard. Pair a device
  after separate MyLimits sign-in; original observation age is preserved.
- Optional advanced OpenAI native companion, including an unsigned Windows setup
  GUI and Start-menu uninstall flow. [Setup](OPENAI-COMPANION.md).

## Provider boundaries

All quota readers are source/fixture-tested **live-unverified prototypes**.

| Source | Implemented scope | Limitation |
| --- | --- | --- |
| Claude | Account/workspace returned subscription windows | Plan/model windows depend on the returned response |
| ChatGPT | Returned Work/Codex and code-review windows | Ordinary chat, images, uploads and other limits remain unknown |
| Grok | Returned Grok 4 default-mode request allowance | Other modes/reset time unknown; optional activity-only mode |
| Perplexity | Returned Pro/research/Labs/agentic remaining counts | No fabricated total, percentage or reset; activity-only mode available |
| Cursor | Included/model coding-plan pools and reported on-demand spend | Separate from a subscription fee or local cost estimate |
| Gemini | Recognized requests in this browser | Local activity only, not a remote quota |
| Optional companion | Returned Codex App Server buckets | Real authorization/logout/renewal/native launch pending |

Website logout or session expiry can stop that website source. Remembered data
stays dated. Other-device usage appears only through a later successful
provider-reported reading. There is **no universal real-time/logout-independent
tracking guarantee**. Snapshot sync copies readings; it does not collect new ones.
Production independent cloud collectors are disabled by the
[feasibility gate](HOSTED-FEASIBILITY.md).

One browser profile usually has one current website login per provider. Switching
accounts retains earlier names/readings, without giving those accounts separate
credentials. Optional companion profiles have separate local authorization.

## Develop and test

Node **24+**, committed lockfile:

```sh
npm ci
npm run dev                 # fast rebuilds while developing
npm run check               # types, core/native tests, production Chrome build
npm run test:browser         # needs Playwright Chromium and a built extension
npm run zip                 # .output/mylimits-2.2.0-chrome.zip
npm run build:firefox
npm run zip:firefox
```

Load `.output/chrome-mv3` from the repository root after building. Windows File
Explorer accepts `.output\chrome-mv3` in its address bar inside the project folder.
After rebuilding, Reload the existing extension. `npx playwright install chromium`
installs test Chromium; `CHROMIUM_PATH` selects a compatible executable.
Browser tests isolate fictional profiles and block live provider traffic.

The optional backend is a separate package: [SERVER-SETUP](SERVER-SETUP.md).
No sync server is configured in default release builds. Phone Chrome cannot load
this desktop extension; use the phone dashboard only after configuring sync.

[Privacy](PRIVACY.md) · [Architecture](ARCHITECTURE.md) ·
[Provider evidence](PROVIDER-CAPABILITIES.md) · [Support/manual checks](SUPPORT.md)
