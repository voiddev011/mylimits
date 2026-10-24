# Contributing to MyLimits

MyLimits is an open-source browser extension that shows your AI usage limits
(Claude / Claude Code, ChatGPT / Codex, Cursor, GitHub Copilot) in one place.
Everything runs locally; there is no server and no MyLimits account.

## Working here
- Branch off `main`, open a PR into `main`. Keep `main` releasable.
- Match the existing style (compact TypeScript, zod schemas, serialized `updateStore`).
- Avoid new runtime dependencies unless the change really needs one.
- Put project docs in `docs/`. This file is the exception.

## Don't break these
- Never commit or log secrets: cookie values, access tokens, saved-sign-in
  ciphertext. Cookie *names* and flags are fine. The repo is public.
- A saved sign-in must only be stored for the account it actually belongs to:
  re-verify the account identity before saving, even if cookies rotated.
- `Store.version` stays 2. Migrations must keep existing accounts, nicknames,
  preferences and history, and be safe to re-run after an interruption.
- Inject browser APIs (tabs, cookies, windows, declarativeNetRequest) into new
  platform modules so they can be unit-tested. Tests never hit real provider sites.

## Before a PR
- Register any new unit-test file in `scripts/run-tests.mjs`.
- Run `npm run check`, then `npm run test:browser`. Both must pass.
- In the PR description: what changed, test results, and anything reviewers
  should check by hand.