# Install or test the hosted foundation preview (3.3)

This preview adds provider + choices and the hosted account infrastructure.
**Real independent OpenAI/Claude sign-in is not enabled.** Both providers show
“Not available yet”. Website tracking works without the local helper. Do not
install the old200MB helper to test this new UI.

## Windows: update an existing clone

Run in your repository folder (for example
`C:\Users\Jainam\Desktop\MyLimits\mylimits`). Preserve local edits before switching
branches; if Git refuses, commit or stash those edits first, never force a reset.

```powershell
git fetch origin
git switch feature/independent-provider-proof
git pull --ff-only origin feature/independent-provider-proof
node -v
npm ci --include=optional
npm run build
```

Node24+ is required only for building from source. An extracted source ZIP can
start at `node -v` from its package.json folder, without Git commands.

## Load or reload

Chrome: `chrome://extensions`; Brave: `brave://extensions`; Edge:
`edge://extensions`. Enable Developer mode → Load unpacked → select:

```text
C:\Users\Jainam\Desktop\MyLimits\mylimits\.output\chrome-mv3
```

Use your actual checkout path if different. The selected folder must contain
`manifest.json`. For an existing installation from that same folder, click Reload.
Keep the folder/extension ID to preserve local accounts, aliases and history.
Uninstalling an extension deletes its local data; do not uninstall just to update.
Refresh existing provider tabs after updating.

To build a shareable extension ZIP: `npm run zip`; extract
`.output/mylimits-3.3.0-chrome.zip`, then load its manifest folder. A packaged
extension needs no Node/npm on the end user's machine. A GitHub source archive
is source code, not the extension ZIP. CI packages appear under the working
branch's Checks → mylimits-extension-packages artifact after a successful run.

Firefox: `npm run zip:firefox`; load the extracted manifest from
`about:debugging#/runtime/this-firefox` as a temporary add-on. Persistent Firefox
installation requires Mozilla signing. Windows Chrome/Brave manual testing remains
pending; Linux Chromium results do not certify Windows behavior.

## What to test now

1. Accounts → **+** beside a service → **Use current account**. Grant site access;
   an existing website tab is focused, or one is opened. Confirm the detected
   account before saving. Rename it from account details if needed.
2. **Connect another account** shows an explicit unavailable state for OpenAI/
   Claude. It must not open your existing login and claim another account connected.
3. Verify site on/off switches are gone; Settings → Website access offers explicit
   Disconnect. Other notification/privacy switches remain.
4. Verify old nicknames, readings, alerts and history remain. Popup stays compact;
   management stays in Full dashboard. Guide remains removed.

The legacy helper remains under Settings → Legacy local helper · advanced for
existing experimental users. Its installation guide is [MULTI-ACCOUNT-INSTALL.md](MULTI-ACCOUNT-INSTALL.md).
It is not the installer-free hosted experience or a workaround that passes its
acceptance. Do not infer all ChatGPT limits from Codex/Work readings.

Hosted developer/operator setup is in [SERVER-SETUP.md](SERVER-SETUP.md).
No production hosted service URL is configured in the default package. Replacing
it requires an operator build, secure deployed service and supported provider
adapters; no end-user command can enable a missing provider route.

This branch adds a developer-only official-login transport check and records the
remaining provider access requirements. It does **not** add working independent
account login to the extension. The user interface and version remain 3.3 preview.

## Update and recovery

Export important local history before changing installations. For source rollback,
use a separate checkout/build; do not overwrite uncommitted changes. Keep backups
outside the source repository and never publish provider credentials. Database
migrations are additive and forward-only; rollback the operator image, not applied
migration SQL. See [handoff](HOSTED-ACCOUNTS-HANDOFF.md) for verification and blockers.
