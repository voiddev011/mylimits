# Start here — MyLimits independent hosted accounts

Read in this order:

1. Applicable repository instructions and git status; preserve existing changes.
2. [Current status](IMPLEMENTATION-STATUS.md).
3. [The active execution plan](HOSTED-ACCOUNTS-IMPLEMENTATION-PLAN.md).
4. [Actual hosted experiment evidence](HOSTED-ACCOUNTS-TRIAL-PLAN.md).

[Sol 6.1 starter prompt](STARTER-PROMPT.md) launches implementation H01–H10.
Work sequentially on a new feature branch. No parallel agents. Keep all project
Markdown directly in docs/. Do not restore obsolete Guide or earlier phase tasks.

The requested product is a small extension with + connection choices and hosted
independent accounts, without a local helper install. That product is NOT complete.
Website tracking and the experimental local helper already exist; reuse relevant
code. New-tab website login is not independent authorization. Provider routes must
be proven independently, and blocked routes stay explicitly unavailable.

Implement safe independent UI/backend work even if provider testing is pending.
Do not declare the user's goal complete from tests using fictional providers.
Use the current status ledger for exact next actions, not old release plans.
