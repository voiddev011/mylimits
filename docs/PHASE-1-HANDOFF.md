# MyLimits 2.0 — Phase 1 handoff

Date: **15 October 2026**. Build: **2.0.0**, display label **2.0 Phase 1 preview**.
P1-01 through P1-10 are implemented in order in one workstream. No parallel
agents were used. **Phase 2 has not started.** Live acceptance remains separate.

## Branch and checkpoints

- Working/published branch: [`v2/phase-1`](https://github.com/voiddev011/mylimits/tree/v2/phase-1).
- Published package-delivery checkpoint:
  [`571b251`](https://github.com/voiddev011/mylimits/commit/571b25143926da32592279b859eaf597887fe5ae).
  Subsequent handoff commits update documentation only; use the branch head for
  the complete handoff. Local runtime checkpoint: `79a9c41`; local artifact-delivery fix: `3df91af`.
- Remote branch is based on original `main` commit
  `380125a8cdc411c7c49d6aac8e61e159315950e5`. Main was not merged/rewritten.
- Initial workspace content was compared against all 73 published baseline
  blobs before preserving it as local commit `f1dd843`. No user edits were reset.
- Shell Git network access was blocked by an unavailable proxy. Checkpoints
  were safely published through GitHub Git Data APIs using guarded branch
  updates with no force. Remote/local checkpoint SHAs differ because their
  pre-existing histories differ; their published file content is the review target.
  Use a fresh clone of `v2/phase-1` for normal Git pull workflows; do not force
  either history over the other.

## Install and update

**Packaged users do not need Node/npm or a companion.**

1. Download the [verified **mylimits-chrome** artifact](https://github.com/voiddev011/mylimits/actions/runs/38740486309/artifacts/11975222283) from the successful
   [package-delivery Checks run](https://github.com/voiddev011/mylimits/actions/runs/38740486309)
   or a newer successful [branch run](https://github.com/voiddev011/mylimits/actions?query=branch%3Av2%2Fphase-1).
   Private-repository artifact access needs your GitHub login.
2. Extract the artifact download, then the contained extension ZIP. Select the
   extracted folder that directly contains `manifest.json`.
3. Chrome: `chrome://extensions`; Brave: `brave://extensions`. Enable Developer
   mode → **Load unpacked** → select that folder. Keep it in a permanent location.
4. Pin MyLimits → **Accounts** → enable a website → approve site access.
   Reuse your current website login; open that site yourself if page context is
   required. The advanced companion section can stay closed.
5. Check **Preview with sample data** to try the interface without connecting.

For an existing unpacked installation, preserve its folder/path and extension
ID, back up the browser profile, replace the files inside that same folder, and
click **Reload**. Do not uninstall first. A new folder/extension ID can start a
separate empty profile. Migration runs automatically within the existing ID.
This is a desktop Chromium preview, not a Store or Firefox/mobile release.

Developer commands from the repository root, with Node 24+:

```sh
npm ci                     # only if dependencies are not installed
npm run dev                # frequent edits: WXT watches source
npm run check              # types + core + companion + production build
npm run test:browser        # built extension + compatible Chromium
npm run zip
```

Production load-unpacked path: **`.output/chrome-mv3`**.
Workspace absolute path: `/workspace/mylimits/.output/chrome-mv3`.
Windows path relative to your project: `.output\chrome-mv3`.
After a production rebuild, reload the existing extension. Packaged users just
replace extracted files and reload; no npm command is needed.

## Packaged artifact

- Local ZIP: `/workspace/mylimits/.output/mylimits-2.0.0-chrome.zip`.
- Archive size: **175,641 bytes**; **20 archive entries** including directories.
- SHA-256 of this local ZIP:
  `af171f5062c27578296863c79f3cafc618fa33a14c83fa0d6814d6907bc1de94`.
- Uncompressed build: approximately **556.43 kB**.
- `manifest_version: 3`, `version: 2.0.0`, minimum Chrome 116.
- Required permissions: `storage`, `alarms`, `scripting`, `sidePanel`.
- Optional: `notifications`, `nativeMessaging`; five exact optional AI origins.
  No broad `<all_urls>` grant, cloud host or mandatory native permission.
- ZIP CRC, path safety and packaged popup/dashboard/side-panel/background/observer
  entrypoints were inspected. No source maps, project source, companion credential
  files, dependencies or environment files are packaged.
- Corrected upload artifact: **11975222283**, run **38740486309**, present and not expired at handoff.
- Build outputs are ignored by Git. CI uploads the ZIP as **mylimits-chrome**;
  generated ZIP timestamps may differ from the local archive/hash.

## Actual verification

Environment: Linux workspace, Node **24.19.0**, npm **11.9.0**.
No real signed-in provider account was available.

| Command / check | Actual result |
| --- | --- |
| Baseline types / core / companion / production build | Passed; 35 original core tests and 16 companion tests |
| Baseline Chromium fixtures | 10/10 passed after granting local process sandbox access |
| Final `npm run check` | Passed: TypeScript, **62/62 core tests**, **16/16 companion tests**, production WXT build |
| `CHROMIUM_PATH=/tmp/mylimits-browsers/chromium-1248/chrome-linux64/chrome npm run test:browser` | **15/15 passed** against production extension |
| Final `npm run zip` | Passed; explicit package-version archive name and manifest version verified |
| Follow-up typecheck for WXT packaging configuration | Passed |
| Archive permission/entrypoint/path/CRC inspection | Passed |
| Smoke test loading the extracted ZIP | Passed: version 2.0.0, popup/side panel/dashboard empty-install views render |
| `git diff --check` and Markdown location/link inspection | Passed at handoff |
| GitHub Checks run 38739932337 on runtime checkpoint b54109e | Passed logic/browser/build; artifact absence caught and corrected below |
| Corrected delivery run 38740486309 on checkpoint 571b251 | Passed: Linux verify/browser/package/upload and Windows logic; artifact 11975222283 verified present |
| Real provider / actual Windows desktop acceptance | Pending; see below |

Browser regressions include empty install, isolated preview, two Claude/three
ChatGPT independent aliases, persistent settings, denied permissions, compact
six-row popup, native API fallback, independent native readings and remembered
disconnect, pin persistence, real IndexedDB pagination/export/clear, V1 state and
history migration through a persistent Chromium restart, explicit recovery-copy
forgetting, fixture provider history retention, offline age preservation and
keyboard/dark/long-name shared layouts at 360/520/1120 CSS widths. A CSS zoom
stress is included; it is not actual Windows DPI acceptance.

Pure tests exercise identity/scope isolation, reported zero versus unknown,
validated snapshots, future/old/generation rejection, per-meter observation age,
resumable migration with write/history faults, private-field projection,
workspace validation, cancellation/concurrency, persisted backoff/Retry-After,
quiet hours/snooze/deduplication/reset confirmation and safe exports. Existing
companion service tests retain real child-process RPC and Windows path/launcher
logic checks with fictional authentication.

Sandbox notes: unprivileged child processes initially failed with EPERM and
Chromium SIGTRAP. Approved process execution resolved both; all local suites
above passed. This is not a provider/network acceptance result.

CI evidence for the published implementation and artifact checkpoints is recorded in
[implementation status](IMPLEMENTATION-STATUS.md). Windows logic CI does not
certify native host installation or Windows browser display behavior.

## How the implementation works

1. A user click grants one exact website origin. The default path uses that
   browser's existing session; companion installation is never mandatory.
2. Fixed-origin readers verify identity and selected workspace before producing
   normalized readings. Website bearer data is transient and never public state.
3. The scheduler coalesces each source, bounds website concurrency at two,
   persists backoff and fences results with source generations. No hidden login
   tab or model inference request is used to discover quotas.
4. Validated source snapshots feed one reconciler. Aliases and preferences belong
   to the saved account; a website account switch remembers the previous account
   without deactivating independent native sources.
5. Shared selectors display each meter's scope, status and original reading age.
   Unknown quota stays unknown. Failed refreshes keep dated readings rather than
   manufacturing new percentages.
6. Serialized storage and IDB history save accepted observations. History failures
   warn without losing the current reading. Pagination preserves gaps; export
   allowlists fields and neutralizes spreadsheet formulas.
7. Alert policy uses only fresh reported meters with account/workspace/scope/window
   deduplication. Quiet hours/mute/snooze suppress delivery, not collection.
   Countdown expiry alone cannot confirm a reset.

## Changed files and task checkpoints

All paths are relative to the repository root. Exact diffs live in Git; checkpoint
entries in [the status ledger](IMPLEMENTATION-STATUS.md) record decisions/results.

| Task / local checkpoint | Main files and resulting behavior |
| --- | --- |
| P1-01 `6accc5e`, `82987fb` | `docs/PROVIDER-CAPABILITIES.md`, status; baseline/capability audit, process/network constraints |
| P1-02 `326135f` | `src/core/model.ts`, `schema.ts`, `public.ts`, `connections.ts` and tests; validated V2 source model and private/public boundary |
| P1-03 `897255c` | `src/core/migrations.ts`, `v1-schema.ts`, migration tests, `src/platform/repository.ts`, `history.ts`; resumable preserved-data upgrade |
| P1-04 `d6e303f` | `src/providers/reader.ts`, `errors.ts`, `adapters.ts`, reader tests, `src/core/engine.ts`, `companion.ts`; workspace/source reconciliation |
| P1-05 `56873d4` | `src/core/actions.ts` and tests, platform commands/controller; source-aware preferences, disconnect and forget |
| P1-06 `f1a90b2` | `src/core/scheduler.ts` and tests, controller; coalescing, backoff, generation/cancellation and recovery |
| P1-07 `f0fa184` | `src/ui/App.tsx`, `styles.css`, `overview.ts`, `demo.ts`, `OpenAICompanion.tsx`; compact shared UI and optional advanced native setup |
| P1-08 `eabef09` | `src/core/alert-policy.ts` and tests, engine/controller/settings UI; quiet hours, snooze and confirmed resets |
| P1-09 `18fd4d2` | `src/core/history-data.ts` and tests, `src/platform/history.ts`, repository/controller, `src/ui/HistoryView.tsx`, privacy; safe history/export/deletion |
| P1-10 `89ebf0a`, `79a9c41`, `3df91af`, final documentation commit | `tests/browser/extension.spec.ts`, explicit unit runner, scheduler/transport hardening, `package.json`, lockfile, `wxt.config.ts`, `.github/workflows/checks.yml`, current docs and this handoff; integrated gate and package |

Removed the temporary `src/ui/history-view.ts` implementation after the real
history view landed. `scripts/run-tests.mjs` explicitly imports the new tests.
CI keeps the Chrome ZIP artifact and Windows logic job. Final artifact inspection
found that upload-artifact skipped the hidden `.output` folder despite a green
job. The workflow now explicitly includes hidden files only on its narrowly
scoped ZIP/results paths, and a missing ZIP fails the job. The corrected upload
was verified separately; a successful packaging command alone was insufficient.

## Schema, migration and recovery

- State schema: V2, `mylimits:state:v2`; active pointer `mylimits:active-schema = 2`.
- Preserved V1/recovery: `mylimits:state:v1`, `mylimits:backup:v1`.
- Journal: `mylimits:migration:v2`; pointer commits only after validated state
  and IndexedDB upgrade. Storage and IDB are not a pretend shared transaction.
- IDB: `mylimits-history`, version 2, existing `readings` store retained; added
  snapshot uniqueness and account/time pagination. Legacy samples remain labeled.
- Account meters/status are a materialized compatibility read projection. Source
  snapshots, updated by one reconciler inside one aggregate, are authoritative.
- Raw workspace routing IDs remain worker-private. Auth is absent from public
  snapshots, exports, history and runtime state messages.

On interruption, close MyLimits pages and reload the same extension; journal
steps resume idempotently. Do not clear saved keys on parse/future-version errors.
Back up the browser profile before manual recovery. Explicit forgetting also
prunes matching entries from the legacy recovery copy and prevents late native
or history writes from recreating that account.

A V1 build cannot read subsequent V2-only changes. A preserved V1 snapshot is a
recovery point, not automatic downgrade compatibility. See
[architecture/recovery details](ARCHITECTURE.md); keep a profile backup and export
readings before intentional downgrade.

## Capability limits and pending checks

- Claude: returned subscription/workspace buckets only. Workspaces come from
  validated membership, with explicit choice and no silent missing-choice fallback.
- ChatGPT website: returned Work/Codex/code-review buckets only. Ordinary chat,
  images, uploads and tool balances remain unknown.
- OpenAI companion: optional separate local authorization and isolated native
  profiles. Real sign-in, renewal, website logout and cross-device quota access
  still need live evidence. Failure is not silently treated as remote revocation.
- Gemini/Grok/Perplexity: local recognized successful request counts only. No
  invented remaining caps, token counts or remote identity.

Pending for relevant real plans/sources: tab closure, browser restart, usage from
another device, ordinary website logout, collector revocation, global logout and
credential expiry/renewal. Actual Windows Chrome/Brave DPI, native host launch and
desktop notification UI are pending. Website sources are session-bound; no
universal real-time or logout-independent tracking promise is made.

No backend, credential upload, new provider quota adapter, guidance page, widget,
forecasting engine or mobile website was added. See
[capability declarations](PROVIDER-CAPABILITIES.md) and [manual matrix](SUPPORT.md).

## Next action

User acceptance of this Phase 1 package, then await the user's instruction.
If Phase 2 is authorized, start with **P2-01 — Hosted authorization and quota
feasibility**, using this handoff and capability matrix. Do not start it or deploy
a service as part of this handoff.
