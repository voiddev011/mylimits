# MyLimits 2.2 — compact popup and account setup

Working branch: `v2/compact-accounts`. Base: Phase 2. Main is preserved.
Date: 16 October 2026.

## Delivered interface

The toolbar popup is now a dedicated quick view, 400 CSS pixels wide with a
500px height ceiling. Its normal view contains account names, up to two selected
quota meters per account, reset times, dated/source status, a low-only filter,
refresh, a **+** button and **Full dashboard**. Six ordinary account rows fit
without scrolling at the tested Chromium viewport. More accounts scroll inside
the list; search appears above six. Pins/order and selected meters still follow
the dashboard preferences. Extra meters are indicated and available in details.

History, charts, guidance, settings, source configuration, rename/reorder/pin,
alert preferences, exports, widget and sync controls stay in the full dashboard.
Clicking a popup account opens its details in the dashboard. The screenshot is a
fictional fixture; no real provider data was used.

## Adding accounts

1. Click **+**, choose OpenAI, Claude, Cursor, Grok, Perplexity or Gemini.
2. **Detect current account** requests only that site's optional permission and
   reads its existing signed-in session. Nickname is optional.
3. Confirm **Save detected account**. No placeholder remote identity or quota is
   created when detection fails.
4. To add another account, detect the first account before choosing **Connect
   another account**. Open the provider website, switch/sign in to the other
   account, return and **Check account**, then confirm its nickname.
5. Setup can be resumed after closing the popup. Cancel ends the setup intent;
   it does not delete observed accounts or revoke website tracking. Disable a
   website in Accounts to stop its existing tracking.

Setup metadata contains a request UUID, provider/mode, nickname, original hashed
account ID and start time. It contains no credentials. Save validates the current
website connection, its successful observation time and exact candidate identity;
“another” rejects the original account. Older setup IDs cannot save or cancel a
newer intent. Per-account nicknames/reading ages remain separate.

Claude workspace selection from the first login is ignored while an account
setup is active, because the second account can have entirely different
workspaces. In-flight work is invalidated when starting another-account setup;
existing cooldown/backoff remains enforced. Claude and OpenAI recheck account
identity after fetching usage and reject a switch during the request.

## Exact connection capabilities

| Service | Available in this build | Independent refresh of multiple accounts |
| --- | --- | --- |
| OpenAI / ChatGPT / Codex | Website detection and returned Work/Codex/code-review limits; optional separate local Codex profiles | Available through the existing optional companion implementation; real sign-in/logout/renewal still unverified |
| Claude / Claude Code | Claude website subscription/workspace readings; shared coding allowance only as returned for the user's plan | Not implemented; other website accounts retain dated readings |
| Cursor | Existing coding-plan/spend website reader | Not implemented |
| Grok | Existing default-mode quota reader, optional activity mode | Not implemented |
| Perplexity | Existing returned remaining search counts, optional activity mode | Not implemented |
| Gemini | Explicit local browser activity only | No account identity or remote quota reader |

OpenAI **Independent OpenAI connection** uses the optional installed companion,
not browser token storage. A supplied nickname is applied only to the returned
new profile. Credentials stay in that companion's existing isolated local homes.
Firefox native installation remains unavailable. Claude Code in the picker is a
scope explanation, not a new Claude Code OAuth/CLI adapter.

No universally logout-independent source was added. Ordinary ChatGPT chat/image/
upload limits are separate from Work/Codex. No backend collector, token upload,
remote browser, provider app registration or paid inference probe was enabled.
A saved second website account does not acquire an independent grant. Existing
website sources remain live-unverified prototypes; users must authorize each
independent account where such a connector is available.

## Install on Windows

Download the current branch source ZIP, extract it and open PowerShell in the
folder containing `package.json`. Node 22.15+ is required.

```powershell
npm ci --include=dev --include=optional
npm run build
explorer .output\chrome-mv3
```

In Chrome/Brave/Edge, open the extensions page, enable Developer mode, choose Load
unpacked and select **`.output\chrome-mv3`**. For frequent source edits use
`npm run dev`. Updating the existing unpacked folder and clicking Reload keeps
its extension ID and local data. Uninstalling first deletes that data.

Built packages are `.output/mylimits-2.2.0-chrome.zip` and
`.output/mylimits-2.2.0-firefox.zip`, with `.output/SHA256SUMS`. Chrome package also
works for manual Brave/Edge testing; a separate Edge build was checked.
Firefox 140+: `about:debugging` → This Firefox → Load Temporary Add-on → choose
`manifest.json` from the extracted Firefox package. Temporary installs disappear
on restart. Store signing/publication is outside this change.

For no-Node installation, download **mylimits-extension-packages** from a
successful [branch Checks run](https://github.com/voiddev011/mylimits/actions?query=branch%3Av2%2Fcompact-accounts),
then extract the Chrome ZIP and load its `manifest.json` folder. The previous
2.1 artifact does not include these changes.

## Verification and pending checks

- TypeScript and 97 core tests pass, including setup persistence, identity/nickname
  isolation, stale/cancelled setup rejection, old V2 compatibility and workspace
  reset without bypassing retry timing.
- All 17 companion tests pass outside the restricted process sandbox, including
  the real child-process RPC fixture. No companion transport logic was changed.
- Chrome, Edge and Firefox builds and browser-specific manifest contracts pass.
- Chrome/Firefox archives were inspected: six optional provider origins, no test
  grants, no secrets or artifacts. SHA-256 sidecars were generated.
- Final Chromium run: **24/24 passed**, including independent OpenAI nickname
  isolation, two Claude identities with different workspaces, resume after popup
  closure, six visible rows, ten-account overflow/search and dashboard links.
- The sandbox blocks Chromium sockets and child Node execution; actual browser
  and companion checks use the approved process environment outside that sandbox.
- Live provider account/logout/renewal and real Windows DPI/browser installation
  remain pending. A fixture passing is not a live provider guarantee.

No server runtime or database migration changed. The service suite was not rerun
locally; GitHub CI passed its real PostgreSQL, phone and actual HTTP transport
checks on this code checkpoint.

Healthy website refreshes now make four fixed requests for Claude and three for
ChatGPT (including the final identity recheck), before any page fallback/retry.
At the five-minute default, that is up to 1,152/864 requests per day respectively
while running. Existing coalescing, cooldown and backoff remain in place.

## Published verification and downloads

Code checkpoint: **`7a8f48fb76babfa9b02e29a02e01fc339bb68441`**. All jobs in
[Checks run 38922290094](https://github.com/voiddev011/mylimits/actions/runs/38922290094)
passed: Linux extension, connected services and Windows logic/NSIS. This is not
live provider or real Windows install certification.

- [MyLimits 2.2 extension packages](https://github.com/voiddev011/mylimits/actions/runs/38922290094/artifacts/12054622767): verified nonempty/nonexpired Chrome/Firefox ZIPs plus checksums.
- [Optional unsigned Windows companion](https://github.com/voiddev011/mylimits/actions/runs/38922290094/artifacts/12055521330): existing optional setup, not required for website tracking.

Local Chrome ZIP: **230643 bytes**; Firefox ZIP: **229948 bytes**. Checksums are in
`.output/SHA256SUMS`. Code tree `508a9f35905ed328e3a6ac2427959cde8f206543` matches
the local checked code tree. Final documentation records these verified artifacts;
main and the prior phase branches remain unchanged.
