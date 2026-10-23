# MyLimits privacy

MyLimits is an independent read-only usage monitor. It is not affiliated with
the AI providers it supports.

## Information used

After you enable a website, MyLimits may read its account identity, plan,
workspace identity, and usage information through narrowly selected usage and
session interfaces. Identities are handled transiently and replaced with a
salted SHA-256 account identifier before storage. Workspace routing IDs are
retained privately so the worker can query your selected workspace; they are
omitted from public UI messages and exports. A display name may include the
workspace name; an email is not used as the default display name. Nicknames
you enter are stored locally.

For Gemini and explicit Grok/Perplexity activity-only mode, the observer examines the
URL, method, and success status of a small allowlist of existing requests.
It does not read request bodies, prompt text, response bodies, or chat history.
These observations are local activity counts, not account-wide quotas.

The website and browser continue to manage login cookies. Where ChatGPT's
usage service requires a session bearer value, it is read transiently from
that website's session response and used only for that website's requests.
It is never saved, logged, included in the UI, exported, or sent to MyLimits.

## Local storage

Chrome local storage contains preferences, pseudonymous account IDs,
nicknames, usage readings, refresh state, and bounded notification and
observation/reset deduplication records, source connection state, workspace
choices and the last normalized source snapshots. IndexedDB contains historical
readings. History retention is selectable at 30/90 days, pruned on new readings and immediately when that setting is saved.

This storage is local browser storage, not a separate encrypted vault. It
does not synchronize unless you explicitly enable the optional snapshot service. Forgetting an account
removes its saved readings, nickname and history, including matching entries
from V1 recovery copies; an opaque disabled source marker can remain to reject
late messages. If it is the current tracked account,
tracking for that website is also disabled.

## Network traffic

MyLimits has no analytics, telemetry or advertising. A separate self-hosted snapshot service is optional and off by default.
The optional companion is a local background service; Codex makes its authenticated
OpenAI requests independently of website cookies.
Without sync, the extension’s own requests target only the enabled provider’s selected session and usage interfaces. Configured sync sends the allowlisted data described below only to its fixed approved server. It will not collect or forward conversations.
Opening a website or its usage page is a visible action performed by the user.

## Permissions

- `storage`: save local preferences and normalized usage.
- `alarms`: schedule modest refreshes without a continuously running worker.
- `scripting`: read permitted usage interfaces in an existing website tab
  when needed, and install narrow activity observers on enabled websites.
- `sidePanel`: display the dashboard inside Chrome's side panel.
- Optional exact site permissions: enable only websites the user chooses.
- Optional `nativeMessaging`: connect to the separately installed local OpenAI
  companion after a user click. The native manifest allows only configured
  extension IDs; the bridge has no HTTP listener.
- Optional `notifications`: show low-balance reminders after explicit approval.

Disabling a provider stops its collection and removes its site permission.
Browser-only counts never trigger account quota notifications. No network
response containing authentication material is written to project files.

## Optional OpenAI companion

Connecting opens OpenAI's official authorization page. Each connection has an
isolated Codex profile under `~/.local/share/mylimits-companion` on Linux or
`%LOCALAPPDATA%\MyLimitsCompanion` on Windows. The Windows installer applies
per-user directory ACLs, and its named pipe requires a local random bridge token. Codex manages
authorization and renewal, preferring the OS credential store with its `auto`
setting and otherwise using its local auth file. Directories are owner-only and
service-created files use umask 0077. File storage is not an encrypted vault.

Protocol 2 returns only normalized profile ID, nickname, limited identity confidence,
plan, quota percentages, reset times, authentication/error/retry state and reading
timestamps. Verified account email is displayed locally in connection management,
hidden in privacy mode, and is not persisted in extension account storage. Email
is never used as a routing key or a verified workspace ID. Local service metadata
stores a salted identity binding, not an email or token. Native messages contain
no access/refresh tokens, raw provider responses or conversation data. Sign-in
URLs remain inside the helper and its separate authorization browser profile.
Those browser directories can contain browser-owned session cookies; do not share
or sync them. MyLimits does not read those cookies.

The daemon checks eligible accounts at least two minutes apart and backs off on
failure, honoring explicit retry hints where exposed by Codex. It may continue
while Chrome is closed if the computer/user service remains running. Browser
alerts/history require the extension. Provider observation time remains unknown
when not exposed; failed/empty reads never change the last successful timestamp.
The optional phone dashboard uses synced snapshots, not independent authorization.

Pausing extension sync does not stop the service or revoke accounts. Disconnect
an account in its Overview settings to request Codex logout before deleting the
profile. Failed logout keeps the profile for retry and does not claim remote
revocation. Use OpenAI's own account/security controls when needed. Stopping the
service pauses background collection without deleting credentials. See the
[setup and removal guide](INSTALL.md).

## V2 migration, history and export

V2 validates existing V1 data, preserves IDs/preferences and a recovery copy,
and switches to V2 only after its resumable state/history migration succeeds.
These recovery copies are local and contain no website login tokens. Explicit
account forgetting prunes matching entries from the recovery copies as well.
Returning to V1 cannot recover subsequent V2-only changes automatically.

History records observation and receipt times separately, source/scope when
known and unknown gaps. Legacy samples do not gain an invented quota scope.
JSON/CSV exports contain only selected account metadata and normalized readings;
no private salts, authentication, native bridge secrets or raw provider responses.
CSV neutralizes formula prefixes in user-entered names. Clearing history keeps
account settings and does not pause collection of subsequent new readings.

Quiet hours, snooze and reset alerts are local preferences. Reset alerts require
fresh provider evidence of a new window; the passage of a countdown alone does
not establish a reset. The Guide and prompt/handoff tools were removed in 3.0.

## Phase 2 optional snapshot sync

A configured build can offer separately approved MyLimits snapshot sync. It is
off by default; ordinary website tracking/preview makes no sync requests. The
user approves that server's exact optional host grant and a named device after
MyLimits sign-in. No AI website cookie, transient bearer, native bridge secret,
installation salt, prompt or conversation is part of an upload.

Sync uploads normalized account names/plan and readings, including pseudonymous
source/account/workspace IDs, evidence and original observation time. The server
assigns device-scoped mappings and records its receipt time separately. A cloud
receipt does not make old usage fresh or establish an independent provider grant.
Preferences sync is explicit and revisioned; matching device mappings do not
silently merge separate people or accounts.

The MyLimits device token and pairing poll secret are app authorization, not AI
provider authorization. They are kept in a separate private extension storage key,
never public state/history/export. Where Chrome supports it, local storage access
is restricted to trusted extension contexts. This local storage is not an encrypted
vault. The server stores token hashes; browser dashboard sessions use short-lived
HttpOnly cookies. Configured OIDC/KMS operators remain responsible for their service.

Server deletion removes readings/names/plan and retains opaque source tombstones
needed to reject replay. Device revocation invalidates its uploads. Local forgetting
queues remote deletion even for an unacknowledged upload; offline deletion is
pending until a successful connection. Clearing local history does not automatically
clear separately synced data. Pausing sync does not revoke MyLimits/AI authorization.
Changing servers never forwards an existing app token to the new origin.

Production independently hosted AI collection remains disabled by the feasibility
gate. The tested server job/encryption boundaries use synthetic collectors/KMS;
no provider credentials are accepted for snapshot sync, no real production KMS is
configured and no public deployment was performed. If a future permitted collector
stores server-decryptable authorization, its opt-in/retention policy must be stated
separately; it cannot be described as zero-knowledge snapshot sync.

The optional website widget is disabled initially. It receives only a formatted
account nickname, status, two meter values, observation/reset times and display
preferences from the background. These public display values are visible to the
website while the widget is enabled. Its isolated content script does not read
chat content, inputs, cookies, provider tokens or sync credentials; it does not
subscribe to raw storage events. Page messages are not a command bridge.
Position/collapse/hide choices are local, outside snapshot preference sync.
Disabling it removes the UI and stops polling/listeners; tracking remains usable.


Server history follows the synced 30/90-day preference, pruned on upload and by an
hourly bounded maintenance pass. One dated last-known reading per source remains
cached for inactive-account viewing. Resource caps can trim older samples sooner.
Delete a synced account to remove its readings; delete all account data to scrub
names/plans/device names, remove history/preferences and revoke device credentials.
Opaque device/source tombstones can remain to reject stale uploads. Provider
revocation is separate from deleting snapshot copies.

The optional Windows setup reads only extension registration metadata from browser
Preferences/Secure Preferences to locate MyLimits. It does not read cookies or
transfer login state. Its uninstaller offers an explicit local-credential deletion
choice; deleting files does not prove provider-side logout.

## Version 3.0 interface changes

The floating preview receives only its enabled state and corner position. It
reads no account readings, page text, selections, prompts or conversations.
Existing per-site widget opt-ins and corner preferences remain; the old quota
widget is replaced. No account is required to enable the preview.

Privacy mode masks account/workspace names, meter labels and notification text
without overwriting the original local data. History display and exports pause
while it is on. This is a screen-sharing control, not encryption or authentication;
it does not change previously configured snapshot synchronization. Diagnostics
copy only version, counts, generic connection states and presentation settings.

The updated optional helper opens official OpenAI sign-in in a fresh local browser
profile for each connection. It does not copy cookies from your regular browser.
Codex credentials remain in its protected local account directory/OS store.
Email duplicate hints are hashed in memory only and never exported; the UI receives
only a possible-duplicate flag, never the email/hash. A matching email is a warning,
not proof of identical workspace authorization, and profiles are never auto-merged.

## 3.2 independent Claude connections

The optional helper invokes unmodified, user-installed Claude Code. Each account
has a separate CLAUDE_CONFIG_DIR and empty workspace. The documented BROWSER
setting routes its official authorization page into an account-owned fresh browser
profile. The CLI owns the callback, code exchange, credentials and renewal. MyLimits
never collects a pasted login code, Claude password, cookies or provider tokens.
A URL-free router acknowledgment confirms browser launch. Temporary authorization
URLs remain within the local helper/official browser processes and are never logged
or sent to the extension/backend. Browser-owned profile folders may contain cookies.

Only normalized /usage panel readings and allowlisted auth/account/organization
metadata cross Native Messaging. Raw terminal output stays in native memory and
is discarded. Display email crosses the local native connection for explicit
confirmation and is hidden in privacy mode. In 3.4 it is also stored in Desktop's
protected local connection metadata so interrupted confirmation can resume; it is
not saved in extension account storage or exports. Salted binding and optional
organization ID are stored locally. CLI-provided reset times are used
only when actually supplied; unknown resets remain null. Provider observation time
is not inferred from terminal redraws. Failed reads preserve their previous age.
Checks wait at least five minutes and back off on failures. First-party onboarding
may open an official setup terminal once; user trust/terms choices are not automated.
No model prompts or API inference calls are sent by the adapter.

## Desktop setup and recovery (3.4)

The guided per-user Windows installer reads only extension name/ID/profile metadata
from Preferences/Secure Preferences to authorize installed MyLimits native clients.
It does not read website cookies or copy a browser's authenticated session. It
downloads selected runtimes from official Node/npm sources with pinned integrity
checks; Claude installation uses official WinGet. Selected downloads are displayed.
No account metadata is sent to an installer service. Archive cache is removed on
successful setup. Local size reports contain byte counts and timestamps only.

Owned-process recovery records contain PID, executable path and start time; never
authorization URLs, environment, stdout or credentials. Process repair validates
current-user ownership and PID lifetime before stopping owned trees. Runtime rollback
does not overwrite provider account directories. Uninstall offers keeping/deleting
local profiles; deletion alone cannot establish remote revocation. Desktop requires
no MyLimits cloud identity or default backend connection. Optional snapshot sync
remains a separate explicit choice.

## Hosted foundation preview (3.3)

No hosted OpenAI/Claude provider is enabled by this preview and its default build
has no service URL. Website tracking needs no MyLimits identity or local helper.
If a supported hosted service is deployed later, the user must explicitly connect
MyLimits and authorize each provider. MyLimits identity is separate from provider
consent. Hosted-only device pairing does not enable uploading website snapshots.

The extension receives normalized account metadata and readings. Provider
credentials remain server-side in encrypted storage backed by operator-configured
Vault transit, or an approved runtime's protected credential store when established.
The extension stores only safe pending-attempt IDs; auth URLs/state/codes/tokens
are not saved there or sent to dashboard messages. Account-ID confirmation is
hidden by privacy mode. The MyLimits device bearer remains private background
storage, as in existing snapshot sync; it is not a provider credential.

Disconnect fences jobs and deletes the account credential locally on the server;
optional provider revocation is attempted when supported, otherwise unconfirmed.
It does not sign other accounts out. Forget additionally removes hosted readings
and attempts. Hosted history is capped at5000 readings/connection and30 days,
retaining the newest dated reading; completed attempts expire after7 days.
Existing local retention controls continue. Global data deletion includes hosted
attempts, jobs, readings, credentials and connections. Operator backups require
separate retention/deletion handling; deleting active DB records does not rewrite
old backups. Public hosting and actual provider renewal/logout remain unverified.

## Experimental request diagnostics (persistent-accounts C1)

Settings → Copy safe diagnostics includes up to 200 recent website-request
results from this browser session. Entries contain provider, redacted endpoint
path, timestamp, transport, HTTP status, normalized response type/challenge/retry
metadata, page-fallback/tab availability and elapsed time since a successful
reading. Organization identifiers and URL queries are removed. Response bodies,
request headers, credentials, account names and quota values are not collected.
Cookie state is unknown and cookie-name lists are empty until optional cookie
access is introduced in a later task.

The buffer uses extension session storage, or bounded memory when unavailable.
It is not part of account storage, reading exports, analytics or snapshot sync.
The copy button copies the sanitized report to your clipboard only when clicked;
it does not send the report anywhere. Browser exit clears the session buffer.
