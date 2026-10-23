# Platform and installer acceptance

> Historical platform notes below. Current 3.4 online Desktop setup, automatic
> extension detection and measured downloads are documented in [INSTALL.md](INSTALL.md)
> and the [handoff](DESKTOP-ACCOUNTS-HANDOFF.md). It downloads selected official runtimes;
> older large bundled installers are superseded. Real Windows provider acceptance
> remains pending; Firefox native setup is not implemented.

Phase 2 builds separate Chrome/Brave, Edge and Firefox MV3 packages. This is an
unsigned desktop preview, not a store release. Linux Chromium fixtures exercise
the extension. Actual Windows Chrome/Brave/Edge and Firefox provider/native
acceptance are **pending**; building/linting is not live support certification.

## Extension install

Chrome/Brave: extract `mylimits-2.2.0-chrome.zip`, open `chrome://extensions` or
`brave://extensions`, enable Developer mode, Load unpacked, choose the folder
containing manifest.json. Edge: `edge://extensions`, use the Edge build folder
`.output/edge-mv3` (the Chromium package can also be tested there).

Firefox 140+: `about:debugging` → This Firefox → Load Temporary Add-on → select
`.output/firefox-mv3/manifest.json` or the extracted Firefox ZIP manifest. Temporary
installs disappear on restart; signing/store distribution is separate. Firefox
uses `sidebar_action` and an event-page background instead of Chrome's side-panel
and service-worker APIs. Full dashboard remains available from the popup.
Firefox native host installation is not supplied; its optional companion control
explains the fallback instead of offering a broken connection.

The default Firefox package declares no data transmission. A configured sync
build instead declares optional identity/authentication/website-activity and
technical-interaction data permissions. Its explicit sync button requests those
alongside the exact server origin; transport checks them before every request.
Revoking the data grant pauses sync. Firefox 140+ provides built-in consent;
[Mozilla's consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
was reviewed 16 October 2026. No conversations are part of snapshot sync.

## Optional Windows installer

`mylimits-companion-windows-unsigned.exe` is a normal per-user NSIS installer with
Start-menu Setup/Uninstall entries. **Unsigned development artifact.** It needs
Node 22.15+ and the official Codex CLI already installed. Open Setup, select the
automatically detected MyLimits browser/profile, then Register and start. Detection
reads extension name/ID metadata from browser Preferences/Secure Preferences;
it does not read cookies, copy sessions or report unrelated profile settings.
A manual ID fallback covers locked/missing/nonstandard profiles. Chrome, Brave,
Edge and Chromium have separate HKCU native-host registrations. Reload MyLimits
and approve optional native access before connecting an OpenAI account.

The installer copies runtime files to stable per-user directories, requests a
per-user sign-in scheduled task and restricts credential-directory ACLs. It never
runs as Administrator. Setup output distinguishes host registration from a
failed task setup. The extension cannot install executables automatically.

Before uninstalling, disconnect accounts in MyLimits to request provider logout.
Uninstall stops/removes the task and owned host registrations. It offers a
separate choice to delete local profile credentials; keeping or deleting local
files does not confirm provider-side revocation. Cleanup failure retains setup
files for retry. Linux's existing systemd/user installer remains available;
macOS native support has not been implemented.

## Build and checks

```sh
npm run build
npm run build:edge
npm run build:firefox
node scripts/check-packages.mjs
npm run zip
npm run zip:firefox
npm run package:companion   # NSIS installed; MAKENSIS may select its path
```

The installer packaging writes a SHA-256 sidecar. Certificate purchase/signing,
store submissions and live OS/provider verification remain external release work.
Windows CI parses the PowerShell scripts, constructs the GUI without showing it
and compiles the installer; it does not replace a clean desktop install/update/
uninstall, native browser handshake or OpenAI authorization test.
