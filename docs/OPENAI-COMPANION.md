# OpenAI companion (Linux prototype)

This optional local service connects through the official Codex App Server. It
reads the quota buckets OpenAI exposes without relying on ChatGPT website cookies.
It runs no prompts and never approves tool or command requests. It is implemented
but **not yet verified with a real signed-in account**, ordinary website logout,
other-device usage, or token renewal. These are acceptance tests, not guarantees.
Ordinary ChatGPT chat limits are not established by the returned Codex buckets.

## Install on your Linux computer

Use desktop Chrome, Chromium, or Brave on a normal Linux installation. Snap/Flatpak
browser isolation can prevent native messaging. Windows, macOS and Firefox are
not supported by this first installer. Node.js 24+ is required.

1. Download the latest MyLimits code and open a terminal in its folder.
2. Build the extension:

   ```sh
   npm install --include=dev --include=optional
   npm run build
   ```

3. Load `.output/chrome-mv3` in `chrome://extensions` using Developer mode → Load
   unpacked. If already installed, click Reload. Copy the extension's 32-character
   ID shown on that page. Keep using the same unpacked folder so its ID stays stable.
4. Install the official Codex CLI:

   ```sh
   npm install -g @openai/codex
   codex --version
   ```

5. Register the companion for that extension ID (replace the placeholder):

   ```sh
   npm run companion:install -- --extension-id YOUR_EXTENSION_ID --browser chrome
   ```

   Use `--browser brave` or `--browser chromium` for those browsers. For an explicit
   Codex executable, append `--codex /absolute/path/to/codex`. The installer uses the
   current Node executable and copies the companion runtime into its local data
   directory. Run it again after changing Node versions or upgrading MyLimits.
   It does not require sudo. **Do not run it as root.**

6. Open MyLimits → Websites → **Connect OpenAI**, approve optional companion access,
   and complete the official OpenAI sign-in page. This first authorization is a
   visible browser flow. Afterwards, the companion manages its connection separately
   from the website login. A second account uses **Add OpenAI account**; choose the
   intended account in OpenAI's flow. Each connection has an isolated Codex profile.
7. Return to Overview and click the account row to rename it or configure alerts.

The installer sets up a per-user systemd service when available. If systemd user
services are unavailable it prints an exact terminal command; keep that command
running. `npm run companion:start` also runs the source daemon in the foreground,
using `codex` on PATH. Do not start it while the installed service is already running.

If a website-based ChatGPT record is also enabled, it remains a separate record.
Disable that website reader if you want only the companion connection. The companion
never guesses that two separately authorized profiles are the same account.

## What updates and when

- The daemon asks `account/rateLimits/read` about once every 60 seconds and reacts
  to `account/rateLimits/updated` by requesting a fresh authoritative reading.
- Failed reads back off up to 15 minutes. The previous successful timestamp stays
  unchanged; failed or disconnected readings are unavailable, not live balances.
- The extension receives sanitized snapshots over Chrome native messaging, checks
  the schema, updates local history, and runs its existing badge and alert logic.
- The daemon continues polling when Chrome closes, while your Linux user session,
  computer, internet connection and authorization remain available. It does not run
  on your phone or when your computer is asleep/off. It stores only the latest quota
  in memory, so browser history starts again with readings seen after reconnecting.
- Desktop alerts are sent by the extension while Chrome is running. This version
  does not send mobile notifications or desktop alerts while Chrome is closed.
- Other-device activity appears only if it consumes a quota bucket returned by
  OpenAI. No guarantee is made about every feature, model or ChatGPT chat limit.
- Website logout independence, cross-device propagation delay, and renewal must be
  confirmed with your account. A global logout, revocation, or security check can
  end access. This is not a permanent authorization promise.

## Credentials and local boundaries

Each profile has a separate `CODEX_HOME` under
`~/.local/share/mylimits-companion/accounts/<profile-id>`. Codex manages authorization
and renewal; its credential-store setting is `auto`, preferring an OS credential
store when available and otherwise its local auth file. Directories are owner-only,
files created by the service use umask 0077. Disk files are not an encrypted vault.
The extension never receives access tokens, refresh tokens, account emails, auth
files, raw upstream errors, or conversation content. Official sign-in URLs pass
through only to open the user-approved authorization page.

The Unix socket is owner-only. There is no HTTP listener or MyLimits cloud server.
The Chrome native-host manifest allowlists specific extension IDs. A user or process
with access to your OS account is within this local trust boundary.

**Pause extension sync** disconnects the browser bridge; it does not log out the
companion accounts. To disconnect an account, open its Overview details → settings
→ Disconnect account. The companion asks Codex to log out before deleting that
profile. If logout fails, it retains the profile so you can retry; MyLimits does not
claim remote revocation succeeded. OpenAI's account/security controls may also be
needed to revoke access. Cancelled unfinished sign-ins use login cancellation.

To stop background collection without disconnecting accounts:

```sh
systemctl --user disable --now mylimits-companion.service
```

Before deleting local credential files or uninstalling, disconnect all accounts
while the service is running. Then stop the service and remove its user unit and
`com.mylimits.openai.json` from your browser's `NativeMessagingHosts` directory.
Do not assume deleting a file remotely revokes credentials. Do not share the data
directory, authorization URLs, or credential files in bug reports.

## Troubleshooting

```sh
systemctl --user status mylimits-companion.service
journalctl --user -u mylimits-companion.service -n 30
```

- **Companion unavailable:** check the service, browser type, exact extension ID,
  native permission, and whether your browser is sandboxed by Snap/Flatpak.
- **Sign-in does not finish:** check OpenAI's page, cancel the unfinished account in
  its Overview settings, and try again. Upgrade Codex if RPC methods are missing.
- **Two records show the same account:** disconnect the extra profile and reconnect,
  selecting the intended account. Nicknames identify connections, not verified email.
- **No quota returned:** remaining quota is unknown. No percentage is invented.
- **Reconnect needed:** provider authorization can expire or be revoked independently
  of a website tab. Complete the official sign-in again.

## Required live acceptance test

1. Connect, confirm a real reading and match its window to OpenAI's usage page.
2. Sign out of the ChatGPT website only; confirm the companion can still read.
3. Use the same metered allowance on another device; measure update delay.
4. Close Chrome, continue using that allowance elsewhere, reopen Chrome and check.
5. Restart the service; confirm saved authorization works and no old reading is fresh.
6. Leave the service running across token expiry; confirm Codex renews authorization.
7. Disconnect/revoke access; verify reads stop and reconnect is required.
8. Connect two different accounts and confirm no identity or quota mixing.

## Main implementation

- `companion/app-server.mjs`: bounded JSON-RPC transport; initialize, correlate
  requests, time out, handle process failure, reject tool requests, hide raw errors.
- `companion/service.mjs`: isolated account profiles, sign-in, polling, backoff,
  sanitized snapshots, and logout/cancel before removal.
- `companion/limits.mjs`: normalize only supplied numeric percentages and reset times.
- `companion/daemon.mjs`: owner-only Unix socket and the browser-independent timer.
- `companion/host.mjs` / `protocol.mjs`: Chrome native-message framing and allowlist.
- `src/platform/companion.ts`: optional permission, bridge, validation and reconnect.
- `src/core/companion.ts`: merge independent records while retaining names/preferences.
- `src/platform/controller.ts`: storage, reading history, badges, alerts and commands.
- `src/ui/OpenAICompanion.tsx`: user-visible connection and pause/retry controls.

References: [App Server auth and rate limits](https://developers.openai.com/codex/app-server),
[Codex credential storage](https://developers.openai.com/codex/auth).

## Verification of this implementation

Node 24 type checking and the production Chrome build passed. The local suite
passed 33 core/parser/overview tests, 13 companion tests (including a real child
process with a fictional RPC server), and 8 browser fixture tests using
Playwright-managed Chromium. Tests cover native permission denial, independent
account updates/nicknames/disconnect, credential exclusion, stale readings,
message fragmentation, failed logout, retry backoff and the compact viewport.
They do not authenticate a real OpenAI account or install the systemd service.
Complete the live acceptance checklist above on your Linux computer.
