# MyLimits 2.0 — Phase 1 preview

Your AI usage readings, named accounts and reset times in one compact view.

Phase 1 is implemented on **`v2/phase-1`**. See the [handoff](PHASE-1-HANDOFF.md)
for exact checks and pending live acceptance. Phase 2 has not started.
All maintained project Markdown lives directly in this folder; development
commands run from the repository root, one directory above it.

## Install without Node

1. Download the [verified **mylimits-chrome** artifact](https://github.com/voiddev011/mylimits/actions/runs/38740486309/artifacts/11975222283), or use the latest successful
   [Checks run for v2/phase-1](https://github.com/voiddev011/mylimits/actions?query=branch%3Av2%2Fphase-1).
   A private repository requires your GitHub login. Wait for that run to succeed.
2. Extract the download, then extract the contained `mylimits-2.0.0-chrome.zip`.
   Keep the extracted extension folder somewhere permanent. `manifest.json`
   must be directly inside the folder you select.
3. Chrome: open `chrome://extensions`. Brave: open `brave://extensions`.
   Turn on **Developer mode**, click **Load unpacked**, and select that folder.
4. Pin MyLimits. Open **Accounts**, enable a website and approve its exact site
   access. It reuses the login already in this browser. If asked, open the
   signed-in provider page yourself and retry. No companion is required.
5. Use **Preview with sample data** to inspect the interface without site access.
   Those accounts are fictional and never become connected accounts.

This is an unpacked desktop Chromium extension, not a Chrome Web Store release.
Phone Chrome does not install desktop extensions. Firefox packaging is outside
this Phase 1 release.

**Updating an existing installation:** keep the same unpacked folder and
extension ID. Back up the browser profile before trying a preview upgrade;
replace the files inside that folder and click **Reload** in Extensions. Do not
remove the extension first: removal deletes its local data. Loading a different
folder may create a different extension ID with separate data. V1 nicknames,
settings and history migrate automatically; see [recovery](ARCHITECTURE.md).

## What works in this build

- Shared popup, side panel and dashboard; light/dark/system appearance.
- Six representative short-name account rows fit at 520 × 600 CSS pixels, 100%
  scale. Details and larger/longer layouts can scroll accessibly.
- Independent nicknames, pins, order, two chosen meters, search and low filtering.
- Verified-response Claude workspace choice, source reconnect/disconnect and
  deliberately confirmed forgetting; saved accounts retain dated readings.
- Background-first usage reads, modest alarms, persisted backoff, cancellation
  and generation checks. Defaults to five-minute checks where access permits.
- Low/critical alerts, account thresholds, mute, snooze, local quiet hours and
  optional resets confirmed by a new reading. Desktop permission is optional.
- Local 30-day history, pagination, range filters, observation bars, safe
  JSON/CSV exports and confirmed history clearing.
- Optional advanced OpenAI companion. Missing native support does not prevent
  website tracking. [Separate setup](OPENAI-COMPANION.md) is needed only for it.

## Provider boundaries

| Source | Implemented reading | Evidence / limitation |
| --- | --- | --- |
| Claude website | Account/workspace usage windows when returned | Fixture-tested prototype; selected workspace from validated membership |
| ChatGPT website | Returned Work/Codex and code-review windows | Fixture-tested prototype; ordinary chat/image/upload quotas are unknown |
| Optional OpenAI companion | Returned Codex App Server buckets, isolated profiles | Fixture-tested; real authorization/logout/renewal/Windows launch pending |
| Gemini / Grok / Perplexity | Recognized successful requests in this browser | Local activity counts; no remote account identity, cap or remaining percentage |

Website connections depend on that browser's current session. A tab may be
closed if background reads work for the provider; a logout or revoked session
can stop reads. Remembered data remains dated. Activity on another device can
only appear through a later successful provider-reported account reading.
There is no universal real-time, logout-independent tracking claim.
See the [capability matrix](PROVIDER-CAPABILITIES.md) and [manual checks](SUPPORT.md).

One Chrome profile normally exposes one current website login per provider.
Switching logins keeps earlier accounts' nicknames and last readings; it does
not give them independent credentials. Separate Chrome profiles have separate
storage. Optional companion profiles are independent local sources, not cloud sync.

## Develop and test

Use **Node 24+** and the committed lockfile:

```sh
npm ci
npm run dev             # frequent development; WXT watches source changes
npm run check           # type check, 62 core tests, 16 companion tests, build
npm run test:browser    # production build first; Playwright Chromium required
npm run zip             # .output/mylimits-2.0.0-chrome.zip
```

For a production build use `npm run build`, then load **`.output/chrome-mv3`**
from the repository root. That is the folder containing `manifest.json`.
On Windows use the same path in File Explorer, for example open your project
folder and type `.output\chrome-mv3` in its address bar.
After a new production build click **Reload** on the existing extension.

Install test Chromium only if needed: `npx playwright install chromium`.
`CHROMIUM_PATH` can select an existing compatible executable. Browser tests use
isolated temporary profiles and synthetic fixtures, block real HTTP traffic,
and cannot certify a real provider account or actual Windows DPI behavior.
CI keeps Linux browser/ZIP checks and the separate Windows logic job.

## Privacy and design

Built with TypeScript, React, WXT, Zod and Manifest V3. No application backend,
analytics or MyLimits login. Website cookies remain browser-managed; transient
usage authentication is not persisted or sent to the UI. Native authorization
stays in the separately installed companion. No prompts or conversations are
read by the activity observer. [Privacy](PRIVACY.md) · [Architecture](ARCHITECTURE.md).

## Documentation

- [Phase 1 handoff and installation evidence](PHASE-1-HANDOFF.md)
- [Implementation status / decisions / changed-file checkpoints](IMPLEMENTATION-STATUS.md)
- [Execution guide](START-HERE.md) · [Shared contracts](V2-IMPLEMENTATION-PLAN.md)
- [Phase 1](PHASE-1.md) · [Phase 2 plan, not started](PHASE-2.md)
- [Provider support](SUPPORT.md) · [Competitor research](COMPETITOR-RESEARCH.md)
- [Original starter prompt](STARTER-PROMPT.md) · [Historical build status](BUILD-STATUS.md)
- [High-level roadmap](ROADMAP.md)

## Originality

[TokenYou](https://github.com/diegoparras/tokenyou),
[AI Limits](https://github.com/TiantianFlow/ai-limits) and
[WXT](https://github.com/wxt-dev/wxt) informed research and tooling choices.
MyLimits' reconciliation, migration, scheduling, account controls and interface
are its own implementation. Packages retain their licenses; no project-wide
distribution license has been selected. This preview does not publish to a store.
