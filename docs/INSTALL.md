# Install and test MyLimits 3.4 Desktop preview

The extension's **+ → Connect another account** now uses MyLimits Desktop.
OpenAI uses official Codex App Server; Claude uses unmodified Claude Code.
Both are **experimental: real two-account acceptance is pending**. Codex quotas
are not every ChatGPT message/image/model allowance. Website tracking works without
Desktop. No hosted service or MyLimits sign-in is required for Desktop tracking.

## Windows: packaged setup, no npm

1. Open [branch Checks artifacts](https://github.com/voiddev011/mylimits/actions?query=branch%3Amain).
   Choose a successful run of this branch, not an older 3.2/3.3 build.
   Download `mylimits-extension-packages` and
   [the corrected Desktop setup](https://github.com/voiddev011/mylimits/actions/runs/39775842039/artifacts/12425040772).
   Close any older setup window before running this EXE. GitHub requires repository access and
   wraps Actions downloads in ZIPs; extract those download containers.
2. Extract `mylimits-3.4.0-chrome.zip`. Chrome: `chrome://extensions`, Brave:
   `brave://extensions` → Developer mode → Load unpacked → select the extracted
   folder containing **manifest.json**. Keep that folder/ID for later updates;
   do not uninstall your existing extension merely to update it.
3. Run `mylimits-desktop-windows-x64-unsigned.exe` as your normal Windows user.
   This development EXE is unsigned; public signing/store distribution is pending.
   In guided setup select OpenAI and/or Claude, then **Set up Desktop**.
   The extension is detected automatically; no extension-ID entry is required.
   If absent, confirm it is enabled and choose **Retry detection**. The updated
   setup reads both inline and unpacked manifests. For custom locations select
   the browser, choose **Choose browser profile...**, and select the Profile Path
   folder shown at `brave://version` (or the corresponding browser version page).
   It still discovers the extension ID automatically; no ID entry is required.
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
git switch main
git pull --ff-only origin main
node -v
npm ci --include=optional
npm run build
```

Use Node 22.15+ for source builds (Node 24 is the default Desktop runtime). If the branch exists only remotely, `git switch`
normally creates its tracking branch; otherwise use
`git switch --track origin/main`.
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
- “MyLimits not found” in Brave: earlier 3.4 installers required an inline manifest
  in saved browser settings and used a Windows PowerShell parser that could reject
  otherwise valid Chromium dictionaries. Use the updated installer linked in the
  [handoff's discovery follow-up](DESKTOP-ACCOUNTS-HANDOFF.md#brave-discovery-follow-up). It reads the unpacked extension's manifest and
  handles those dictionary keys. Your ordinary Brave `User Data\Default` profile
  should not require a custom location. Choosing its folder is a guided fallback;
  managed browser policies or an unsaved/locked settings file may still need retry.
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

## Persistent-accounts Checkpoint A (C1–C4)

For this review checkout (Node 24+, existing cloned repository):

```powershell
git status
git fetch origin
git switch codex/c4
git pull --ff-only origin codex/c4
npm ci --include=optional
npm run build
```

Preserve any local changes before switching branches. Load/reload the extension
at `<your repository>\.output\chrome-mv3` in Chrome/Brave; that folder contains
`manifest.json`. This website-only checkpoint does not need Desktop setup.
The PR's successful Actions run also supplies extension ZIPs.

Use current browser account may request optional cookie access for
OpenAI/Claude sign-in-change detection. Declining it leaves Continue without
sign-in detection; website tracking then uses ordinary retry backoff. The helper
inspects normal-store cookie metadata, not saved independent credentials. Real
provider cookie-name and logout/renewal behavior remain unverified. This preview
does not provide a browser-only independent account login.

Review these steps with your own test accounts:

1. Full dashboard → Settings → Preferences: **Recover without opening the site
   (briefly opens a background tab)** defaults on. Turn it off, save and reload
   to confirm the choice persists; turn it back on for recovery testing.
2. Connect the current website account, note its alias, quota and reading time,
   then close provider tabs. Refresh from MyLimits. If background access fails
   with an eligible browser-check error, one inactive tab may appear briefly,
   the row says **Retrying in the background**, and only that tab closes.
   A successful direct request need not open any tab.
3. Settings → Copy safe diagnostics: recovered requests show `temp-tab`.
   Keep the sanitized report for failures. Do not share cookies or raw responses.
   Repeat attempts cannot force more tabs: 30-minute spacing, eight per UTC day.
   Provider wait instructions and the ordinary click cooldown still apply.
4. Keep an unrelated tab open during recovery. Select a recovery tab if it appears:
   recovery must cancel and leave that selected tab open. With incognito access
   enabled, use a different test account there; the normal account must not switch.
5. Restart/wake the browser and check without reopening the provider. Record real
   overnight behavior over the plan's **3–4 day trial**. Sign-out, challenge and
   device-offline cases may retain a dated reading and ask for website action.

Automated fixture coverage does not establish these live outcomes. Stop at
Checkpoint A for review; merge to main and the trial are human decisions.

## Persistent-accounts Checkpoint B (C5)

For the next code-review build, use the same source setup above but switch/pull
`codex/c5` instead of `codex/c4`, build, and reload the same unpacked extension
folder. Do not uninstall it; aliases and history must remain.

1. Overview and the compact popup show the source of each account. In account
   details, Browser login identifies ordinary website tracking and Companion
   identifies an existing Desktop connection.
2. Refresh one source in its details. Its retry state and successful reading
   belong to that connection. A failure must retain its old reading time and
   leave other connected accounts untouched.
3. Current-browser setup, tab and sign-in-change signals still apply only to
   Browser login. C4's recovery setting and retry limits still apply.
4. The add-account choices are unchanged. **C5 does not enable Saved sign-in**;
   that source label is reserved for later gated work. Do not edit storage or
   manufacture a vault record to connect an account.

Two same-provider saved sources are tested with simulated readers only. Actual
independent provider login/logout/renewal remains pending; the existing Desktop
path retains its separate live acceptance checklist. Stop at Checkpoint B for
review before C6's evidence tools. Main is not merged by this development task.

## C6 evidence spike (test accounts only)

C6 is a separate diagnostic extension build for your own experiments, not the
independent-account feature. It never starts normal automatic tracking, writes
account state, or saves captured credentials. Use a **separate test browser profile**.

```powershell
git fetch origin
git switch codex/c6
git pull --ff-only origin codex/c6
npm ci --include=optional
npm run build:spike
```

Load `<repository>\.output-spike\chrome-mv3` in that test profile. It has a
different extension ID from the normal output folder. Click its toolbar icon
(it opens a persistent tab), or Details → Extension options, to open the evidence page. Required cookie/DNR/
webRequest permissions apply only to this diagnostic build. Site access is still
requested per provider when you click a test. The C6 spike supports Chromium
(Chrome/Edge/Brave); ordinary Firefox builds remain supported.

Equivalent direct flag: `$env:MYLIMITS_SPIKE="1"; npm run build`, then
`Remove-Item Env:MYLIMITS_SPIKE`. The output is still `.output-spike`, separate
from the normal `.output`. `npm run build` without the flag excludes spike files,
runtime listener and required diagnostic permissions. Normal builds retain C3's
existing optional cookie permission for sign-in-change detection.

1. **A:** choose the provider → List cookie metadata. It shows normal/all stores
   and names/flags, never values. Select names from one store, choose that capture
   store, tick explicit consent, then Capture selected names in memory. Begin with
   the names you found; use E3 to identify a minimal subset. No manual token input.
2. **D:** optionally start response-name observation before B/C. It watches only
   extension worker requests to that provider's reader paths, stops after 60s,
   and prints names only. Read/stop it when finished.
3. **B:** close provider tabs for E2, then Compare three transports. It runs the
   current background/existing-page reader, Origin/Referer rules, then captured
   replay with browser credentials omitted. Each variant can make several usage
   reads. Status 0 means a failed request, not HTTP success. Respect retry waits;
   a 429 stops later requests. C4 automatic temporary tabs are disabled in this
   diagnostic comparison so they do not confound the no-tab experiment.
4. **E3:** in this disposable profile, capture first; then clear the site's browser
   cookies through browser developer tools (not provider logout) and replay B.
   Record statuses, selected cookie names, rule-feedback availability, and whether
   unrelated provider tabs stayed unaffected. Success alone cannot establish the
   extension-initiator match. Do not remove initiatorDomains/tabIds to force a pass.
5. **E:** enable Allow in Incognito in extension details. Close other private
   windows in this test profile before Open private dry run. Sign into your test
   account yourself; Inspect private stores, then use A to capture selected names
   from that specific store. Close owned private window without signing out.
   For E4, sign into the same test account in the normal test window and log out
   there, then replay. Record private logout and global revocation separately.
6. **C/F:** ChatGPT only. C obtains a transient session token from the chosen
   current/captured source, decodes only exp and tests usage with Bearer alone.
   F uses that in-memory token for one usage request with credentials omitted and
   no DNR rule, printing only status. Expiry decoding is not token verification.
7. **Copy sanitized results**, then add live findings to
   [the evidence ledger](SESSION-PERSISTENCE-EVIDENCE.md). Keep E1–E8 separate by
   provider/browser/version/date. For E5, losing the in-memory capture ends that
   original-session trial; recapturing cannot prove its lifetime.
8. **Clear captured state and results** or close the page when finished. Captures
   are not durable across page disconnect/worker/browser restart. Only owned
   private windows are closed; no logout endpoint or cookie deletion is automated.

If rule cleanup or cooldown storage fails, stop testing and reload the diagnostic
extension; do not loosen scoping or clear provider waits. A reconnect may lose
capture data and requires a new explicit capture. Desktop is not needed for C6.

`npm run test:spike` runs the separate simulated Chromium suite, restores normal
generated types, and never contacts providers. `npm run zip:spike` writes a
clearly separate `*-spike.zip` under `.output-spike`; Actions publishes it as
`mylimits-evidence-spike-not-for-release`. Ordinary release ZIPs are checked for
spike files/runtime/required permissions. Stop after C6; C7 requires your filled
live evidence and must not turn these fixtures into a G0 decision.
