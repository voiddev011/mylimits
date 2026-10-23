# Session persistence — live evidence ledger

C6 supplies diagnostic tools only. **No live experiment below has been run by the
agent.** Automated cookie/provider/transport fixtures are simulated and cannot
fill a live PASS. C7's gate report and G0/G1 decisions have not been performed.

Use your own test accounts in a separate Chrome/Edge/Brave profile. Add one row
per experiment, provider, browser/version and date. Keep only sanitized output:
cookie names/flags, status/path templates, times, observed rule-feedback state and
your outcome. Never paste cookie values, tokens, raw headers/bodies, or account IDs.
See [C6 installation and experiment instructions](INSTALL.md#c6-evidence-spike-test-accounts-only).

| Exp | Provider | Browser | Date | Result | Notes (no secrets) |
| --- | --- | --- | --- | --- | --- |
| E1 | Not tested | Not tested | — | PENDING | Overnight/no-provider-tab behavior; separate real gap from cookie-deletion emulation |
| E2 | Not tested | Not tested | — | PENDING | B: status for every endpoint/variant, including Grok POST; record whether any existing-tab fallback ran |
| E3 | Not tested | Not tested | — | PENDING | Captured-cookie replay with an empty normal jar; minimal names; extension initiator/tabIds scope; user tabs unaffected |
| E4 | Not tested | Not tested | — | PENDING | Separate private session survives ordinary normal logout? Private logout? Global revocation? Record separately |
| E5 | Not tested | Not tested | — | PENDING | Original captured session at 24h/72h/7d, expiry flags and whether memory capture survived; a recapture is a new test |
| E6 | Not tested | Not tested | — | PENDING | D: Set-Cookie names on worker replay reads; names alone do not establish rotation/old-value rejection |
| E7 | Not tested | Not tested | — | PENDING | C/F: decoded expiry, Bearer-only usage status, no cookies/DNR; expiry is not signature-verified |
| E8 | Not tested | Not tested | — | PENDING | Per-browser incognito access, store enumeration, owned-window creation/closure, policy restrictions |

## Live acceptance — not enabled by C6

The scenarios are defined in §7.1 of the
[unchanged implementation plan](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md).
The production saved-session feature remains unavailable. These rows are a ledger,
not instructions to manufacture connection records or turn on a provider policy.

| Scenario | ChatGPT | Claude | Evidence |
| --- | --- | --- | --- |
| 1 Browser A / independent B, separate aliases and refresh | PENDING | PENDING | None |
| 2 Normal logout and recovery; B keeps updating | PENDING | PENDING | None |
| 3 Browser restart/overnight without opening provider | PENDING | PENDING | None |
| 4 Other-device usage reflected | PENDING | PENDING | None |
| 5 Expiry and re-sign-in | PENDING | PENDING | None |
| 6 Forget B removes credentials and leaves A intact | PENDING | PENDING | None |
| 7 Claude vault off / Desktop alternative | PENDING | PENDING | Policy decision still gated; no vault UI yet |
| 8 Both privately connected; normal logout | PENDING | PENDING | None |
| 9 Normal/private account isolation | PENDING | PENDING | None |
| 10 Forced same-host source overlap | PENDING | PENDING | None |

## Boundaries of the tool

- No automatic collection in the spike build. The normal build remains unchanged.
- Cookie/token captures live only in worker memory. The page sends keepalive
  messages, but a browser/worker restart can still lose the capture. Do not claim
  a long-lived session result after silently recapturing it.
- Closing/disconnecting the diagnostic page cancels work, drops captures and
  closes only its own private window. It never calls provider logout or deletes
  browser cookies. Close the dry-run window without logging out when testing E4.
- Provider cooldowns survive page/worker reconnect in extension session storage.
  Storage or rule-cleanup failure disables unsafe further work. Never clear waits
  to bypass provider throttling.
- B's ambient path uses current background/existing-normal-page transport; it
  deliberately omits automatic temporary-tab recovery so comparisons do not
  silently open a provider page during E2. Normal C4 recovery remains available
  in the ordinary build for its separate live trial.
- B's request success and DNR feedback are separate observations. Missing feedback
  is UNVERIFIED, not a scoped-rule PASS. Automated routing fixtures cannot prove
  DNR-modified headers or real server acceptance.
- D records only names, never renewed cookie values. It cannot prove whether an
  old session was rejected. That part of E6 requires your independent live check.
- No vault, private-account setup, header-normalization rollout or G0/G1 decision
  is implemented in C6. Claude's future policy remains a human decision at G1.
