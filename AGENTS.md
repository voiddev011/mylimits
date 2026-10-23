# Agent rules for MyLimits

Plan: docs/MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md. Follow §0 rules 1–12 and every [R2] note.

## Commands
- Install: `npm ci` (Node 24+).
- Fast loop: `npm run typecheck && npm test`.
- Before reporting done: `npm run check`, then `npm run test:browser`
  (after `npx playwright install chromium`). If Chromium cannot run in your
  environment, say so in the report. Never skip silently.

## Hard rules
- One task group (§11.1) per task, one branch, one PR into feat/persistent-accounts.
- Never log, store in Store, export or sync a secret (cookie values, tokens, ciphertext).
- Schema changes additive; Store.version stays 2; add a migration test.
- No new dependencies unless the plan says so.
- Register new test files in scripts/run-tests.mjs.
- Inject browser APIs into new platform modules; test with fakes; no live provider traffic.
- Never touch feature/desktop-independent-accounts.
- Stop and report if the plan contradicts the code.
- PR description = handoff report in plan §11.3.
