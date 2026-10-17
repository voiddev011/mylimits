# Independent-account proof handoff

17 October 2026 · `v3/account-proof` · **proof tooling implemented; live gate pending**.

## Delivered

- Versioned private diagnostic profiles with UUIDs, nicknames and generations.
  Separate Codex homes, Claude config directories and empty probe workspaces.
  Single-process ownership lock and serialized atomic metadata/history writes.
- Auth selector environment isolation, preserving OS/proxy/CA configuration.
  Provider credentials stay owned by the first-party CLI. The existing App Server
  transport accepts an explicit environment; normal extension behavior is preserved.
- OpenAI managed CLI sign-in with a new browser directory per attempt, scoped
  completion/cancellation, account checks before/after quota reads and real window
  lengths. Sign-in and checks cannot race on the same authorization.
- Experimental Claude official `auth status` plus an actual PTY `/usage` reader.
  Refuses injected/API authentication, unconfirmed config-directory routing,
  onboarding/trust prompts and unknown quota panels. No model prompts, tools,
  user hooks, MCP servers, custom OAuth, cookie imports or credential-file reads.
- Salted identity bindings reject account changes and late generation results.
  Same identity gets a duplicate group, never an automatic merge. Missing quota
  and errors preserve previous values and timestamps. Missing resets stay unknown.
- Manual checks, persisted cooldowns, bounded history, explicit CLI logout,
  cancellation and redacted report export. No provider polling starts automatically.
- Pinned optional prototype dependencies: MIT `node-pty` 1.1.0 and
  `@xterm/headless` 6.0.0. They are not imported into extension entrypoints or bundled
  into the existing production helper installer. Final packaging remains Gate 5.

## Actual local verification

- `npm run test:account-proof`: **26/26 pass** on Linux, Node 24.19.0.
  Includes real fictional CLI child processes, real PTYs, two-account isolation,
  changed fixture values, identity/generation fencing, onboarding refusal,
  unknown-panel timeout, aborted login, quota retention, logout acknowledgment,
  evidence persistence and privacy assertions. This is not live provider evidence.
- `npm run check`: **pass** (TypeScript, existing core tests, 20 native-helper tests,
  Chrome production build). No extension UI or provider website reader was changed.
- `node scripts/account-proof.mjs --help`: **pass**; `git diff --check`: **pass**.
- CI now runs the diagnostic tests on Linux and native Windows/ConPTY. Results
  will be recorded below after publication; do not assume a pending run passed.
- Offline lockfile normalization first failed on an uncached pre-existing WASM
  package. Normalization with registry access succeeded. Existing dependency
  versions were retained; npm added bundled optional-package metadata.

The current scope did not change dashboard styling or bundle browser UI features,
so the earlier V3 browser suite was not repeated locally. CI retains those checks.
No real user accounts, provider authorizations or secrets were available here.

## Explicitly not complete

1. **Live two-account proof for either provider**: sign in on the laptop, compare
   actual scopes and identity, test phone-only usage, normal logout, global
   revocation and actual renewal. A fixture cannot establish these behaviors.
2. **Automatic isolated Claude browser sign-in**: the diagnostic's optional
   manually confirmed first-party login may open the default browser. It does not
   solve the user's no-primary-session-switching setup criterion. That product
   capability remains blocked; no unverified browser-environment workaround shipped.
3. **Claude idle upstream freshness and permitted product use**: a rendered panel
   is a candidate input, not proof of fresh provider fetches. Monitoring and future
   distribution conditions require confirmation as recorded in Gate 0. No provider
   clarification request was sent, and no Claude binary is redistributed here.
4. **Gates 2–5**: provider-neutral native protocol/migration, scheduler with actual
   provider retry hints, four-account extension integration, clean Windows one-step
   installer and public-beta/renewal soak. These depend on the live proof gates.

No native production profiles or saved extension accounts were migrated. Existing
`openai-companion:<uuid>` IDs and the `com.mylimits.openai` host remain unchanged.
Main was not merged, no backend was deployed and no store submission was made.

## Next action

Follow [ACCOUNT-PROOF.md](ACCOUNT-PROOF.md) on the laptop. Start with two OpenAI
profiles, then run the explicitly experimental Claude tests if desired. Review the
redacted reports; share only those sanitized results, never authorization folders
or credentials. Resolve failing/pending capability gates before extending the
production connection UI. Preserve this branch's existing changes when continuing.

The [implementation plan](INDEPENDENT-ACCOUNTS-RESEARCH-AND-PLAN.md) remains the
source of truth for the later gates. This checkpoint must not be described as
completed independent GPT-and-Claude multi-account support.
