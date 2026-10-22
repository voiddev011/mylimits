# Start here — MyLimits Desktop + extension

The active direction is a one-time Windows desktop installation plus the existing
extension. Separate official provider profiles should track multiple accounts
without changing the ordinary Chrome/Brave website session.
Version 3.4 on `feature/desktop-independent-accounts` now routes independent +
connections through Desktop, with a guided bootstrapper and identity confirmation.
**Both providers still need real two-account acceptance.** Code/fixture checks do
not certify login, quota freshness or preservation of a real website account.

Read in this order:

1. Applicable repository instructions and Git status; preserve user changes.
2. [Current status and next action](IMPLEMENTATION-STATUS.md).
3. [The single active implementation plan](DESKTOP-ACCOUNTS-IMPLEMENTATION-PLAN.md).
4. [Existing local proof commands](ACCOUNT-PROOF.md) and [historical evidence](IMPLEMENTATION-HISTORY.md).

[Sol 6.1 starter prompt](STARTER-PROMPT.md) runs D01–D10 sequentially on a new
feature branch. No parallel agents. Keep project Markdown directly in docs/.
Reuse the existing local account service and Windows installer. Do not repeat
hosted foundation work or build another desktop framework before provider proof.

Website tracking stays available without Desktop. Independent connections require
Desktop in this plan; a normal new tab does not isolate a login. Codex quota is not
every ChatGPT allowance. Source/fixture checks are not live account proof.

[Install current preview](INSTALL.md) · [Delivery/handoff](DESKTOP-ACCOUNTS-HANDOFF.md) · [Documentation index](README.md)
