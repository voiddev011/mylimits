# MyLimits — hosted foundation preview (3.3)

Your AI account readings in one browser dashboard. Website tracking is available;
**installer-free independent OpenAI/Claude connections remain blocked** pending
supported hosted authorization and actual account acceptance.

[Install/test](INSTALL.md) · [Status](IMPLEMENTATION-STATUS.md) ·
[Plan](INDEPENDENT-ACCOUNTS-FINAL-PLAN.md) · [Current handoff](INDEPENDENT-ACCOUNTS-FINAL-HANDOFF.md)

## Current behavior

- + beside each service offers Use current account or Connect another account.
- Current-account tracking uses the website login already in this browser.
- Independent choices check the hosted service's capabilities. Unsupported
  providers show Not available yet and do not open an ordinary website tab.
- Compact popup: real provider logos, aliases, scoped quota bars, reset times,
  freshness, refresh and Full dashboard. No Guide. No provider on/off switches.
- Dashboard retains account management, notifications, history, accessibility,
  permission revocation and optional snapshot sync.
- Local helper experiments remain optional in advanced Settings. End-user
  extension packages contain no helper/CLI/server runtimes.

## Implemented foundation, not provider proof

The backend and extension support owner-scoped account attempts, verified identity,
duplicates, cancellation, reconnect, aliases, encrypted server credentials,
bounded jobs and dated readings. Fictional drivers exercised the real Chromium →
API → PostgreSQL transport. Production driver maps remain empty. No real account
was authenticated or quota fetched in this hosted integration.

OpenAI Codex/Work windows do not represent every ordinary ChatGPT limit. Claude
subscription usage is distinct from API credits. Cached readings remain dated;
website logout, provider-wide revocation and credential renewal are separate
pending live checks. Snapshot sync does not maintain provider login sessions.

## Develop

Node24+, existing lockfiles, one workstream. Start with [START-HERE.md](START-HERE.md).
Use `npm ci --include=optional`, `npm run build`, `npm test`, `npm run typecheck`
and the focused suites described in the handoff. Backend tests need an isolated
PostgreSQL database; browser tests need extension-capable Playwright Chromium.
[Server operator setup](SERVER-SETUP.md) describes the private deployment package.

[Privacy](PRIVACY.md) · [Architecture](ARCHITECTURE.md) ·
[Provider scope](PROVIDER-CAPABILITIES.md) · [Research evidence](HOSTED-ACCOUNTS-TRIAL-PLAN.md)
