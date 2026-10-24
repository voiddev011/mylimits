# Current main — combined updates

Updated 24 October 2026. Main integrates all five feature PRs with merge ancestry
preserved; merged branch heads can be deleted without losing their commits.
`archive/pre-simplify` stays unchanged as the explicit recovery branch.

## Included

- [U1 #21](https://github.com/voiddev011/mylimits/pull/21): remove unused providers,
  local helper, hosted/snapshot routes and floating preview; retry-safe cleanup of
  retired browser data while preserving supported accounts/settings/history.
- [U4 #22](https://github.com/voiddev011/mylimits/pull/22): verified website login
  switches are remembered automatically; Live/Remembered cards and display-only
  projected resets. Projections never enter history, alerts or badge calculations.
- [U2 #24](https://github.com/voiddev011/mylimits/pull/24): official REST Copilot
  premium requests, separately encrypted tokens, per-account refresh, explicit
  allowance settings, 15-minute minimum and independent token deletion.
- [U3 #25](https://github.com/voiddev011/mylimits/pull/25): simple History account
  cards/charts, range chips, reset markers, tooltips, readings table and menus.
- [P1 #23](https://github.com/voiddev011/mylimits/pull/23): static website, Pages
  workflow and tag-triggered browser packaging workflow. Content reconciled with
  removed features and the new Copilot route.

## Combined validation

- `npm run check`: PASS — typecheck, **221 unit/platform tests**, Chrome build.
- `npm run test:browser`: PASS — **69 extension/site tests**.
- `npm run test:spike`: PASS — **4 simulated evidence tests**.
- Chrome/Edge/Firefox builds and `node scripts/check-packages.mjs`: PASS.
- Chrome/Firefox ZIPs, checksum generation and `python scripts/check-archives.py`: PASS.
- New integration coverage confirms cleanup preserves Copilot connections and
  encrypted storage, and eligible controller refresh updates A without changing B.
- No dependencies added. No removed route or provider restored by merge resolution.

Latest local build artifacts (3.4.0):

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.output/mylimits-3.4.0-chrome.zip` | 212796 | `32cb185a49f6dcd04dcd71139a699ec3b499d9c5b5b6d0c43e8ad7af5701e12a` |
| `.output/mylimits-3.4.0-firefox.zip` | 212735 | `449687c83a6fef495714f824c2a1dd8b550a789397611a450ceff45b3108f0b0` |

Build timestamps may change ZIP bytes and hashes in CI. Packages contain only
four optional provider origins; no native-messaging permission. Existing release
assets may predate main; no release tag is created by this integration.

## Remaining checks and operator setup

Real provider account/token, quota comparison, renewal and logout checks remain
PENDING. Website readers track only the current browser login; remembered cards
are dated readings, not independent logged-out refresh. All saved website sign-in
policies remain off. Copilot is an independent token route with real-token acceptance
pending; Firefox token setup is unverified and fails closed without required APIs.

GitHub reported `has_pages: false` before integration. The repository operator must
enable Pages with GitHub Actions source for website deployment; merging code does
not itself prove hosting is live. No publication or live provider success is claimed.

Next: update the installed extension from main using [INSTALL.md](INSTALL.md),
then run the explicit [Copilot acceptance checks](COPILOT.md). Keep credentials out
of issues, diagnostics and chat.

## Remote delivery checks

All five PRs (#21–#25) are merged on GitHub. Six merged remote branches were
removed only after ancestry checks; only main and archive/pre-simplify remain.
Node 22/24/26 CI checks passed on the integration head. The Pages workflow's first
run failed at checkout because its job-level permission map omitted contents: read;
this is corrected. Pages is also not enabled on the repository, so operator setup
in WEBSITE.md remains required. This is separate from extension validation.
