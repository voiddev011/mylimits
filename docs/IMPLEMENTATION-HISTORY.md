# Implementation history and evidence

Consolidated 22 October 2026. This is historical evidence, not the active task list.
Use [the desktop plan](DESKTOP-ACCOUNTS-IMPLEMENTATION-PLAN.md) and
[current status](IMPLEMENTATION-STATUS.md) for what to do next.

## Local proof and 3.2 account service

The local service contains both official-profile adapters: Codex managed App Server
and Claude Code auth/status plus a bounded PTY `/usage` reader. Profiles, aliases,
history, cooldowns, cancellation, reconnect, generation fences, Native Messaging
and Windows setup were implemented. These remain reusable code; their presence
does not establish successful real-provider A/B tracking.

Important correction to early proof-only documentation: the later 3.2 code did
implement Claude browser routing through the official BROWSER override. It was
exercised with an unmodified official binary, an isolated unauthenticated profile,
the compiled Windows router, a loopback callback observation and confirmed cancel.
Automatic sign-in of a real second account was not tested.

Recorded 3.2 source: [d3e821ad](https://github.com/voiddev011/mylimits/commit/d3e821ad1d200c16bc6c0b6d6efc4de8315ae7dc).
[CI 39587512847](https://github.com/voiddev011/mylimits/actions/runs/39587512847)
passed verify, windows-logic and connected-services. Historical counts: 102 core,
20 legacy native, 18 connection and 29 Chromium tests; account-proof 30 passed
on Linux and 29 passed/one symlink-privilege skip on Windows. These are simulated
account tests with actual child processes/PTYs, not authenticated provider proof.

Earlier [proof CI 39006704947](https://github.com/voiddev011/mylimits/actions/runs/39006704947)
also passed after Windows owned-process shutdown fixes. Retain those fixes:
requesting termination is not confirmation; do not overlap credential writers or
delete profile directories until shutdown is confirmed. Exact older ledgers and
failed-run details remain in Git history.

Historical 3.2 CI artifacts (may expire; not public releases):

- [Extension package 12340496910](https://github.com/voiddev011/mylimits/actions/runs/39587512847/artifacts/12340496910).
- [Windows helper 12339618052](https://github.com/voiddev011/mylimits/actions/runs/39587512847/artifacts/12339618052).
- These are unsigned development packages; helper runtime/dependencies are large.
  They do not implement the new guided/smaller installer in the desktop plan.

## Hosted 3.3 foundation

Implemented reusable infrastructure: owner-scoped attempts and connections,
identity/workspace contracts, aliases, encrypted credential boundaries, PostgreSQL
jobs, cancellation/reconnect generations, cooldowns, stale-state handling and
extension/API transport. Real production provider drivers remain absent.
Fixture end-to-end tests exercised Chromium/API/database transport only.

The 3.3 default + flow selected hosted connections, so it reported providers as
unavailable. The earlier local service remained in advanced settings. Do not
conflate an empty hosted registry with absence of the earlier local adapter code.
The active plan changes the default journey to the local desktop service.

## Official-binary hosted observations

Official Codex 0.163.0 and Claude Code 2.1.301 were run in fresh temporary profiles
without opening existing credential caches. Integrity was checked when obtaining
the official packages. No real account was signed in and no model prompt was sent.

| Observation | Actual result | Limit |
| --- | --- | --- |
| Codex initial account read | No account in fresh profile | No identity/eligibility proof |
| Codex device-code start | Official URL/code issued; cancellation acknowledged | No authentication or quota; not automatic popup completion |
| Codex managed browser start with hosted success-page flag | Official authorization issued; callback remained loopback | Does not establish automatic hosted completion |
| App Server generated account schema | Email/plan metadata, no immutable subject/workspace in inspected interface | Version-specific; do not invent a stable ID |
| Claude BROWSER hook | Official URL with loopback callback observed | Not an authenticated two-account Windows proof |
| Claude cancellation | Owned process shutdown confirmed | Not account logout/global revocation proof |

Reports explicitly recorded `authenticated:false`, `quotaFetched:false`. No raw
authorization URL/code/state, token, email or credential was exported. Directories
were removed after confirmed shutdown. An early restricted shutdown attempt failed;
the exact owned process was cleaned up before a subsequent confirmed run.

The final provider-gate run recorded 10 hosted-probe tests and 30 account-proof
tests passing. These counts are historical and are not claimed rerun by this
documentation change. Its source checkpoint was remote
`6ac9ae6b3582f666d8d52c23f7a7eb41e48480f8`; final documentation remote
`07692b1ba18bbd97cfdf9a808620e7bbffe6bc57` (tree
`0be07693d9716ae49cff0a3324497438bc34478c`). Matching local final commit
`745bf2a25b809a2475085d353d62d0b8c02a0a8a` has a different parent history due to
connector publication. Do not force-push/reset to reconcile these old IDs.

[CI 39665803268](https://github.com/voiddev011/mylimits/actions/runs/39665803268)
was in progress at its last recorded check; this record does not assert success.

## Hosted findings retained, execution deferred

Local loopback callbacks fit the new on-device plan. They did not solve remote
hosted completion. OpenAI hosted registration, quota access and immutable identity
were unresolved; identity-only sign-in is not quota authorization. Claude's
unmodified hosted-binary conditions do not establish a permitted automatic
quota-only hosted product. The manual remote-code fallback differed from the
requested user experience. No application or provider clarification was submitted.

[Provider access drafts](PROVIDER-ACCESS-REQUESTS.md) and
[server operations](SERVER-SETUP.md) remain references for future hosted work.
They are not prerequisites for beginning the local desktop implementation.

## Last built extension preview

The existing 3.3 Chrome preview was rebuilt, with no new independent-login UI:
`.output/mylimits-3.3.0-chrome.zip`, 306395 bytes, SHA-256
`85f3190ad92f6d376128ef4443d54e28768926bde05cc0d6e0f81ef138dfb811`.
This is a historical artifact identity, not a newly built or published package.
It contains no desktop runtime and has no configured production hosted origin.

## Documentation consolidation

Removed superseded plan/handoff files after preserving unique conclusions here,
current commands in ACCOUNT-PROOF/OPENAI-COMPANION/INSTALL, provider scope in
PROVIDER-CAPABILITIES, and sources in COMPETITOR-RESEARCH. Removed files:

- ACCOUNT-PROOF-HANDOFF.md
- MULTI-ACCOUNT-HANDOFF.md
- MULTI-ACCOUNT-INSTALL.md
- HOSTED-ACCOUNTS-IMPLEMENTATION-PLAN.md
- HOSTED-ACCOUNTS-HANDOFF.md
- HOSTED-ACCOUNTS-TRIAL-PLAN.md
- HOSTED-FEASIBILITY.md
- INDEPENDENT-ACCOUNTS-FINAL-PLAN.md
- INDEPENDENT-ACCOUNTS-FINAL-HANDOFF.md
- INDEPENDENT-ACCOUNTS-RESEARCH-AND-PLAN.md
- PROVIDER-INTEGRATION-NOTES.md

Full previous Markdown and the detailed phase ledgers remain recoverable from
local baseline `745bf2a` or remote baseline `07692b1b`. No application source,
license notices, provider profiles, user account data or operational setup files
were deleted by this consolidation.
