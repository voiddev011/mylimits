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

For Gemini, Grok, and Perplexity, the initial activity observer examines the
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
readings. History older than 30 days is pruned after a successful new reading.

This storage is local browser storage, not a separate encrypted vault. It
does not synchronize between profiles or devices. Forgetting an account
removes its saved readings, nickname and history, including matching entries
from V1 recovery copies; an opaque disabled source marker can remain to reject
late messages. If it is the current tracked account,
tracking for that website is also disabled.

## Network traffic

MyLimits has no analytics, telemetry, advertising, or cloud application server.
The optional companion is a local background service; Codex makes its authenticated
OpenAI requests independently of website cookies.
The extension's own requests target only the enabled provider's selected
session and usage interfaces. It will not collect or forward conversations.
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

Only an opaque local profile ID, plan, quota percentages, reset times, status, and
reading timestamp cross into the extension. The bridge does not return emails,
access/refresh tokens, raw API responses, or conversation data. The first sign-in
URL passes through to open the provider's authorization page.

The service polls about once a minute while your computer and user session remain
running, even after Chrome closes. Browser desktop alerts and history collection
require the extension to be running. No mobile or cloud collection is added.

Pausing extension sync does not stop the service or revoke accounts. Disconnect
an account in its Overview settings to request Codex logout before deleting the
profile. Failed logout keeps the profile for retry and does not claim remote
revocation. Use OpenAI's own account/security controls when needed. Stopping the
service pauses background collection without deleting credentials. See the
[setup and removal guide](OPENAI-COMPANION.md).

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
not establish a reset. No backend, cloud synchronization, prompt analysis or
conversation transfer is added by Phase 1.

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
