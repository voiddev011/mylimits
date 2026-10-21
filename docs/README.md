# Current experiment: installer-free hosted accounts

See [trial plan and actual results](HOSTED-ACCOUNTS-TRIAL-PLAN.md) on
`feature/hosted-account-proof`. Official OpenAI device-code initiation/cancellation
was observed on a server; Claude returned a loopback callback. No real account was
authenticated and no quota fetched. The user reports the existing GPT sign-in
journey still opens the ordinary browser session; it remains unresolved. This
experiment is not a shipped cloud connector or a new extension release.

# Previous checkpoint: MyLimits 3.2 — Independent accounts preview

Current branch: **`feature/independent-accounts`**.
[Install](MULTI-ACCOUNT-INSTALL.md) · [Code checklist](MULTI-ACCOUNT-CODE-CHECKLIST.md) ·
[Status](IMPLEMENTATION-STATUS.md) · [Handoff and downloads](MULTI-ACCOUNT-HANDOFF.md).

Track available OpenAI Codex/Work and Claude Code subscription quotas from
multiple independently connected accounts in one browser dashboard. Real-account
acceptance is a separate manual checklist; this is an unpublished preview.

## Connections

- **Website tracking:** reads the account signed into this browser. No helper
  required. Other saved website accounts keep clearly dated readings.
- **Independent accounts:** optional local helper, one official CLI profile per
  account, and separate browser sign-in windows. Add B while keeping your normal
  website session on A. The extension operates subsequent connection actions.
- **History:** retained values keep their actual successful fetch timestamp.
  Missing quotas remain unknown; stale data does not become fresh on restart.

Open + → choose OpenAI or Claude → Connect an independent account. Install the
3.2 helper once, authorize its optional browser connection, then complete official
sign-in. Give each connection its own nickname. Claude requires the official
Claude Code CLI and may need one-time onboarding in its own setup window.

The official CLIs own credentials and renewal. MyLimits does not request passwords,
copy browser cookies, extract CLI tokens or put credentials into extension storage.

## Scope and behavior

OpenAI reports returned **Codex/Work** windows, not all ordinary ChatGPT chat,
image, upload or voice allowances. Claude reports supported **subscription /usage**
percentages; unknown reset timestamps stay unknown. Other providers retain their
existing website adapters and are not independently connected by this update.

Eligible refreshes respect provider waits and error backoff: at least two minutes
for OpenAI, five minutes for Claude. These intervals do not guarantee immediate
provider data. Other-device changes, website logout and actual credential renewal
are pending manual acceptance. Global session revocation may require reconnecting.

The helper is optional for website tracking and required for independent accounts.
Windows x64 provides a guided current-user installer. Linux needs official components
and xterm for first-party Claude onboarding. Firefox remains website-only.

## Interface

Compact popup: provider logos, aliases, quota bars/reset times, dated status,
refresh, + account and Full dashboard. The dashboard contains account management,
history, settings, privacy controls and diagnostics. Guide/prompt features remain
removed. The optional floating button still displays Coming soon.

Existing account IDs, nicknames, pins, alerts and history are preserved. Optional
snapshot sync copies readings; it does not maintain remote AI login sessions.
No backend is required for local independent connections.

## Develop

Run commands from the repository root with Node **22.15+**:

```sh
npm ci --include=optional
npm run dev
npm run check
npm run test:account-proof
npm run test:browser
npm run zip
npm run build:firefox
npm run zip:firefox
```

Load `.output/chrome-mv3` in Chrome/Brave/Edge after building. The packaged ZIP is
`.output/mylimits-3.2.0-chrome.zip`. Browser tests need Playwright Chromium and use
isolated fictional profiles; they do not prove real provider behavior.

Built packages do not require Node/npm. Follow the current install guide for the
matching 3.2 extension and helper, not historical 3.0/3.1 artifacts. All maintained
project Markdown belongs directly in `docs/`.

## Docker

Build the browser extension in Docker with a maintained Node major (22, 24 or
26); pass `--build-arg NODE_VERSION=22` to select Node 22. The default is Node
24. The builder runs `npm run build` and writes output to `.output`.

```powershell
docker build --build-arg NODE_VERSION=22 -t mylimits-extension-builder .
docker run --rm -v "${PWD}\.output:/app/.output" mylimits-extension-builder
```

The optional snapshot API and PostgreSQL database can be started with
`docker compose up --build`. See [SERVER-SETUP.md](SERVER-SETUP.md) for setup,
configuration and deployment limitations.

[Privacy](PRIVACY.md) · [Architecture](ARCHITECTURE.md) ·
[Provider evidence](PROVIDER-CAPABILITIES.md) · [Support](SUPPORT.md).
