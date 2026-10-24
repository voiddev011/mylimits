# Install or update

## From a GitHub download (no Node/npm required)

Download the appropriate built ZIP under the GitHub Release's **Assets**:

- Chrome or Brave: `mylimits-3.4.0-chrome.zip`
- Microsoft Edge: `mylimits-3.4.0-edge.zip`
- Firefox: `mylimits-3.4.0-firefox.zip` (unsigned, temporary installation)

Extract it to a permanent folder. Chrome/Brave/Edge: open the browser's Extensions
page, enable Developer mode, click Load unpacked, and choose the extracted folder
containing manifest.json. Keep that folder after installation. Firefox: open
about:debugging#/runtime/this-firefox, choose Load Temporary Add-on and select the
extracted manifest.json; this installation ends when Firefox restarts.

Use the uploaded browser ZIP, not GitHub's automatically generated Source code
ZIP. Experimental provider features still require real-account validation.

## From your existing repository

Use Node 24+ and run in the repository's terminal (PowerShell on Windows):

```powershell
git fetch origin --prune
git switch main
git pull --ff-only origin main
npm ci --include=optional
npm run build
```

If Git reports local changes or diverged history, preserve them before proceeding;
do not reset or delete your work to force an update.

## Chrome, Brave or Edge

1. Open `chrome://extensions`, `brave://extensions` or `edge://extensions`.
2. Enable **Developer mode** → **Load unpacked**.
3. Select **`<repository>/.output/chrome-mv3`**, containing `manifest.json`.
   Do not select the repository root or a ZIP.
4. For later builds, use **Reload** on that same extension entry.

The Chrome output also works for manual Edge testing. A dedicated Edge build uses
`npm run build:edge` and `.output/edge-mv3`.

## Firefox

Run `npm run build:firefox`. Open `about:debugging#/runtime/this-firefox` →
**Load Temporary Add-on** → select `.output/firefox-mv3/manifest.json`.
Temporary installation ends when Firefox restarts; public permanent installation
requires Mozilla signing or a store listing. Copilot token setup is unverified on
Firefox and fails closed if the required storage protection is unavailable.

## Connect and use

Click **+ → provider → Use current browser login**, then grant the requested site
access and sign in normally. Verified login changes are remembered automatically;
there is no extra Save step. Only the current website login refreshes independently
of previously remembered cards. ChatGPT also offers experimental saved sign-in on Chromium browsers. Approve
the optional cookie/header permissions and private-window access when requested.
Other providers and Firefox do not offer saved sign-in. Session renewal must pass
identity verification before saving; provider throttling may require checking again.

For Copilot choose **+ → GitHub Copilot** and follow [token setup](COPILOT.md).
The dashboard contains account settings, notifications, privacy, Help & updates,
and History. Download history from its Download menu.

Updates remove retired provider/source data from older builds while preserving
supported accounts, aliases and preferences. Code recovery in Git is not a backup
of your browser data.

## Distribute

Run `npm run zip`, `npm run zip:edge` and `npm run zip:firefox` for the three
browser ZIPs in `.output/`. Then run `node scripts/package-checksums.mjs`. Recipients extract the archive and follow the installation
steps above. See [LAUNCH.md](LAUNCH.md) for public release and store submission.
