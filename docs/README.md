# MyLimits 2.1 — Phase 2 preview

Your AI usage readings, named accounts and reset times in one compact view.
Phase 2 lives on **`v2/phase-2`**. [Handoff](PHASE-2-HANDOFF.md) records the actual
checks and pending live acceptance. All maintained Markdown lives in `docs/`;
commands run from the repository root.

## Install without Node

1. Download **[mylimits-extension-packages](https://github.com/voiddev011/mylimits/actions/runs/38846628036/artifacts/12023223325)** from the verified Phase 2 run.
   Private repository downloads require GitHub sign-in. Verify the run and artifact
   exist; a green job alone is not a download.
2. Extract the artifact, then extract `mylimits-2.1.0-chrome.zip`. Keep the resulting
   folder somewhere permanent; it must contain `manifest.json` directly.
3. Chrome: `chrome://extensions`. Brave: `brave://extensions`. Enable Developer
   mode → Load unpacked → choose that folder. Edge can test the Chromium package
   using `edge://extensions`. [Firefox and platform details](PLATFORMS.md).
4. Pin MyLimits → Accounts → enable a website and approve its exact site access.
   It reuses the login already in this browser. Open the signed-in provider page
   yourself if its connector needs page context. No companion or MyLimits account
   is required for local tracking.
5. Preview with sample data to inspect it without connecting an account. Samples
   are fictional and never become saved connected accounts.

For updates, replace files **inside the existing unpacked folder**, then Reload
in Extensions. Keep its path and extension ID. Do not remove the extension first;
that deletes local data. Back up your browser profile before a preview upgrade.
V1/Phase 1 state migrates without changing existing IDs or account nicknames.

## Features

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
npm run zip                 # .output/mylimits-2.1.0-chrome.zip
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
