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
With automatic recovery enabled, eligible website checks may briefly open one
inactive normal provider tab. It uses that browser's existing login. You can turn
this off in Settings; it does not sign into another account.

## Permissions

- `storage`: save local preferences and normalized usage.
- `alarms`: schedule modest refreshes without a continuously running worker.
- `idle`: attempt eligible refreshes when your device becomes active again,
  honoring existing cooldowns and provider waits.
- `scripting`: read permitted usage interfaces in an existing or owned recovery tab
  when needed, and install narrow activity observers on enabled websites.
- `sidePanel`: display the dashboard inside Chrome's side panel.
- Optional exact site permissions: enable only websites the user chooses.
- Optional `nativeMessaging`: connect to the separately installed local OpenAI
  companion after a user click. The native manifest allows only configured
  extension IDs; the bridge has no HTTP listener.
- Optional `notifications`: show low-balance reminders after explicit approval.

Disabling website tracking stops that source. Its site permission is removed
when no enabled website/saved-sign-in source for that provider still needs it.
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
On the C3 branch, optional cookie access can report matching session-cookie
names and presence from the confirmed normal cookie store. Without permission,
or when the store/names cannot be established, it reports unknown. No cookie
values are retained in diagnostics or account state.

The buffer uses extension session storage, or bounded memory when unavailable.
It is not part of account storage, reading exports, analytics or snapshot sync.
The copy button copies the sanitized report to your clipboard only when clicked;
it does not send the report anywhere. Browser exit clears the session buffer.

## Optional sign-in change detection (C3 preview)

Connecting the current OpenAI/Claude website account offers the optional cookies
permission together with that site's access. If declined, Continue without
sign-in detection requests site access only; backoff-based tracking still works.
The helper calls the cookie API for the selected provider's normal store and uses
names, domain/store/partition metadata and expiry to notice possible sign-in
changes. Cookie values returned by that API are not copied, saved or logged.

Private-store events are excluded. Only failed/waiting website sources may
refresh after a debounced matching change; healthy accounts do not refresh for
every rolling cookie. Candidate names remain live-unverified, so a missing
candidate is unknown in production rather than proof that the user signed out.
There is no saved session vault or new independent login in C3.

## Bounded background website recovery (C4 preview)

Settings → Recover without opening the site (briefly opens a background tab)
defaults on. A recovery attempt may open the enabled provider's ordinary homepage
in an inactive tab, wait for loading/browser checks, read the selected usage
interfaces and close its own tab. This may run the provider page's ordinary
scripts and network requests under its own privacy policy. It cannot log you in
after session expiry or preserve a revoked login. Plain unauthorized or throttled
responses do not trigger recovery tabs. Selecting that tab cancels recovery and
leaves it open.

Attempts are limited to one per provider per 30 minutes and eight per UTC day.
Local storage holds provider, day, count and last-attempt time separately from
account data. Session storage holds only owned tab/window IDs, provider and
creation time for cleanup after a worker restart. These records contain no
credentials, are excluded from export/sync and never create a session vault.
The recovery preference stays local even when other preferences are synced.
Diagnostics label this transport `temp-tab`, with the same redaction rules above.

## C6 diagnostic build only

The explicitly flagged evidence spike is a separate test build with required
cookies, declarativeNetRequestWithHostAccess and webRequest permissions. It asks
for each provider's site access when you click a test. These required diagnostic
permissions, its page and its runtime are excluded from ordinary release builds;
the existing optional cookie sign-in-change grant remains unchanged.

In your separate test profile, you may explicitly select cookie names/store and
consent to a temporary in-memory capture. The diagnostic worker may then replay
those values in a tightly scoped Chrome session rule with browser credentials
omitted, or obtain a transient ChatGPT token for Bearer-only tests. Values stay in
worker memory and the temporary browser rule; they are never printed, written to
Store/local account storage, messaged to the page, exported, synced or logged.
Cookie names/flags, expiry times, store context and sanitized status/path tables
are visible. Account IDs, bodies and full headers are not returned.

Automatic production tracking does not run in this build. Rule scope requires
both the selected provider host and this extension's worker initiator/tab-less
requests. Rules are removed after requests and cleaned up at startup; failed
cleanup blocks further probes. Response observation keeps Set-Cookie names only,
filters extension-worker reader paths and stops after 60 seconds. It does not
retain renewed cookie values. Session storage contains only provider/wait times
under mylimits:spike:waits:v1; these are outside Store and never synced/exported.

Closing/disconnecting the page or clearing capture cancels work, drops secrets
and closes only the window created by its private dry run. No logout endpoint or
cookie deletion is automated. Browser/worker restart loses captures; this is not
a persistent vault or independent-account feature. Copy sanitized results copies
the visible metadata report only. Live tests and G0/G1 decisions remain pending.

## C9 dormant vault code

C9 adds storage/transport components but does not enable session capture or an
independent-account sign-in flow. All production provider policies are off and
allowlists empty. No new diagnostic/host permission is requested by this change.
Website tracking and Desktop retain their existing connection methods.

When future evidence-backed wiring activates a provider, the prepared worker
component encrypts allowlisted cookies with AES-GCM in a separate local vault,
using a non-extractable key held in IndexedDB. Cookie names and expiry metadata
are outside the ciphertext; values and ciphertext never enter the account Store,
history, snapshot sync, exports or diagnostic messages. Encryption does not defend
against malware, trusted extension code using the key, or whole-profile copying.
Storage access protection must succeed; missing/corrupt keys are not silently
replaced over saved entries. Explicit per-slot deletion does not need decryption.

C9 does not store a ChatGPT access token, copy browser cookies, collect passwords,
run model prompts or promise tracking after logout. Actual provider behavior and
activation still require G0/G1; fixture data does not establish those findings.

## C11 saved-sign-in consent and removal (gated)

All production providers remain off and cookie allowlists empty. Saved-sign-in
choices are hidden until the provider policy permits them; ordinary website
tracking and optional Desktop retain their existing behavior. Current normal
packages do not add cookie/DNR required grants or activate a saved login.

For a future approved provider, Private sign-in is offered for the first account
as well as additional accounts. It requests explicit optional site/cookie/request
access. The private window must be separate from existing private browsing;
Chromium's private windows share a cookie jar. The normal browser login is not
switched. Save current login is an explicit weaker alternative: website logout
will probably end that connection.

Before Save, captured cookie values remain in worker memory only, with a
ten-minute timeout and metadata-only recovery journal. Identity confirmation,
an editable nickname and an unchecked per-account consent box precede encrypted
persistence. Privacy mode hides candidate names/plan/reference and blocks Save.
Stored source metadata includes capture method and supplied expiry, never a
guessed lifetime. Normal account readings remain unencrypted; credentials use
the separate AES-GCM vault described above. This does not protect against malware
or someone possessing the whole browser profile. No credential is sent to sync,
exports, diagnostic messages or analytics.

Remove saved sign-in stops that source and deletes its encrypted slot, retaining
dated readings/history. Forget account deletes its slots and then removes account
readings/history. If credential deletion fails, a disabled source remains for
retry and removal is not reported as successful. Removing one account does not
delete another account's credentials. These operations do not log out provider
websites or claim remote revocation. Save closes only its own private window;
do not explicitly log out inside that window before saving.

Source, encryption and injected-browser tests are not proof of live provider
authorization, request scoping, logout survival or cross-device usage. Those
findings and G0/G1 decisions remain pending.

## C12 expiry notifications (gated)

No current production provider is enabled for saved-sign-in expiry warnings.
For a future approved provider, the watchdog reads supplied expiry and source
metadata only; it never decrypts a cookie, requests a provider endpoint or uploads
expiry records. A cookie expiry does not prove that the session remains valid.
Unknown expiry stays unknown and relies on the existing authentication-failure
path, not an invented lifetime.

Warnings use the existing optional Desktop alerts permission, quiet hours,
account mute/snooze and Privacy mode. Without Privacy mode, an OS notification
can display the account nickname; Privacy mode uses Account N. Local notification
IDs/ledger contain pseudonymous account/source identifiers, expiry timestamps and
48/24h thresholds, never credential material. The ledger remains in the existing
bounded account Store and is omitted from public UI messages, exports, history,
diagnostics and sync. Forget removes that account's notification ledger.

No additional permission, backend connection, analytics or cookie rotation capture
is introduced. Delayed alarms, sleeping/closed browsers and notification/storage
failures can delay or repeat delivery. The watchdog does not log users out,
renew sessions, alter readings or claim provider revocation. See
[session persistence](SESSION-PERSISTENCE.md) for current evidence and limitations.

## GitHub Copilot REST tokens

Optional Copilot connections use fine-grained tokens with Plan: read. The token
is encrypted separately in `mylimits:tokens:v1` using the existing non-extractable
AES-GCM key. Only official `api.github.com` REST requests receive it. Tokens are
excluded from account state, history, exports and diagnostics. Disconnect removes
the chosen token; Forget removes that account's tokens and history. See [COPILOT.md](COPILOT.md).
