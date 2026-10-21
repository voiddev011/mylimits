# MyLimits 3.1 — Independent OpenAI preview

Current branch: **`feature/independent-accounts`**.
[Install/test](MULTI-ACCOUNT-INSTALL.md) · [Plan](MULTI-ACCOUNT-IMPLEMENTATION.md) ·
[Status](IMPLEMENTATION-STATUS.md) · [Handoff](MULTI-ACCOUNT-HANDOFF.md).
Independent OpenAI service/UI is implemented; real accounts remain unverified.
Independent Claude remains unavailable. The older diagnostic remains available.

## Previous 3.0 release record

# MyLimits 3.0 — Clean dashboard preview

Current development: [independent-account proof tool](ACCOUNT-PROOF.md) on
`v3/account-proof`. It is separate from the extension and does not enable a
released independent Claude connection. [Current handoff](ACCOUNT-PROOF-HANDOFF.md).

Your AI limits, named accounts and resets in one place. Development branch:
**`v3/redesign`**. [Install/update](INSTALL.md) · [Implementation plan](V3-IMPLEMENTATION-PLAN.md)
· [Current status](IMPLEMENTATION-STATUS.md) · [Handoff](V3-HANDOFF.md).
All maintained Markdown lives directly in `docs/`; commands run from the repo root.

Download the [3.0 extension packages](https://github.com/voiddev011/mylimits/actions/runs/38932629756/artifacts/12059023187),
then follow [INSTALL.md](INSTALL.md). These are built artifacts; the source ZIP
requires Node/npm and a build first.

## What changed

- Essential 440px popup: larger names/readings, refresh, + and Full dashboard.
  Normal-size six-account fixtures fit; larger collections or Large text scroll.
- Four readable dashboard sections: Overview, Accounts, History, Settings.
  Guide/prompt tools removed. Standard/Large text size is saved.
- Genuine bundled provider icons; no remote logo requests.
- Needs attention filter, local reset clock in details, privacy mode masking names
  and notifications, version/help and safe diagnostics.
- Optional floating button on selected AI sites. Clicking shows **Coming soon**.
  Off by default, no account needed, no account/prompt/conversation reading.
- Website detection and independent connections are clearly separated. Saved
  website accounts retain dated readings when a different account is signed in.
- Updated optional OpenAI helper uses isolated sign-in browser profiles. Windows
  x64 installer bundles its Node/Codex prerequisites. Live acceptance is pending.
- Existing account names, pins, history and alerts are preserved. Optional snapshot
  sync remains advanced and does not keep AI provider accounts logged in.

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
