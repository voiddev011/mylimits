# Test MyLimits 3.1 independent OpenAI preview

Branch: `feature/independent-accounts`. This integrates the account helper into
MyLimits. Independent Claude is **unavailable**; website tracking remains available.
No real-provider signup, logout survival or renewal has been verified here.

## Download built packages (fastest)

- [3.1 extension packages](https://github.com/voiddev011/mylimits/actions/runs/39579243525/artifacts/12335143318)
- [3.1 Windows helper installer](https://github.com/voiddev011/mylimits/actions/runs/39579243525/artifacts/12336221223)
- [Successful checks](https://github.com/voiddev011/mylimits/actions/runs/39579243525)

Sign into GitHub with repository access. Extract the downloaded extension artifact,
then extract its `mylimits-3.1.0-chrome.zip` into a permanent folder containing
`manifest.json`. Load that folder in the browser. Extract the helper artifact and
run its EXE. A built package does not need npm or a terminal.
Use the checksum accompanying the particular artifact; local and CI installer
compilers produce different binary hashes from the same source.

## Windows: extension from source

From an existing clean Git clone in PowerShell:

```powershell
git fetch origin
git switch feature/independent-accounts
git pull --ff-only origin feature/independent-accounts
npm install --include=optional
npm run build
```

Use Node 24+. Stop if Git reports local changes; keep them rather than discarding.
For a GitHub source ZIP, download this branch specifically, extract it and run only
the npm commands in the extracted project. A source ZIP is not a built extension.

In Chrome/Brave/Edge, open Extensions → Developer mode → Load unpacked and select
`<your project folder>\.output\chrome-mv3`. Reload an existing extension after a
rebuild. Keep its existing folder/ID to preserve extension storage. The packaged
`mylimits-3.1.0-chrome.zip` can instead be extracted into a permanent install folder.

## Windows: helper, once

Use the **3.1** `mylimits-companion-windows-unsigned.exe` from this branch's build
artifacts. Older 3.0 helpers cannot perform the new connection protocol. This is
an unsigned development installer; it is not a published/signed public release.

Run as your normal Windows user. Finish setup, choose the discovered browser and
MyLimits installation, then Register and start. Node and official Codex are bundled.
If discovery misses an unpacked extension, the GUI allows choosing the browser
and entering the ID shown on its Extensions page. This fallback is developer setup,
not the intended stable store-ID release flow. Do not run as Administrator.

Reopen MyLimits → + → OpenAI → Connect an independent account → Enable helper
connection. Approve optional browser native access. The UI must say Helper ready.
If it requests an update, install this branch's helper and retry.

## Add Personal and Work

1. Set nickname Personal, choose independent connection and Sign in to OpenAI.
2. Complete first-party login in the **separate browser profile** it opens. Your
   ordinary ChatGPT window should remain on its original account; verify this.
3. Return to the dashboard. The helper verifies identity before reporting success.
   Check the displayed account locally; privacy mode hides it. Quota may be
   unavailable even when authentication succeeded.
4. Add Work with the same flow and sign into your other account.
5. Both appear in Overview/popup. Rename via account details. Manage sign-in,
   cancellation, reconnect and disconnect in Accounts.

If both return the same email, MyLimits reports a duplicate hint and does not
announce a second successful connection. Email cannot establish a distinct
workspace; profiles are not merged. Disconnect the unintended profile and retry
with the correct account. Login cancellation does not claim remote revocation;
Disconnect requests official CLI logout.

Checks wait at least two minutes per account, including failures; retries back off.
Only returned Codex/Work quota windows are displayed. Ordinary ChatGPT message,
image and voice allowances are separate. Unknown quotas stay unknown. Failed
checks retain visibly dated readings; opening the extension requests eligible
refreshes. Neither the UI nor these intervals guarantee real-time provider data.

For Claude, use Track this browser account. It tracks that website session only;
other saved website accounts show their last reading. The independent option
explains why it is unavailable and never opens a misleading sign-in tab.

## Live acceptance checklist — pending

- [ ] Two actual OpenAI accounts, each identity/scope/value matches provider.
- [ ] Adding B leaves the regular browser signed into A.
- [ ] Usage only on another device changes the correct next successful reading.
- [ ] Provider tabs can close; browser/helper restart keeps accounts and timestamps.
- [ ] Ordinary website logout tested separately from global revocation.
- [ ] Actual token expiry/renewal tested over time.
- [ ] Clean Windows user installation, upgrade and uninstall tested interactively.
- [ ] Equivalent Claude checks after its sign-in/monitoring blockers are resolved.

Keep credentials, auth URLs, CLI/browser folders and raw provider output private.
Share only safe errors or a reviewed diagnostic report. See
[MULTI-ACCOUNT-HANDOFF.md](MULTI-ACCOUNT-HANDOFF.md) for actual build evidence.
