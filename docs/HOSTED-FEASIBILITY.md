# Hosted quota feasibility — P2-01

Checked **15 October 2026**. Decision: **snapshot-sync-only**. No independently
hosted quota collector passed the registration/authorization/live-account gate.
This does not block building/testing the optional authenticated snapshot API.

## Evidence checked

| Candidate | Evidence | Result for this deployment |
| --- | --- | --- |
| OpenAI Codex App Server | [Official RPC documentation](https://developers.openai.com/codex/app-server/) includes account/rateLimits/read and multiple returned buckets | A documented resource exists; current plan/workspace/auth eligibility and hosted behavior are not verified here |
| OpenAI Sign in with ChatGPT | [Official deployment overview](https://developers.openai.com/siwc/token-sharing-open-source) distinguishes local/open-source and self-hosted environments from paid/remotely hosted offerings | No registered hosted client or separately authorized account is configured. Hosted gate unverified, disabled |
| xAI | [Official API rate limits](https://docs.x.ai/developers/rate-limits) | API project limits do not establish the consumer Grok app balance |
| Google | [Official Gemini API limits](https://ai.google.dev/gemini-api/docs/rate-limits) | API project limits do not establish Gemini app subscription quotas |
| Perplexity | [Official API usage tiers](https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers) | Sonar/API tiers do not establish consumer Pro/Research remaining use |

Documentation confirms interfaces/deployment distinctions, not our entitlement or
a live account result. No inference/reset-credit request was sent to probe quotas.
The existing local companion does not prove eligibility for a multi-user service.

## Environment / missing prerequisites

The managed environment reports enforced unrestricted HTTP policy, but **no
configured secrets, runtime identity bindings or outbound identities**. GitHub
connector access is available for scoped repository publication. Node 24.19.0 /
npm 11.9.0 are installed. CLI network/Docker need approved process access here;
that resolved proxy/socket access without changing network policy.

There is no provider-owned test account, MyLimits hosted OAuth registration,
verified callback, production OIDC tenant, production KMS binding or public service.
No registration, purchase or public deployment is performed in this phase.

## Live cases still unverified

For each proposed collector, record provider/plan/workspace, permitted deployment,
scopes/quota resource, and actual results for: tab closure, browser restart,
other-device usage, website logout, collector revocation, global logout, token
expiry/renewal, account switching and provider throttling. None was executable
without a separately authorized account; all remain pending, not fixture-passed.

Self-hosted user deployment is distinct from a paid multi-user hosted service.
A remote browser was not launched: no supported authorization flow or dependable
consumer quota source has been established. No browser cookie transfer, automatic
password replay, verification bypass or credential upload is implemented.

## Implementation consequence

P2-02 provides an optional authenticated snapshot API. P2-03 implements durable
jobs/credential contracts with synthetic fixtures and **no enabled production
collectors or cloud-provider login buttons**. P2-04 syncs normalized readings
only after opt-in, preserving original observation time and explicit device/source
mapping. Sync cannot create new provider readings while all collectors are offline
or after their browser sessions become invalid.

Production collector enablement requires a new dated, evidence-backed capability
entry and an implemented allowed provider adapter. A configuration boolean alone
must never turn a fixture collector into a production integration.
