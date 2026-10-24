# Agent rules for MyLimits

Main integrates U1–U4 and the static website; archived plans are not active instructions.
Project Markdown belongs directly in docs/ (this instruction file is the exception).

- Preserve user changes and work on a task branch; PR into main.
- Follow the active task scope. No new dependencies without authorization.
- Keep Claude, ChatGPT/Codex and Cursor website tracking, diagnostics, backoff,
  sign-in signals, temporary-tab recovery, history, gated saved-sign-in code, and
  official REST Copilot tracking with separately encrypted tokens.
- Keep every saved-sign-in provider policy off; never infer live provider behavior
  from fixtures. Never log, expose or export credentials/ciphertext.
- Store.version stays 2. Compatibility cleanup must preserve remaining accounts,
  aliases/preferences/history and retry safely after interruption.
- Inject browser APIs into new platform modules. No live provider traffic in tests.
- Register new unit test files in scripts/run-tests.mjs.
- Before reporting done: npm run check, then npm run test:browser.
- Handoff PR body includes changed/deleted files, actual checks, migration behavior,
  permission list before/after, limitations and manual checks.
- Never modify archive/pre-simplify or feature/desktop-independent-accounts.
