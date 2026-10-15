# Phase 1 — Reliable local redesign

Budget: **100 relative effort points**, ten work packages. Implementation status:
[IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md). Read
[START-HERE.md](START-HERE.md) and the shared contracts in
[V2-IMPLEMENTATION-PLAN.md](V2-IMPLEMENTATION-PLAN.md) first.

## Outcome and boundary

Deliver a redesigned, locally usable Chrome/Brave extension with easy website
connections, compact named accounts, reliable scheduling, accurate status,
alerts, retained history and an installable build. Retain the optional existing
OpenAI companion. Preserve user data. Provider verification must remain honest.

Do not implement cloud services, new independent OAuth grants, additional
provider quota adapters, model guidance, page widgets or a phone website here.
Those belong to Phase 2. Existing browser activity observations remain labeled
as local counts. Claude/Codex improvements concern their existing supported
response scopes, not invented ordinary ChatGPT quotas.

## Execution order and effort

| ID | Work package | Points | Depends on |
| --- | --- | ---: | --- |
| P1-01 | Baseline and capability audit | 8 | None |
| P1-02 | V2 domain and public contracts | 12 | P1-01 |
| P1-03 | Resumable migration and repositories | 10 | P1-02 |
| P1-04 | Existing adapters and source reconciliation | 10 | P1-02, P1-03 |
| P1-05 | Account and connection workflows | 10 | P1-04 |
| P1-06 | Refresh scheduling and failure recovery | 10 | P1-04, P1-05 |
| P1-07 | Compact shared interface | 12 | P1-05, P1-06 |
| P1-08 | Notifications and timing policies | 8 | P1-06, P1-07 |
| P1-09 | History, export and data controls | 8 | P1-03, P1-07 |
| P1-10 | Integration, packaging and handoff | 12 | P1-01 through P1-09 |
| **Total** | | **100** | |

Follow this order in one workstream. Each work package should leave the app
buildable; use a temporary internal compatibility adapter if needed, and remove
it after integration. Do not maintain two independently writable stores.

## P1-01 — Baseline and capability audit (8 points)

**Read:** `package.json`, `scripts/run-tests.mjs`, `wxt.config.ts`,
`playwright.config.ts`, `src/providers/*`, `src/platform/controller.ts`,
`src/platform/companion.ts`, and the current architecture/support/companion docs.

**Actions:**

1. Inspect Git status, branch, remote and recent history. Work on `v2/phase-1`
   (or a non-conflicting name). Preserve pre-existing edits; do not reset/clean
   the workspace or assume local dirty files have not already been published.
2. Record Node/npm versions and existing scripts. Use Node 24+; run `npm ci`
   only if dependencies need installation. Do not delete the lockfile or change
   dependency versions to hide environment failures.
3. Run the baseline type check, unit/companion checks and build; run browser
   fixtures if Chromium is available. Record actual outcomes and error causes.
4. Create `docs/PROVIDER-CAPABILITIES.md` with provider, connection kind, quota
   scope, tab need, account-wide scope, logout behavior, renewal, multi-account
   support, hosted support, evidence level and checked date.
5. Use current code/docs for known facts; consult current first-party provider
   documentation for authorization claims. Record unavailable live checks as
   unverified. No passwords, token extraction or remote credential upload.

**Acceptance:** a reproducible baseline is recorded, the five current providers
are classified correctly, the companion's unverified live behavior is explicit,
and the next task can proceed without inventing credentials or support. Missing
external access is a recorded constraint, not a reason to halt all local work.

**Checkpoint:** `docs/IMPLEMENTATION-STATUS.md`, capability matrix, baseline
results and any minimal environment-related fix. No feature rewrite yet.

## P1-02 — V2 domain and public contracts (12 points)

**Likely files:** `src/core/model.ts`, `src/core/schema.ts`,
`src/core/engine.ts`, `src/core/companion.ts`, `src/platform/messages.ts`;
introduce focused domain modules only where they simplify existing code.

**Implement:**

- Separate account, workspace, connection and snapshot records using master
  section 14. Define persisted V2 and explicit public-state schemas/types.
- Keep source evidence, quota scope, observed/received/attempt times and nullable
  values distinct. Preserve reset identity and source-specific windows.
- Introduce connection generations and typed adapter errors. Define status
  selectors for updating, remembered, sign-in required and unavailable.
- Define account-level preferences independently of connection credentials.
  Preserve website-versus-native distinctions and the existing opaque profile ID.
- Model future connection kinds without presenting unusable connection buttons.
  No backend or local token-vault implementation is required by these types.
- Decide how a website connection rebinds when the signed-in provider account
  changes. Rebinding must not deactivate independent native connections.

**Meaningful tests:** same nickname on different accounts; same account with
different workspaces; stale arrival after a newer snapshot; reported zero versus
unknown; invalid percentage/NaN; different scopes with identical reset times;
local activity not refreshing a reported meter's observation time; public-state
serialization excludes private fields.

**Acceptance:** source identity and freshness have one domain implementation;
UI, adapters and future server code can consume the same validated semantics.
Wire new tests into the current explicit test runner.

## P1-03 — Resumable migration and repositories (10 points)

**Likely files:** `src/platform/repository.ts`, `src/platform/history.ts`,
`src/core/schema.ts`; suggested new `src/core/migrations.ts` and focused tests.

**Implement:**

1. Read V1 through its actual schema. Keep `mylimits:state:v1`, original IDs,
   install salt, aliases, timestamps, thresholds, mute settings and companion IDs.
2. Build and validate V2 in memory. Persist a recoverable backup/journal, then
   V2 state. Select V2 only after durable validation. Migrate IndexedDB through
   a version upgrade and resumable journal, not a pretend cross-store transaction.
3. Map existing website bindings, inactive remembered accounts and native profile
   sources explicitly. Preserve unresolvable legacy identity as legacy, not as
   a fabricated verified principal. Keep existing history linked to its account.
4. Serialize updates and expose read models for UI/history. Handle version
   mismatch with a recoverable error; never reset saved data on parse failure.
5. Make recovery/rollback behavior explicit in `docs/ARCHITECTURE.md`, including
   whether later V2 writes can be read by V1. A backup is not automatic downgrade
   compatibility. Retain legacy readers only where needed for migration.

**Tests:** representative V1 with two Claude/three GPT aliases, a companion profile
and local counts; repeated migration; crash after each journal step; malformed
state; unknown future version; quota-exceeded storage write; history migration
interruption; no duplicates on resume; failed migration leaves V1 untouched.

**Acceptance:** there is one authoritative writable state; restart/retry does
not erase preferences or double history. Updating one source cannot overwrite
another source through a stale repository write.

## P1-04 — Existing adapters and source reconciliation (10 points)

**Likely files:** `src/providers/adapters.ts`, `catalog.ts`, `parsers.ts`,
`src/platform/companion.ts`, `src/core/companion.ts`, `src/core/engine.ts`.

**Implement:**

- Adapt Claude and ChatGPT/Work-Codex readers to V2 transport/parser contracts.
  Keep fixed origins, timeouts, runtime validation and transient website auth.
- Maintain background fetch first and existing permitted-tab fallback where
  needed. Do not create hidden login windows or broaden site access.
- Add explicit eligible workspace selection using verified workspace responses.
  Persist selection per account/connection; handle removed or inaccessible
  workspaces with a visible selection/reconnect state.
- Reconcile website account changes into the correct saved account; keep other
  accounts' nicknames, last readings and independent sources intact.
- Bring companion snapshots through the same validator without exposing its
  authentication. Keep existing native-runtime fallback and friendly errors.
- Carry existing Gemini/Grok/Perplexity observations as local activity records;
  no guessed cap, percent remaining or cross-device claim.

**Tests:** realistic sanitized legacy/normalized fixtures; missing workspace;
renamed plan/model labels; missing usage buckets; empty valid response;
401 versus 403 versus 429; account A→B switching; out-of-order response after
rebind; companion source remains active after website logout; raw auth absent
from persistence/messages. Preserve parser coverage for variable window lengths.

**Acceptance:** all currently implemented sources use V2 without inflating their
support claims. Document any unverified real-account behavior separately.

## P1-05 — Account and connection workflows (10 points)

**Likely files:** `src/platform/controller.ts`, `messages.ts`,
`src/ui/App.tsx`, `src/ui/OpenAICompanion.tsx`, and extracted account components.

**Implement:**

- Add-account/provider selection → user-triggered exact host permission → reuse
  existing login → display detected account or one clear recovery action.
- Make website tracking the normal path. Keep the native companion in an
  advanced optional section; unavailable native APIs must not block the app.
- Rename, pin, order and mute accounts; display active/remembered status and
  workspace choice; persist preferences on immediate reload.
- Refresh/reconnect a connection separately from forgetting saved account data.
  Explain whether a disconnect pauses local collection or requests remote logout.
- For companion logout failure, retain a retryable connection and do not claim
  remote revocation succeeded. For forgetting a current website account, prevent
  immediate rediscovery by disabling/unbinding its collector as appropriate.
- Remove shared provider host permission only when no remaining enabled local
  website collector needs it. A website toggle must not revoke another source.
- Validate all new commands and sender context; no arbitrary URL fetch commands.

**Tests:** permission granted/denied/revoked; cancel; no existing login;
duplicate display names; independent rename; disconnect during refresh;
forget/reload; missing native API; failed companion logout; permission sharing.

**Acceptance:** a normal user can track a supported website without companion
installation, while remembered accounts remain useful and accurately labeled.

## P1-06 — Refresh scheduling and failure recovery (10 points)

**Likely files:** `src/platform/controller.ts`, background entrypoint,
connection scheduling/repository modules; adapt existing alarms rather than
introducing a permanently running service-worker loop.

**Implement:** persisted next-attempt/backoff state, per-connection in-flight
coalescing, bounded provider concurrency, generation checks, abort/timeouts and
five-minute default where permitted. Startup reschedules alarms; opening the
popup requests a refresh only if needed. Manual refresh obeys a short cooldown.

Distinguish offline, auth failure, missing tab, provider denial, rate limiting
and invalid response. Honor valid retry times, cap backoff and clear failures on
success. Pause auth-rejected collection until an explicit/relevant recovery event
rather than repeatedly opening a login. Keep old readings dated and mark expired
windows as awaiting confirmation. Do not convert failed attempts into new readings.

**Tests with fake clock/transport:** worker restart; popup/manual/alarm overlap;
disable or forget during response; A/B connections to the same provider;
abort; Retry-After parsing; offline recovery; no immediate retry storm;
reset timestamp passed; newer credential generation rejects old results.

**Acceptance:** useful background tracking with the provider tab closed wherever
the adapter supports it, and one truthful status per connection. Timeliness is
defined as the next successful scheduled refresh, not guaranteed real time.

## P1-07 — Compact shared interface (12 points)

**Likely files:** `src/ui/App.tsx`, `styles.css`, `overview.ts`, `format.ts`,
`demo.ts`, popup-specific CSS/HTML, side-panel/dashboard entrypoints; extract
shared overview/account/status components to avoid three divergent interfaces.

**Implement:**

- Compact account rows with nickname, source/status, two pinned relevant meters,
  reset information and a detail expander. Used/Remaining is one consistent setting.
- Defaults target six representative short-name rows without account-list scroll
  at normal 100% desktop scale in a popup no larger than Chrome's supported bounds.
  Start near 520px width and at most 600px height. Long names/high zoom may need
  accessible scrolling; never shrink the popup into an unusable narrow strip.
- Show fresh accounts first by user choice, search/filter/sort and persistent pins.
  Unavailable data uses text, not an empty bar that looks like zero remaining.
- Dashboard provides Overview, Accounts, History and Settings. Add no empty Guide
  tab for Phase 2. Side panel uses the same selectors/components responsively.
- Header has refresh and age; footer opens account setup/full dashboard. Keep
  explanatory onboarding compact and show it only when needed.
- Light/dark/system themes, useful focus order, labeled controls, escape handling,
  screen-reader status announcements and warnings understandable without color.
- Preview uses fictional isolated state. Theme/preferences changes in preview
  must not accidentally save fake connected accounts or ask for host permissions.

**Browser checks:** six-account fixture; all unknown/stale; long aliases;
no accounts; one account with many windows; expanded row; keyboard-only navigation;
popup/side-panel/dashboard consistency; 100% and representative zoom/layout stress.
Automated layout emulation must not be described as an actual Windows DPI test.

**Acceptance:** limits are visible before setup prose. Existing popup width and
missing-native-runtime regression coverage remains meaningful and passes.

## P1-08 — Notifications and timing policies (8 points)

**Likely files:** `src/core/engine.ts`, notification preferences/schema,
controller delivery code and account/settings UI. Reuse the deduplication core.

**Implement:** per-account warning/critical thresholds, mute, snooze, local quiet
hours (including overnight range), permission on user action and optional
confirmed-reset alerts. Explain the limiting meter/window in each message.
Persist a bounded event ledger keyed by account/workspace/scope/meter/window.
Notification permission denial is a preference state, not an app-wide failure.

Snooze and quiet hours suppress delivery rather than mark alerts sent. On resume,
send at most one relevant warning from a fresh current reading. A predicted reset
is never a confirmed-reset alert. Badge selection considers fresh reported
applicable meters and respects the defined meaning of Used/Remaining.

**Tests:** warning then critical; several crossed thresholds at once; multiple
windows; window rollover; unknown reset with recovery; muted/stale/local sources;
permission revoked; overnight/timezone boundary; snooze ends on stale reading;
two sources mapped to the same verified meter; no duplicate confirmed reset.

**Acceptance:** useful low-limit alerts without spam or false reset claims;
browser permission and muted/snoozed behavior match visible settings.

## P1-09 — History, export and data controls (8 points)

**Likely files:** `src/platform/history.ts`, validated history commands,
dashboard History view, account deletion flow and `docs/PRIVACY.md`.

**Implement:** bounded paginated history retaining observation/arrival times,
source, evidence, scope and reset/window identifiers. Preserve the 30-day default.
Add a readable account history table/basic trend, date range and explicit gaps.
Phase 2 adds richer charts and forecasting. History failure must not discard a
valid current quota reading or prevent normal account display.

Offer safe account/history export and delete/clear controls with deliberate
destructive-action UI. Exports have a versioned schema and exclude authentication,
private salts/ledgers, raw responses and unrequested identifying details. If
CSV is offered, neutralize spreadsheet formula prefixes in user-entered aliases.
Do not implement credential import or general account merging through exports.

**Tests:** older-than-retention pruning; pagination boundaries; duplicate
snapshot; missing/reset window; old uploaded timestamp; account-only deletion;
history migration compatibility; database failure; export redaction and alias
escaping; clear history leaves connection settings intact.

**Acceptance:** existing readings survive upgrade and can be inspected/exported
without implying that gaps or local activity are exact remote usage.

## P1-10 — Integration, packaging and handoff (12 points)

**Likely files:** existing test runner/browser tests/CI, `package.json` only for
required script changes, documentation and build artifact configuration.

**Implement and verify:**

1. Integrate all surfaces and connection types in one production build. Remove
   temporary dual-model paths/stubs. Confirm no backend URL/service is required.
2. Run `npm run check`, production browser tests and `npm run zip`. The check
   script already includes core tests, companion tests, type checking and build;
   do not rerun all those individually without a failure/new change to justify it.
3. Preserve CI's Chrome ZIP artifact and Windows logic job. Add focused new test
   imports. Validate generated manifest permissions and packaged entrypoints.
4. Give users a short ZIP/unpacked install and update path with the exact
   `.output/chrome-mv3` developer path and artifact instructions. End users using
   the packaged build do not need Node/npm. Do not claim Store publication.
5. Record live/OS checks separately: actual Windows Chrome/Brave popup, connection
   to a real allowed plan, tab closure/restart, phone usage, website logout and
   native bridge if available. Missing access stays explicitly pending.
6. Update `docs/README.md`, `ARCHITECTURE.md`, `SUPPORT.md`, `PRIVACY.md`,
   `PROVIDER-CAPABILITIES.md` and the status ledger to describe implemented code.
7. Create `docs/PHASE-1-HANDOFF.md` with branch/commit, schemas, migration recovery,
   files changed, commands/results, artifacts, supported capabilities, pending
   live checks and the next Phase 2 task. Commit/push only relevant work.

**Phase 1 gate:** locally usable redesigned extension; automated meaningful
checks pass or have explicit concrete environment blockers; no secrets/fake
connected data; no lost nicknames/history; no compulsory companion; all release
claims match evidence. An externally blocked live check does not stop unrelated
implementation, but the associated capability cannot be marked live-verified.

Stop at this handoff. Do not begin Phase 2 without the user's next instruction.
