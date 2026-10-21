# Optional snapshot service — local setup

Phase 2 builds a separate TypeScript/Fastify/PostgreSQL service in `server/`.
Local extension tracking does not require it. It is **snapshot-only**; hosted
provider collection is disabled by the [feasibility gate](HOSTED-FEASIBILITY.md).

## Run

Use Node 24+ and PostgreSQL 17 (or a compatible supported PostgreSQL version).
From the repository root:

```sh
npm ci
npm ci --prefix server
```

Create an empty PostgreSQL database and a dedicated least-privilege application
role. Copy `server/.env.example` to a private configuration file, replace the
placeholders and set those variables in your shell/process manager. Node/npm do
not automatically load that example file. Do not put real configuration in Git.

```sh
npm run migrate --prefix server
npm start --prefix server
```

Default binding: **127.0.0.1:8787**. There is no public deployment. Production
requires an HTTPS `APP_ORIGIN`, managed OIDC registration, appropriate ingress
and database access, backups/retention and separate operational acceptance.

Configure the MyLimits OIDC issuer, API audience, fixed JWKS/authorization/token
endpoints and client ID. Register exactly `${APP_ORIGIN}/auth/callback` with that
identity provider. A confidential client can supply `OIDC_CLIENT_SECRET` privately.
AI-provider authorization is separate and is not requested by snapshot sync.
With no OIDC configuration, authenticated requests fail closed. There is no
development password, shared bearer key or production fixture-login route.

OIDC access JWTs require issuer/audience, RS256 or ES256 signature and sub/exp/iat.
Browser sign-in uses state bound to an HttpOnly cookie, PKCE, nonce and exact
callback validation, then a short-lived opaque HttpOnly app session. API device
credentials are random, separately revocable, hashed in the database and distinct
from website/AI authorization. Set `ALLOWED_ORIGINS` to exact trusted client origins;
no wildcard credentialed CORS is supported. Cookie writes require same-origin
and `X-MyLimits-Request: 1`.

## Database / API semantics

Migrations use an advisory transaction lock and immutable checksums; adding a
migration is repeatable. Do not edit an applied migration. Tenant ownership is
derived from validated identity, never body/query owner fields. Device/source
account IDs are explicitly scoped; equal installation hashes do not merge accounts.

`POST /v1/devices` registers a named device after MyLimits web authentication.
`POST /v1/snapshots/batch` accepts validated normalized readings for that device.
`GET /v1/accounts`, `/v1/connections`, `/v1/preferences` and bounded `/v1/snapshots`
serve owner-scoped data. Snapshot pagination uses a stable timestamp/ID cursor.
Old uploads keep `observedAt`; server receipt is separate. No upload implies
independent collection or establishes provider account identity.

`PATCH /v1/preferences` requires `expectedRevision`; conflicts return 409 rather
than silently overwriting another device. DELETE connection pauses that source;
DELETE account removes its saved readings and tombstones its mapping. Deleting
all account data requires `confirmation: delete-all` and revokes device tokens.
Old queued uploads cannot resurrect a deleted mapping or revoked device. Retained
tombstones hold opaque IDs needed for rejection; nicknames/plan/readings are removed.

Bodies are capped at 512 KiB, batches at 100 samples, pages at 200, and authenticated
API traffic at 120 requests per owner per minute per API process. Upstream provider
collection is unavailable; the refresh route cannot fetch arbitrary URLs. At scale,
use shared ingress budgets as well as these local limits.

## Verify

Set `MYLIMITS_TEST_DATABASE_URL` to a dedicated PostgreSQL test database. Tests
create/drop only their own random schema and use synthetic authentication/data.

```sh
npm run check --prefix server
```

Fixture verifier injection is rejected outside explicit test mode. Tests exercise
cross-tenant reads/writes/deletion, owner forgery, device binding, duplicate/old
uploads, tied timestamp pagination, preference conflicts, revoked devices,
tombstones, callback binding, size/origin limits and fail-closed auth. Passing
these tests does not configure a real OIDC tenant or a hosted AI connection.

## Gated jobs and credentials

`npm run worker --prefix server` runs the durable lease/cleanup loop. It is not
needed for snapshot-only viewing/upload. The production collector registry is
empty; an environment flag cannot enable fixture collectors or provider login.
No provider OAuth client, consent callback or production KMS adapter is configured.
That remaining provider-specific work is blocked by P2-01, not solved by the queue.

Jobs coalesce refresh/renewal per connection, lease for 30 seconds, expire after
six failed attempts, honor bounded Retry-After and persist provider-wide budgets
(default 30 attempts/minute, four concurrent jobs/provider). Auth rejection pauses
that connection. Identity/workspace/generation/lease checks fence every commit.
No raw upstream error body enters job diagnostics.

The credential boundary encrypts each value with a random AES-256-GCM data key
and tenant/connection/generation authenticated context; a configured KMS must
wrap/unwrap that key. Without KMS, storage/decryption fails closed. Only synthetic
tests provide an in-memory KMS; there is no hard-coded production key. Optimistic
credential revisions prevent stale refresh-token rotation. This future mode would
be worker-decryptable, not zero-knowledge. Snapshot sync never accepts these values.

A managed-source disconnect advances generation and cancels jobs before cleanup.
Supported revocation can retry at most three times within 24 hours, retaining an
encrypted credential only for that cleanup. Failure remains explicitly unconfirmed;
local disconnection is not remote logout. Replaced credential generations are
protected from old cleanup. Explicit data deletion removes credential envelopes.

## Optional dashboard and extension pairing

Build the responsive same-origin dashboard with `npm run build:web --prefix server`
before starting the service. It is served at `APP_ORIGIN`; no public host is
created by the build. On a phone it needs an intentionally configured reachable
HTTPS service; a laptop's loopback address is not reachable from a separate phone.
This phase tests a 390px phone layout locally without publishing it.

For an operator/development extension build, set **MYLIMITS_SYNC_ORIGIN** to that
service origin before `npm run build` or `npm run dev`. HTTPS is required except
loopback HTTP. Paths/query strings/userinfo are rejected. The build declares only
that server's optional host grant; request URLs stay bound to the configured origin.
An ordinary build with no origin declares no extra server host and exposes no
working sync-login button. Set the server's `ALLOWED_ORIGINS` to the installed
extension's exact `chrome-extension://...` origin. Published store IDs can be
configured once by the operator; an unpacked build has its own ID.

In the extension **Settings → Optional snapshot sync**, click Connect and approve
the configured server's site access. The MyLimits dashboard opens with a one-time
code; sign in to MyLimits and explicitly approve the named device. This is not an
AI-provider login. The extension polls with a separate private secret and receives
its own revocable MyLimits device token once. Codes expire after ten minutes.
Pairing codes alone cannot obtain a device token; callback login preserves only
a validated pairing-code return path, never an arbitrary redirect.

**Sync now** uploads normalized readings only. Five-minute alarms retry bounded
batches while the browser runs. Acknowledgements and backoff persist across worker
restarts. Source identity includes device and local source ID; identical hashes
on separate devices do not automatically merge accounts. The phone dashboard
labels snapshot-only mode and original last-reading time. It does not collect
fresh data when all local sources are closed/signed out.

Reading sync does not silently overwrite preferences. Push local preferences or
explicitly apply cloud preferences; revision conflicts require reviewing/applying
the remote version before another push. Aliases map only through this device's
known server IDs. Applying remote settings cannot grant local notification access.

Pause stops sync requests but retains the local app-device credential. Disconnect
revokes the sync device and leaves local tracking/data intact; a failed remote
revocation stays unconfirmed for retry. Revoke devices/delete synced data in the
web dashboard independently of provider logout. Forgotten local accounts enqueue
a device/source deletion marker even if an upload acknowledgement was lost.
That source stays excluded, and server tombstones reject old/late uploads. Offline
remote deletions remain visibly pending. Changing configured server origin never
sends an old device credential to the new origin; remove the local connection and
pair anew. Locally removing a connection is not confirmation of old-server revocation.

Run `npm run test:web --prefix server` with an isolated test database and available
Playwright Chromium (`CHROMIUM_PATH` optional) for real-service phone UI acceptance.
Fixture sessions are seeded directly in the private test DB; there is no fixture
login endpoint in the application.

## Phase 2 operational bounds

OIDC tokens also require an issued-at age of at most 24 hours, no future issue
time, and correct authorized-party binding for multi-audience ID tokens.
Login/callback and pairing attempts each have bounded per-IP in-process budgets;
production still needs shared ingress limits. The API's body/batch/page/owner
limits do not make a public deployment automatically production-ready.

Per owner: at most 20 active / 200 total devices, 100 active / 1,000 retained
account mappings and 2,000 source connections. Snapshot retention is 30/90 days
from the synced preference, plus one last-known reading per source. Upload and
hourly maintenance prune history; the resource cap retains at most 20,000 older
samples plus those latest source readings. Original observation dates remain
unchanged. Tombstones prevent replay and are never recycled into another source.

For a real extension transport fixture (synthetic account/session and temporary
PostgreSQL schema only):

```sh
npm run build:web --prefix server
MYLIMITS_SYNC_ORIGIN=http://127.0.0.1:8789 npm run build
npm run test:transport --prefix server
npm run build   # restore the default local-only package before distribution
```

On PowerShell set `$env:MYLIMITS_SYNC_ORIGIN` for that build and remove it before
building the default release. Test host grants exist only in temporary fixture
copies; shipped packages keep every provider/server grant optional.

## Hosted account foundation (current feature branch)

The API has owner-scoped `/v1/hosted/` connection/attempt operations and public
`/hosted/capabilities`. Both production providers are unavailable. This is not a
working OpenAI/Claude hosted login deployment. There is no generic callback,
credential-upload endpoint or environment switch that enables fictional drivers.

Private operator package: `server/Dockerfile` (build from repository root),
`server/compose.yaml`, and `server/.env.example`. End users do not install these.
Copy the example to a private `server/.env`, supply a private database password
and DATABASE_URL pointing to `db:5432`, valid MyLimits OIDC settings, exact app and
extension origins, and an HTTPS reverse proxy before external use. Compose only
publishes loopback port8787. The existing OIDC callback is `/auth/callback`; this
is MyLimits identity, not provider authorization. Provider-specific callbacks are
not configured until the provider route has passed its gate.

```sh
docker compose --env-file server/.env -f server/compose.yaml build
docker compose --env-file server/.env -f server/compose.yaml up -d
```

On managed hosts needing a proxy CA, supply the documented BuildKit proxy_ca
secret; retain proxy routing and TLS verification. Build and tag immutable image
versions for deployment. API migrations are additive and checksum-validated; back
up PostgreSQL before upgrading and roll back the application image, not applied
migration SQL. Validate restoring backups in a separate database.

Real envelope-key wrapping is implemented with Vault transit. Configure
VAULT_TRANSIT_ORIGIN (HTTPS origin), VAULT_TRANSIT_KEY and VAULT_TOKEN_FILE. Provision
an operator-controlled derived transit key with export/backup disabled. Mount the
least-privilege token file read-only (Unix0600; ensure container user can read it).
Give only encrypt/decrypt permission on that key, rotate Vault tokens and wrapping
key versions, retain decrypt access to old versions while envelopes exist. Never
store the master wrapping key in PostgreSQL or extension storage. Startup rejects
non-private token files; hosted adapters cannot start without MyLimits identity
and configured encryption. Vault availability and policy require actual operator
acceptance; mocked transit tests do not prove a production KMS deployment.

The private API image runs as non-root, with a read-only filesystem, bounded tmpfs,
no extra Linux capabilities and no local provider profiles. No production adapter
runtime is bundled. A provider-approved CLI route would additionally need isolated
server-owned profiles, encrypted persistence and bounded process management; do not
mount users' local CLI caches or claim the image already provides that integration.

Operator bounds: maximum200 connections/owner, 3 simultaneous authorization attempts,
10-minute attempt lifetime, authenticated request budget120/minute. Collection
bounds/retention are described by the current hosted implementation and status.
Restrict outbound destinations at deployment; do not expose database/Vault publicly.
No infrastructure was purchased or publicly deployed by this change.

Cost worksheet: total = API + PostgreSQL/backups + KMS + active official runtimes +
egress. Quota sources and provider worker memory/latency remain unmeasured because
no provider is enabled; no per-user price estimate is justified yet. Before launch,
measure idle API/worker memory, successful refresh duration, retained reading size,
and required provider-permitted interval. For N accounts and interval S seconds,
upper request demand is N*86400/S per day before throttling/backoff; use measured
values to set admission limits. This is a capacity formula, not measured pricing.
