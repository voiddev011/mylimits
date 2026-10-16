# Install or update MyLimits 3.0

## Short path: packaged extension

Download the [verified MyLimits 3.0 extension package](https://github.com/voiddev011/mylimits/actions/runs/38931432647/artifacts/12058862247)
from the `v3/redesign` Checks run. Extract it, then extract
`mylimits-3.0.0-chrome.zip` into a permanent folder containing `manifest.json`.

Chrome: `chrome://extensions`; Brave: `brave://extensions`; Edge:
`edge://extensions`. Enable Developer mode → Load unpacked → choose that folder.

To update, replace files **inside the same unpacked extension folder** and click
Reload. Keep the extension ID and path. Do not uninstall: removal deletes local
accounts, preferences and history. Restart existing website tabs after upgrading.

Firefox: open `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json` from the extracted Firefox ZIP. Temporary add-ons disappear
on restart. Permanent Firefox installation needs Mozilla signing.

## From source on Windows PowerShell

```powershell
git clone -b v3/redesign https://github.com/voiddev011/mylimits.git
cd mylimits
node -v
npm ci --include=optional
npm run build
```

Use Node 24 or newer. With an extracted source ZIP, open the terminal inside that
folder and start at `node -v`. No Git setup is needed just to build.

The Chrome/Brave/Edge load folder is **`.output/chrome-mv3`** inside the project.
The leading dot matters. Build first; source folders do not contain a loadable
manifest. For frequent testing, `npm run dev` rebuilds changes while running.

For Firefox use `npm run build:firefox`; load `.output/firefox-mv3/manifest.json`.

If npm reports a missing Rolldown native binding after changing computers/Node:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci --include=optional
npm run build
```

If that still fails, preserve a copy of `package-lock.json`, remove it and
`node_modules`, then run `npm install --include=optional`. Do not copy
`node_modules` between operating systems or architectures.

## Try the update

- Popup: limits, refresh, +, Full dashboard. Clicking + opens setup in the dashboard.
- Dashboard: Overview, Accounts, History, Settings. No Guide feature.
- Settings → Text size / Privacy mode → Save preferences. Reload to verify.
- Settings → Floating preview → choose an AI site and grant its exact host.
  No AI account is required. On that site click the round MyLimits button:
  **Coming soon**. Escape/outside click closes; position/hide are available there.
- Basic detection uses the current browser login. Other saved website accounts
  keep their last reading. This is distinct from independent authorization.

## Optional independent OpenAI helper

Use the [verified Windows helper artifact](https://github.com/voiddev011/mylimits/actions/runs/38931432647/artifacts/12058892440).
Windows x64 only: its installer bundles pinned Node 24.22.0 and official Codex
0.163.0; no terminal/npm prerequisite. Run setup as your normal user, choose the
installed extension (or paste its Extensions-page ID), then Register and start.

In MyLimits → + → OpenAI → Independent OpenAI connection, authorize each account
in its fresh local browser profile. Your regular ChatGPT browser session stays
separate. Use the **updated helper**; old helpers can reuse the ordinary browser.

The installer is an unsigned preview. Windows installation/startup/uninstall and
real two-account renewal/logout behavior still require live desktop acceptance.
The helper only reports returned Codex quotas. Independent Claude and ordinary
ChatGPT model/image quotas are not implemented. Basic tracking needs no helper.
