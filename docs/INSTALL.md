# Install and test MyLimits 3.4 Desktop preview

The extension's **+ → Connect another account** now uses MyLimits Desktop.
OpenAI uses official Codex App Server; Claude uses unmodified Claude Code.
Both are **experimental: real two-account acceptance is pending**. Codex quotas
are not every ChatGPT message/image/model allowance. Website tracking works without
Desktop. No hosted service or MyLimits sign-in is required for Desktop tracking.

## Windows: packaged setup, no npm

1. Open [branch Checks artifacts](https://github.com/voiddev011/mylimits/actions?query=branch%3Afeature%2Fdesktop-independent-accounts).
   Choose a successful run of this branch, not an older 3.2/3.3 build.
   Download `mylimits-extension-packages` and
   `mylimits-desktop-windows-x64-unsigned`. GitHub requires repository access and
   wraps Actions downloads in ZIPs; extract those download containers.
2. Extract `mylimits-3.4.0-chrome.zip`. Chrome: `chrome://extensions`, Brave:
   `brave://extensions` → Developer mode → Load unpacked → select the extracted
   folder containing **manifest.json**. Keep that folder/ID for later updates;
   do not uninstall your existing extension merely to update it.
3. Run `mylimits-desktop-windows-x64-unsigned.exe` as your normal Windows user.
   This development EXE is unsigned; public signing/store distribution is pending.
   In guided setup select OpenAI and/or Claude, then **Set up Desktop**.
   The extension is detected automatically; no extension-ID entry is required.
   If absent, load it first and choose **Retry detection**. Standard Chrome/Brave/
   Edge/Chromium Default and Profile folders are supported; nonstandard/managed
   locations remain a limitation, without a manual-ID public workaround.
4. Allow the displayed official downloads and Windows/provider setup prompts.
   Choose **Open MyLimits** when Desktop reports ready.
5. Extension → **+** → choose provider → **Connect another account** →
   **Connect Desktop** (approve native access) → **Sign in to OpenAI/Claude**.
   Official authorization opens in a fresh separate browser profile. Explicitly
   choose account B. Inspect its reported identity, enter an alias such as Personal
   and choose **Confirm account**. Privacy mode must be off to inspect/confirm
   identity; it can be enabled again afterward.
6. Repeat for account A or another account. A pending attempt resumes through
   **Continue sign-in** if the popup/dashboard was closed. A duplicate, unverified
   identity, missing dependency or failed quota check is not a fresh connection.
   If Claude requests onboarding, use **Finish Claude setup**, complete its official
   trust/terms choices, close it, then refresh.

Provider software manages separate `CODEX_HOME` / `CLAUDE_CONFIG_DIR` credentials.
MyLimits does not collect passwords, copy cookies or extract CLI tokens. The normal
website session must remain A; verifying this is part of manual acceptance.
Some OpenAI metadata is email-only: same-email workspaces cannot be independently
verified and are conservatively flagged as possible duplicates instead of merged.

## Download size and requirements

The Windows-built setup EXE is about **1.50 MB**; exact hash/bytes are in its adjacent `.sha256`
and `.json`. First OpenAI setup additionally downloads Node **37,733,703 bytes**
and Codex **167,618,721 bytes** from pinned official sources: **205,352,424 additional
bytes**, before any Claude download. Compatible private runtimes are reused.
Installed Codex is much larger than its archive; a small bootstrapper does not
mean a small installation.

Claude uses official WinGet when absent. Its additional bytes vary and are not
claimed to be measured here. It needs an eligible subscription, Claude Code
2.1.301+ and current official Windows prerequisites, including Git for Windows
where required by that installer. MyLimits reuses an installed Chromium browser.
Setup removes verified archive cache after success. Local `desktop-install-sizes.json`
records actual setup/service file bytes and successful archive downloads. Partial
failed transfers and Claude's separate downloads are excluded from that archive count.

This is guided setup with provider prompts, not a literal one-click published
product. The packaged path requires no end-user Node/npm installation, recurring
terminal commands, tokens or configuration editing. Clean laptop acceptance is pending.

## Update an existing source checkout

Run in the **inner repository** containing package.json. Commit or stash local
edits if Git asks; never force-reset them. For example:

```powershell
cd C:\Users\Jainam\Desktop\MyLimits\mylimits
git status
git fetch origin
git switch feature/desktop-independent-accounts
git pull --ff-only origin feature/desktop-independent-accounts
node -v
npm ci --include=optional
npm run build
```

Use Node 24+ for source builds. If the branch exists only remotely, `git switch`
normally creates its tracking branch; otherwise use
`git switch --track origin/feature/desktop-independent-accounts`.
A source ZIP starts at `node -v` in its package.json directory, without Git commands.
Chrome/Brave → Load unpacked or Reload the existing extension from:

```text
C:\Users\Jainam\Desktop\MyLimits\mylimits\.output\chrome-mv3
```

Use your actual checkout path if different. Hidden `.output` appears only after a
successful build. Update Desktop with the matching branch's guided EXE too;
rebuilding the extension does not update Desktop. Older helpers lacking identity
confirmation are rejected. Source packaging uses `npm run zip`; Windows setup uses
`npm run package:desktop` with NSIS installed (this is a developer build command).

## Short manual two-account test

1. Keep ChatGPT/Claude in your ordinary browser signed into **A**. Note its identity.
2. Add **B** through **Connect another account**, sign into B in the separate
   browser and confirm its identity. Ordinary tab must still be A. Add A
   independently too, with a different alias.
3. Compare each quota with the corresponding official display. Missing quotas and
   reset dates stay unknown. Use only the scope actually shown.
4. Use B on your phone/another laptop. Close provider tabs here. With the browser
   and Desktop connected, wait for the next eligible refresh, then refresh.
   B should reflect provider usage changes; A must stay correctly bound. Minimum
   intervals: OpenAI 2 minutes, Claude 5 minutes, longer after throttling/failures.
   This is periodic checking, not instant push.
5. Restart browser and Desktop/Windows, then disconnect B and verify A still works.
   Test ordinary website logout separately from provider-wide revocation. Record
   actual credential renewal when it occurs.

Record results separately for **both providers and Windows Chrome/Brave** in
[the handoff matrix](DESKTOP-ACCOUNTS-HANDOFF.md). Fixtures do not pass these steps.

## Recovery and uninstall

- Missing Desktop: reopen Start menu → MyLimits Companion → Setup, run detection
  and retry. Incompatible helper: install the matching 3.4 setup before sign-in.
- Failed/interrupted update: retry guided setup. It stops owned current-user
  processes, repairs staged program files and preserves account profiles/history.
  Unconfirmed shutdown blocks reuse rather than overlapping credential writers.
- Expired login: reconnect that account. Closing authorization is not success.
  Wrong account: discard it and retry.
- Refresh runs while an authenticated browser client is attached and the computer
  is awake/online. Browser closure may pause tracking; reopening triggers eligible
  checks. Stale/cached dates never become fresh server readings.
- Disconnect before uninstalling to request scoped official logout. Uninstall
  offers keeping/deleting local profiles; deleting them does not confirm remote
  revocation. Separately installed official Claude Code is not uninstalled.

Firefox can build/temporarily install its ZIP, but Desktop native setup for Firefox
is not implemented. Use Windows Chrome/Brave for this Desktop preview.
