# Independent account integration

Authorized 21 October 2026. Branch: `feature/independent-accounts`.

The latest user instruction authorizes service/UI integration before live account
proof, with explicit pending verification and unavailable Claude when its route
cannot be established. It supersedes the older instruction to stop before Gates
2–5. It does not authorize claiming live verification, merging main or publication.

## Inspected baseline

- `companion/service.mjs`: legacy isolated OpenAI homes, unscoped login events,
  in-memory readings and limited retries; `daemon.mjs` owns authenticated socket.
- `companion/proof`: scoped login waiter, sanitized profile environments,
  before/after identity fencing, real subprocess/terminal fixtures. Separate
  diagnostic storage must not be silently imported into production.
- `src/platform/companion.ts`, controller/messages and `core/companion.ts`:
  native snapshot merge retains `openai-companion:<uuid>` and `companion:<uuid>`.
- `AccountConnect.tsx`: website switching presented as add-account flow;
  OpenAI helper nested, Claude independent connector absent.
- Windows NSIS + PowerShell GUI bundles official Node/Codex and discovers installed
  extension metadata. No Claude redistribution or automatic isolated login exists.

## Ordered tasks and acceptance

1. Record baseline/plan/status. Preserve clean baseline and use feature branch.
2. Define strict native v2 capabilities/operations/snapshots; preserve legacy IDs,
   aliases/history and website readers. Unknown values remain unknown.
3. Integrate isolated official OpenAI managed sign-in, scoped completion/cancel,
   immutable UUID, persisted identity binding and generation checks. Duplicate
   identity is a warning, never automatic merging or false success.
4. Keep Claude unavailable with precise capability blocker unless official isolated
   signup, fresh upstream monitoring and applicable conditions are established.
5. Native service: per-account serialization, bounded total work, persisted cooldown,
   retry hints/backoff, sanitized errors and retained dated readings.
6. Extension: + offers website detection vs independent connection. Sign-in progress,
   verified identity, alias, cancellation/reconnect; compact quotas and dashboard
   management. Missing/old helper must produce actionable upgrade/setup state.
7. Guided Windows installer: include service modules; validate runtime; automatic
   discovery and clear manual unpacked-ID fallback. No token handling/terminal at
   normal runtime. Preserve per-user install/uninstall semantics.
8. Meaningful contract/service/migration/browser tests and existing regression gates.
   Live matrix stays separate and pending when accounts unavailable.
9. Package extension, installer where possible, instructions/handoff and branch push.

## Shared contract

Native protocol 2 retains host `com.mylimits.openai` and existing ID namespaces.
Profiles carry provider, alias, auth state, capability/scope, generation-protected
readings, last attempt/success, nullable provider observation time, next retry and
safe error code. Authentication is independent from quota availability/freshness.
Credentials remain CLI-owned. No auth URL, token, raw CLI response or identity hash
crosses the native bridge. A verified display identity may be shown locally by
explicit sign-in/status UI; privacy mode conceals it. Email is limited identity
metadata, never a globally stable account/workspace key.

## Live release gate — all pending

For two accounts per provider: A/B identity and primary-browser preservation;
provider-matching scopes/values; usage elsewhere reflected on later successful
checks; no provider tabs required; restart; ordinary website logout vs global
revocation; actual expiry/renewal. CLI/OS fixtures do not satisfy these checks.
Claude automatic isolated login and permitted monitoring remain blocked.
