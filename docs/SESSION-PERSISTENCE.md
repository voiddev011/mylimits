# Session persistence — implemented code and pending proof

Updated 23 October 2026. C9–C12 implement saved-sign-in components behind off
provider policies. **No production saved-session provider is enabled.** Installing
this checkpoint does not establish a second browser-only account connection.
Website tracking and the optional Desktop route remain separate.

## Connection types

| Source | What authorizes reads | After website logout | Current boundary |
| --- | --- | --- | --- |
| Browser login (`website`) | Current normal browser session | May stop; no independence promised | Existing tracking; eligible failures have bounded background-tab recovery |
| Saved sign-in (`vault`) | Separately captured, locally encrypted session | UNVERIFIED for every provider | Code implemented; policies off, cookie allowlists empty |
| Desktop (`companion` / `independent-local`) | Official per-account provider profiles | Separate authorization by design; live result PENDING | Optional installed Desktop; OpenAI Codex scopes and experimental Claude Code `/usage` |
| Hosted (`cloud`) | Would require an implemented approved provider driver | Unavailable | Hosted provider registry is empty |
| Remembered/imported reading | No live authorization | Keeps its original timestamp | Cached history, never an independent fresh connection |

OpenAI's returned Work/Codex buckets do not represent every ChatGPT chat, image
or model limit. Unknown quotas, reset times and observation times remain unknown.
An alias is not identity. Failures, warnings and browser wake never make an old
reading fresh.

## Prepared saved-sign-in flow (gated)

For a future evidence-approved provider: + → Private sign-in → official website
login in an owned private window → verified identity → nickname and explicit
per-account consent → encrypted Save. The first account can use this route too.
Chromium private windows share a jar, so another private window blocks setup.
Normal browser login A is not switched to the candidate B. Selecting Save current
login is a weaker alternative; ordinary website logout will probably end it.

The setup attempt expires after ten minutes. Cookies and the unaccepted snapshot
stay in worker memory; recovery journals contain metadata only. Restart requires
verification again. Save closes only its own window; do not explicitly log out
inside that window. Duplicate/changed identity cannot silently replace a source.
Matching a website account preserves its ID, nickname and history while converting
only that matching source. All of this has simulated coverage, not live proof.

## C12 expiry warnings

- Capture records the earliest supplied allowlisted-cookie `expirationDate`,
  converted from seconds to milliseconds. Session-only cookies have `notAfter =
  null`. In a mixed set, the earliest known expiry is a conservative bound; it
  does not establish the lifetime of an unknown-expiry cookie or the session.
- The watchdog reads only source/account/expiry metadata. It never decrypts a
  cookie, renews a session, changes authentication state or sends provider traffic.
- Enabled, correctly bound sources of an approved provider qualify. Disabled,
  missing-account, rejected (`needs-auth`), expired and unknown-expiry sources do
  not. Production policies are all off, so no expiry alarm or notification is
  activated in current normal builds.
- It reuses Settings → Desktop alerts and the optional notifications permission.
  There is no additional permission or toggle. Quiet hours, account mute/snooze
  and Privacy mode apply. Account details show the supplied expiry in days;
  missing expiry produces no invented countdown.
- A daily alarm is retained without resetting its deadline on each refresh.
  Startup/open/regular refresh and relevant settings/removal events also check.
  Thus quiet hours defer delivery until an eligible later check. No work runs
  while the browser is closed, and alarms may be delayed by sleep/OS scheduling.
- Within 48 hours, send one warning; within 24 hours, send one urgent warning.
  If the browser wakes inside 24 hours, send only the urgent warning. Missed or
  already expired windows are not replayed. These are best-effort windows, not
  a promise to notify at exactly 48/24 hours before expiry.
- The existing bounded local notification ledger records source/expiry/threshold
  metadata, excluded from public messages, exports and sync. A changed supplied
  expiry rearms that source; unrelated connections remain deduplicated. Delivery
  failures restore the old entry for retry. A storage failure after OS delivery
  can still cause a later duplicate; exactly-once delivery is not claimed.
- Removing the last eligible source, disabling alerts, losing notification permission or
  disabling a provider clears the alarm. The watchdog never deletes credentials
  or modifies readings/history. Unknown session expiry relies on real HTTP/auth
  failures; the existing saved-source path parks after its authentication rules.

Re-sign-in currently uses account details → Remove saved sign-in, then + and the
verified sign-in flow again. Removal retains dated readings/history; returning
with the same verified identity preserves that account and nickname. Forget is
different: it removes that account's credentials, readings and history. These
instructions apply only after provider activation; do not manufacture connections
or use fixture cookie names in a normal installation.

## Evidence and remaining decisions

| Work | Evidence | Still required |
| --- | --- | --- |
| Scheduler, recovery and normal/private source isolation | Automated domain/Chromium fixtures | 3–4 day real reliability trial |
| Encryption, private setup, consent, conversion and removal | Actual local encryption/storage/UI with fictional provider/browser APIs | E3/E4/E8 and both real identities |
| Expiry watchdog | Boundary, quiet-hour, retry, privacy, persistence and alarm tests with a fictional clock | E5 lifetime at 24h/72h/7d and real OS delivery |
| Header normalization (C8) | Deferred; no rollout | E2 benefit plus G0 decision |
| Session rotation (T4.2) | Not implemented; no new webRequest grant | E6 and its decision-table outcome |
| Bearer-only optimization | Not inferred or enabled | E7 proof |
| Provider activation | G0 HOLD; G1 undecided | E1–E8, per-provider policy decision, release-permission review |

Record real results in [the evidence ledger](SESSION-PERSISTENCE-EVIDENCE.md).
Use [spike instructions](INSTALL.md#c6-evidence-spike-test-accounts-only); never
send cookie values, tokens or raw headers. [G0 report](G0-GATE-REPORT.md) is a
dated HOLD assessment, not an activation decision inferred from later coding.

T4.4 remains a human smoke test on Chrome, Brave and Edge/InPrivate. Ordinary
logout, private-window logout, global revocation, other-device usage, browser
restart and Desktop acceptance must be recorded separately by provider. Neither
fixture tests nor a completed C12 coding checklist can mark them PASS. Optional
C13 (Firefox containers/Desktop reconciliation) is not part of this checkpoint.
