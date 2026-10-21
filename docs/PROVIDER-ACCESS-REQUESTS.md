# Provider access — prepared requests, not submitted

22 October 2026 (Asia/Calcutta). Product: MyLimits, repository
`https://github.com/voiddev011/mylimits`.
**No provider has approved this integration. These drafts are not credentials or
evidence of a working login. No message/application has been sent.**

## OpenAI: concrete prerequisite

The [hosted offering guidance](https://developers.openai.com/siwc/token-sharing-open-source)
directs remotely hosted products to the interest route. The
[client-ID page](https://developers.openai.com/siwc/request-client-id) describes
restricted commercial availability. Neither establishes a public read-only quota
scope. Identity login or inference permission alone does not establish quota access.

The [published OSS registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
uses a user-machine HTTP loopback redirect, a per-registration client, PKCE/state/
nonce, and validated token claims. Its account chooser instructions are useful
but do not prove browser-session preservation. An operator-hosted MyLimits service
cannot substitute its HTTPS address into that loopback contract without support.

### Prepared interest-form information

Open [the official interest form](https://openai.com/form/sign-in-with-chatgpt-interest/).
These are its observed fields; the owner supplies their actual details:

| Field | Prepared value / missing information |
| --- | --- |
| Work email, first name, last name | Owner to supply; none inferred from GitHub |
| Company name | MyLimits project; supply actual legal entity if required |
| Website URL | Owner's real product page/domain; no deployed website exists here |
| Job title | Owner to supply if applicable |
| Requested capabilities | Form offers identity-only or identity + plan inference; quota-only is not a listed choice. Clarify this mismatch rather than falsely claiming inference is needed. |
| Product description | Draft below |

Prepared description:

> MyLimits is a browser extension with an operator-hosted account service. Users
> want to connect multiple personal/work OpenAI accounts through official consent
> and see only the usage allowances and reset times OpenAI makes available for
> each. We do not need conversations, prompts, generated content or inference.
> Please advise whether a hosted, read-only quota integration is supported and
> what registration, scopes and endpoints apply. Authorization must let users
> choose another account while preserving their ordinary ChatGPT website login.
> The service would protect permitted credentials server-side, obey refresh
> limits, support individual disconnect/deletion and show only returned quota
> scopes. We will not represent Codex allowances as all ChatGPT limits.

Request these technical answers before writing/enabling a production driver:

1. Is quota-only operator-hosted monitoring supported? What onboarding applies?
2. Which client registration, grant, issuer, API audience and scopes authorize it?
3. Which HTTPS callback is permitted, and how can official account selection
   preserve the normal browser's other account session? Are multiple registrations
   for the same MyLimits owner supported?
4. Which signed identity claims or documented account API identify immutable user
   and workspace IDs? Email alone is insufficient.
5. Which read-only quota endpoint/method, scopes, reset timestamps and refresh
   cadence are supported? Are Codex App Server-managed logins permitted for this
   product? Its observed account metadata lacks immutable IDs (see handoff).
6. What renewal, rotation, revocation, deletion and distribution requirements apply?

The form is an access request, **not a promise of approval or a quota API**.

## Anthropic: concrete prerequisite

[Official conditions](https://code.claude.com/docs/en/legal-and-compliance)
distinguish third-party subscription authentication from users authenticating
directly into an unmodified hosted Claude Code binary. That hosting exception
does not establish permission or an interface for this quota-only product.
We have not found a supported automatic remote callback satisfying the required UX.

The [authentication guide](https://code.claude.com/docs/en/authentication) describes
separate configuration directories and manual login-code fallback. The
[remote troubleshooting guide](https://code.claude.com/docs/en/troubleshoot-install#oauth-login-fails-in-wsl2-ssh-or-containers)
explains why callbacks fail across machines. Manual code entry is not the requested
automatic flow and is not silently offered as completion.

Use the provider contact route linked from the official conditions, including
[Contact sales](https://www.anthropic.com/contact-sales), for use-case clarification.
No availability, support response or approval is guaranteed.

Prepared request:

> We are developing MyLimits, an extension with an operator-hosted usage dashboard.
> Users want several independently authorized Claude subscription accounts in one
> view. We propose running only unmodified official Claude Code in isolated
> per-account environments, with users authenticating through Anthropic's own
> flow. We would not create a custom consumer OAuth client, extract tokens, copy
> browser cookies, intermediate inference, or collect passwords. Please confirm
> whether using the official binary solely to display available subscription
> usage is permitted. If so, which supported automatic hosted sign-in completion,
> identity and usage interfaces apply? Our desired login must select account B
> while the user's normal browser remains on A, with no local helper or manual
> authorization-code copying.

Required answers: applicable hosted-binary agreement; automatic remote completion;
account chooser/session behavior; verified stable user/workspace identity; official
quota-only interface and cadence; credential renewal/revocation; permitted runtime
distribution, updates and private profile persistence. API credits and a corporate
gateway are different account types and cannot replace subscription limits.

## Private deployment packet — ready for decisions, not deployable provider code

Reuse `server/compose.yaml`, `server/Dockerfile`, `.env.example`, migrations and
[operator instructions](SERVER-SETUP.md). The API/worker preview already exists.
Deploying it now would still expose **zero working provider drivers**.

| Dependency | Exact operator action / state |
| --- | --- |
| Provider eligibility | Obtain the contracts/answers above; currently absent |
| Operator account and controlled HTTPS domain | Owner supplies; no account/identity or domain configured |
| MyLimits identity tenant | Register actual issuer, audience, JWKS/auth/token endpoints and client ID |
| MyLimits owner-login callback | Existing `${APP_ORIGIN}/auth/callback`; this is NOT an AI-provider callback |
| Provider callback | Request a separate provider-approved HTTPS callback; no route/path is implemented or approved yet |
| Extension origin | Register exact installed/store origin for CORS and package with `MYLIMITS_SYNC_ORIGIN`; current package has none |
| Database | Dedicated PostgreSQL role/database, private credentials, migrations, backups and restore test |
| Credential protection | Private Vault transit service/key/policy and token file; real Vault acceptance pending |
| Provider runtime | Package only the official software actually permitted/required by the approved mechanism; no CLI runtime is in the current image |
| Pilot limits | Start with two accounts/provider; use provider-approved refresh cadence; do not expose registration publicly before acceptance |
| Deletion/recovery | Test per-account disconnect, encrypted credential/profile deletion and restart/restore before user onboarding |

No purchase or deployment occurred. Existing idle API/worker measurements are
historical, with zero active providers; they do not estimate CLI hosting cost.
After a supported route exists, measure memory/process lifetime and requests per
account. A proposed operator spending cap requires owner agreement before purchase.
Do not buy hosting merely to discover that the provider contract is unavailable.

## Resume trigger

Provider supplies a supported hosted mechanism and access/configuration, or new
official documentation establishes one. Implement the smallest actual
login → immutable identity → quota read first, then two-account acceptance.
Submitting a form alone does not unblock quota implementation or complete a gate.
