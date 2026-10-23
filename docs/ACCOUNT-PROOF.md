# Independent-account proof tool

Updated 22 October 2026. Developer-only diagnostic; it does not install the
public Desktop experience. The later 3.2 local account service already reuses
parts of this proof; see [historical evidence](IMPLEMENTATION-HISTORY.md).
The [Desktop delivery and pending acceptance](DESKTOP-ACCOUNTS-HANDOFF.md) records the current delivery.
Neither provider has real two-account acceptance recorded here.

## Run on your Windows laptop

Inside your existing Git checkout, save or commit your own edits before switching:

```powershell
git fetch origin
git switch docs/desktop-accounts-execution-plan
npm install --include=optional
npm run account-proof
```

Use Node 22.15+. The diagnostic needs the official CLI for each provider being tested.
If absent, install only the provider you want:

```powershell
npm install -g @openai/codex
winget install Anthropic.ClaudeCode
```

Open a new terminal after installing. Check `codex --version` and `claude --version`.
Claude must expose `configDirectory` in `auth status` (documented in 2.1.268+).
See [official Claude installation](https://code.claude.com/docs/en/setup) and
[Codex installation](https://github.com/openai/codex#quickstart).
The proof tool does not install or redistribute Claude Code itself.

For a ZIP checkout, download this branch's ZIP, extract it, and run the two npm
commands inside that folder. `git switch` applies only to a Git clone.

If automatic executable discovery fails, use an absolute official executable path:

```powershell
$env:MYLIMITS_PROOF_CLAUDE = "$env:USERPROFILE\.local\bin\claude.exe"
# Only if Codex was installed at a custom location:
# $env:MYLIMITS_PROOF_CODEX = 'C:\path\to\codex.exe'
npm run account-proof
```

Do not supply `.cmd`, `.bat` or PowerShell launchers. Official Codex's `codex.js`
is also supported through Node; the standard Windows npm location is discovered.
This CLI/terminal setup is for the **proof milestone**. The intended public release
still requires the simple approved installer described in Gate 5.

## What to do in the menu

1. **Add** OpenAI `Personal`, then OpenAI `Work`. Each gets a new UUID and private
   Codex home; nothing is imported from your existing Codex or browser account.
2. **Login** to each. OpenAI authorization opens a separate browser profile for
   every attempt. Choose the intended account there. The actual CLI identity is
   shown locally after a successful read; reports contain no email addresses.
3. **Add** Claude `Personal` and Claude `Work`. The diagnostic creates separate
   `CLAUDE_CONFIG_DIR` folders. Automatic isolated-browser login for Claude is
   **not verified by this diagnostic**. Its Login action requires typing `manual`, then runs only
   unmodified `claude auth login` in the selected config directory. The CLI may
   open your default browser. Use the provider's account chooser if available;
   cancel if you cannot choose B without changing the primary session. Record
   that as a failed primary-browser check. Do not call this seamless setup.
4. If Claude requests initial setup/trust, choose **Claude onboarding**. This opens
   official Claude Code in an empty profile-owned workspace with tools/MCP/hooks
   disabled. Complete its first-run steps and `/exit`. Enter no model prompt.
5. **Check** a profile. OpenAI reads account metadata, actual quota buckets and
   metadata again. Claude checks official auth metadata, starts a fresh PTY,
   sends only `/usage`, parses its rendered panel, then checks identity again.
6. **Status** shows every diagnostic profile and its dated reading. Checks are
   manual, with at least two minutes between OpenAI checks and five for Claude,
   including failures. These are conservative prototype intervals, not provider
   guarantees. There is no background polling or bypass button.
7. **Evidence** records pass/fail/pending for a specific check. A pass is explicitly
   user-reported; it never automatically clears the overall live-proof gate.
8. **Report** writes a redacted JSON file and displays its exact path. **Sign out**
   asks for `logout`, then invokes that profile's official CLI logout. It keeps
   dated readings and does not delete credentials on a failed acknowledgment.

If the same email returns twice, the report shows the same `identityGroup`.
Profiles are not merged. Equal percentages alone do not prove a duplicate, and
different percentages alone do not prove separate accounts. OpenAI email metadata
does not establish a unique workspace ID. For a different account, create a new
profile rather than overwriting an already-bound profile's identity.

## Collect the actual proof

For **each** provider, use two real eligible accounts and compare the matching
provider usage displays. Keep your ordinary browser on A while adding B.

| Check | What to actually observe |
| --- | --- |
| Two distinct accounts | Confirm each CLI identity locally and compare each account's real quota display. Same-email/workspace ambiguity stays unresolved. |
| Primary browser unchanged | B authorization succeeds while your existing A session remains A. Claude's manual workaround is not proof of automatic isolated sign-in. |
| Provider values match | Same scope/window and percentages, allowing provider rounding and update delay. Codex is not every ordinary ChatGPT limit. |
| Other-device change | Take a reading, use only that account on your phone/another browser, wait for a real provider-visible change, then Check after cooldown. No local coding prompt. |
| Ordinary website logout | Sign out from the normal website only; check whether each separate CLI authorization still works. Record the actual result per provider. |
| Global revocation | Use the provider's revoke/sign-out-everywhere control, then check. An old reading must retain its old timestamp and must not look live. |
| Restart and renewal | Quit/reopen, verify saved readings stay dated, then check when due. Test actual expiry/renewal over time; a short restart is not proof of token renewal. |

Keep the before/after report locally. It includes up to 20 readings per profile,
request/completion timestamps, actual quota windows when known, CLI versions and
manual outcomes. `providerObservedAt` stays null when the interface does not
expose it. A new terminal read does **not** by itself prove the provider fetched a
new upstream value. Repeated status-line callbacks are not used as fresh data.

Cached report export, without calling any provider:

```powershell
npm run account-proof -- --report
```

Reports contain local UUIDs, nicknames, scope/percentages/times and identity groups.
Choose nicknames without personal information. Review a report before sharing.
Do not upload profile folders, CLI credential files, browser folders, raw terminal
output, authorization URLs, passwords, cookies or tokens to chat or GitHub.

## Storage and recovery

- Windows: `%LOCALAPPDATA%\MyLimitsAccountProof`
- Linux/macOS path: `~/.local/share/mylimits-account-proof` (macOS live behavior
  remains untested; automated native support is not a product claim).
- `profiles.json`: versioned UUID/provider/nickname/generation and locally salted
  identity bindings; no email, password or provider tokens.
- `readings.json`: bounded normalized quota history, cooldowns and manual outcomes.
- `redacted-report.json`: generated allowlisted report, never automatically uploaded.
- `profiles/<uuid>/codex` or `claude`: **first-party CLI-owned authorization/state**.
  MyLimits never reads auth token files. Browser auth folders can also contain
  session cookies owned by the browser; do not export or sync any of these folders.

The diagnostic owns an exclusive `proof.lock`. After a crash, first ensure the
diagnostic and its owned CLI processes have stopped. Only then remove that exact
`proof.lock` in the diagnostic root and restart. It does not auto-steal a live
lock or terminate someone else's CLI. Sign out each proof profile through its
official CLI before intentionally deleting local diagnostic data.
POSIX directories/files are created with 0700/0600 modes. Windows uses the normal
per-user LocalAppData ACL inheritance; adversarial ACL and clean-user installation
acceptance remain pending. This is not an encrypted credential vault claim.

## Gate 0 capability/distribution decision

| Connector | Implemented diagnostic route | Remaining condition |
| --- | --- | --- |
| OpenAI/Codex | Official App Server managed sign-in; separate CODEX_HOME; allowlisted account/quota reads; fresh external authorization browser. | Actual two-account Windows sign-in, default-browser preservation, bucket matching, cross-device updates, logout and renewal need live proof. No universal ChatGPT quota API is claimed. |
| Claude | User-installed, unmodified Claude Code; official auth/status; per-config first-party storage; experimental PTY `/usage` reader. | Automated fresh-browser sign-in, live idle freshness and acceptable monitoring/distribution use remain unresolved. The later local service has an experimental router/adapter; real acceptance is pending and no Claude binary is bundled. |

[Anthropic's credential-use conditions](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)
restrict third-party credential collection and distinguish user sign-in to
unmodified Claude Code. This implementation does not invent a Claude OAuth client,
read keychains or forward tokens, but that alone does not establish permission
for the eventual monitoring/distribution product. The clarification draft in the
plan was **not sent**. No external messages or provider applications were submitted.

The documented directory/status foundations are in
[Claude authentication](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts)
and [CLI reference](https://code.claude.com/docs/en/cli-reference).
The quota foundation for OpenAI is its
[App Server reference](https://learn.chatgpt.com/docs/app-server).
CodexBar/onWatch inspired profile ownership, error retention and safe freshness
labels; no competitor implementation was copied.

## Developer verification

```powershell
npm run test:account-proof
npm run check
```

Tests use fictional CLI subprocesses and actual local PTYs. They cover environment
isolation, Windows path handling, separate account values, changes over time,
identity fencing, same-account duplicate hints, cancellation, quota preservation,
explicit manual evidence and privacy. A real ConPTY fixture run in Windows CI is
distinct from real Windows provider/browser acceptance. See
[the consolidated historical record](IMPLEMENTATION-HISTORY.md) for actual results.

## Later local-service routing evidence

The diagnostic menu deliberately keeps its older manual Claude login guard.
The production local adapter separately implements the official BROWSER override
and has unauthenticated Linux/Windows binary routing evidence. Do not use this
diagnostic's guard as proof that the later router is absent. Real account-B sign-in,
primary-browser preservation and current remote-device quotas remain pending.
See [history](IMPLEMENTATION-HISTORY.md) and the current handoff before changing code.
