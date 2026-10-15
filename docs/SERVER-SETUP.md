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
