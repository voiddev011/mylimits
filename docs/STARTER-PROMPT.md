# Starter prompt for Sol 6.1

Select Sol 6.1 and paste this on the branch containing this document:

```text
Implement MyLimits Desktop + extension independent accounts.

Read repository instructions, docs/START-HERE.md, docs/IMPLEMENTATION-STATUS.md,
docs/DESKTOP-ACCOUNTS-IMPLEMENTATION-PLAN.md, docs/ACCOUNT-PROOF.md and
docs/IMPLEMENTATION-HISTORY.md. Read relevant setup/research as needed.

Create feature/desktop-independent-accounts from the current documentation
branch, preserving user edits. Execute D01–D10 sequentially, one workstream at
a time, without parallel agents. Start implementation after inspection; do not
stop at another plan. Do not merge main or publish a release.

The user now accepts one guided Windows desktop installation alongside the
extension. This replaces the installation-free hosted execution goal. Reuse
companion/connections.mjs, official Codex/Claude adapters, browser routing,
Native Messaging, existing React UI, Windows setup and NSIS packaging.
No new Electron/Tauri/.NET rewrite or hosted backend is needed for this route.

Critical: real provider proof comes first. Local 3.2 adapters already exist;
3.3's default hosted registry is empty. Do not mistake that for missing local
code or spend another run reimplementing surrounding infrastructure.
OpenAI managed sign-in and Claude's official BROWSER routing have actual
unauthenticated binary evidence. Neither has authenticated A/B acceptance here.
Prove login -> reported identity -> real quota, then B without changing ordinary
browser A and other-device usage on the next eligible check, separately per provider.

Use isolated CODEX_HOME/CLAUDE_CONFIG_DIR and external browser profiles. Let
unmodified official software own credentials/callbacks/renewal. No password
collection, cookie copying, CLI token extraction, custom OAuth/client impersonation
or auth/throttle bypass. Resolve current provider monitoring/distribution conditions.
Confirm account identity before success; aliases are not identity. Record confidence
when immutable IDs are unavailable; never merge accounts on email alone.
Do not relabel passive Claude snapshots as current provider fetches or Codex
quotas as all ChatGPT limits. Missing quota/reset/observation data stays unknown.

Keep website detection. Provider + offers Use current browser account or Connect
another account; independent sign-in uses Desktop, not the empty hosted path.
Preserve IDs, aliases/history and timestamps. Compact popup; setup/management in
dashboard. Keep Guide and provider toggles removed.
Install users through one guided EXE, no Node/npm or recurring terminal commands,
manual tokens/config files or public-build extension-ID entry. Measure bootstrapper,
total downloaded and installed sizes separately; do not promise tiny total size or
literal one click. Signing, store IDs and provider prompts are real prerequisites.

If real account access is unavailable, finish runnable code and exact user tests
under honest experimental capability states; live checks remain PENDING. A missing
login/collector is incomplete code. Continue work independent of blocked access.
Keep fictional tests separate from official-binary and authenticated evidence.

After every task update IMPLEMENTATION-STATUS with changed files, actual commands
and results, decisions, blockers and next action. Keep Markdown directly in docs/.
Commit coherent checkpoints and push when access permits. Deliver extension ZIP,
Windows setup EXE where build access permits, checksums, short setup/test instructions
and docs/DESKTOP-ACCOUNTS-HANDOFF.md. Report IMPLEMENTED / AUTOMATED TESTED /
LIVE VERIFIED / BLOCKED OR UNVERIFIED. Both providers must pass the active live
matrix before claiming the requested feature works completely.
```
