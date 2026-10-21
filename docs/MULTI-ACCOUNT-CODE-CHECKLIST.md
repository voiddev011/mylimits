# Multi-account code completion checklist

21 October 2026 · `feature/independent-accounts`.
The user will perform real-account acceptance. Those checks are tracked separately
and are not substitutes for completing source code and automated regression tests.

## Code work

- [x] OpenAI isolated managed login, identity fencing and independent refresh.
- [x] Shared native contract, persisted retries, cancellation and account management.
- [x] Optional helper, compact popup and full dashboard.
- [x] Confirm an official Claude browser-selection mechanism with an unmodified CLI.
- [x] Implement Claude per-profile first-party sign-in and cancellation without
  changing the ordinary browser account or passing tokens through MyLimits.
- [x] Integrate official Claude auth/status and isolated /usage adapter into service.
- [x] Generalize persisted profile validation, identity metadata and extension merge
  for both providers; preserve all existing OpenAI IDs, aliases and histories.
- [x] Make account connection/management UI work for Claude as well as OpenAI.
- [x] Package the required terminal/runtime dependencies and guided first-party
  Claude setup into the Windows helper; no manual recurring terminal operation.
- [x] Add regression coverage for two accounts per provider, mixed accounts,
  cancellation, identity changes, cooldowns, restart and disconnect isolation.
- [ ] Build/package, inspect Linux and Windows CI, update handoff, commit and push.

## Separate manual account acceptance (user)

- [ ] Sign into two OpenAI and two eligible Claude accounts.
- [ ] Verify default-browser A remains signed in while B connects.
- [ ] Compare reported scopes/values with each provider; use another device.
- [ ] Test website logout, global revocation, restart and actual token renewal.

## Decision boundaries

Official CLI owns all authentication and credentials. No custom Claude OAuth,
cookie copying, credential-file/keychain extraction or invented quotas. A supported
browser mechanism must be validated before enabling it. Lack of actual accounts
is a manual test dependency; absence of a usable provider interface is a code/design
blocker and must never be represented as only a pending account test.

## Browser mechanism evidence

[Official browser override guidance](https://code.claude.com/docs/en/troubleshoot-install#oauth-login-fails-in-wsl2-ssh-or-containers)
explicitly documents BROWSER. Unmodified official Claude 2.1.301 was run in an
empty profile with an owned marker as the browser: override invoked, CLI-owned
loopback callback confirmed, and login cancelled cleanly. No account was signed
in and no auth URL/credential was exported. Windows repeats this exact capability
check on CI using a pinned, integrity-checked official binary and compiled launcher.

Claude usage comes from a fresh official CLI /usage panel, not copied tokens or
private endpoint calls by MyLimits. Provider observation time remains unknown.
Cross-device propagation and exact returned quotas remain user acceptance checks.
One-time first-party onboarding can require user choices in the official setup
window; MyLimits does not automatically accept trust or terms.
