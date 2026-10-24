# GitHub Copilot · official REST API

## Connect

1. In MyLimits choose **+ → GitHub Copilot**.
2. Open [GitHub's fine-grained token form](https://github.com/settings/personal-access-tokens/new).
   Choose the correct GitHub account. No repository access is needed. In Account
   permissions choose **Plan → Read-only**, then generate the token.
3. Paste it into MyLimits and click Connect. Approve access to `api.github.com`.
4. Expand the connected account's settings and choose Free, Pro, Pro+ or Custom
   monthly allowance. Until chosen, usage is displayed but remaining quota is unknown.
5. After the first connection, click **Add another GitHub account** in the popup,
   overview or account details. Services also has a visible Copilot **Add account**
   button. Each opens a new-token flow; it does not replace the existing connection.
6. Create the token while signed into the **other** GitHub account. Use a private
   window for token creation to keep your usual GitHub login unchanged. Paste that
   account's token to add its separate card and independently scheduled connection.

A second token for the same GitHub identity is rejected as already connected;
use **Replace token** to renew that account instead. Simultaneous duplicate adds
keep one connection and remove the unused token. Existing aliases and readings
stay intact. Token setup runs in the normal full dashboard; popup/sidebar actions
open it automatically, without changing the browser's GitHub session.

Rename, replace a token, disconnect or forget from account details. A replacement
must verify the same immutable GitHub user ID. Another user's token belongs in a
new connection. Disconnect deletes that connection's encrypted token and keeps
its dated readings; Forget also deletes that account's history. Revoke a token
on GitHub separately if desired.

## Contract and assumptions

Official documentation inspected 24 October 2026:
[Get premium request usage for a user](https://docs.github.com/en/rest/billing/usage?apiVersion=2022-11-28#get-premium-request-usage-for-a-user).

Only these REST endpoints collect data:

- `GET https://api.github.com/user`, before and after usage: numeric `id` and `login`.
- `GET https://api.github.com/users/{login}/settings/billing/premium_request/usage?year=YYYY&month=M&product=Copilot`.

Headers: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`,
Bearer authorization. Requests omit cookies and reject redirects. There are no
GitHub website data requests, cookie reads or scraping in this connection path.

Usage requires `timePeriod.year`, verifies month if returned, and verifies `user`
against the authenticated login. Sums `usageItems[].grossQuantity` for
case-insensitive `product = Copilot`, requiring `unitType = requests`. Gross
quantities include discounted/included usage; `netQuantity` would omit it.
Fractional requests are preserved. An empty item array is a verified zero.
Malformed data, wrong month or a changed identity never overwrite prior readings.
The documented endpoint has no pagination parameters.

**No allowance field is documented in this API response.** No undocumented field
is assumed. The user explicitly supplies the allowance; it is not provider-reported.
The requested defaults (Free 50, Pro 300, Pro+ 1500) live in `src/core/copilot.ts`
with a reminder to verify the current GitHub plan page before release. Do not infer
an account's plan from a token or confuse premium requests with all Copilot usage.
Resets are calculated as next month's first day at 00:00 UTC.

## Storage and refresh

PATs are encrypted with AES-GCM, random 96-bit nonces and per-slot associated data.
The existing IndexedDB key store manages a non-extractable AES-256 key. Ciphertext
lives only in `mylimits:tokens:v1`, separate from Store and cookie-vault policy.
Tokens are sent only to GitHub API requests and the extension background handler;
they do not enter Store, snapshots, history exports, diagnostics, errors or logs.
The password input is cleared after an attempt. No external backend or separate application
is required. The current storage protection requires Chromium's trusted-context
storage API; Firefox token setup is not live verified and fails closed if absent.

Each token gets `copilot:<UUID>` and its own refresh schedule. The same verified
GitHub user reuses its account identity instead of inventing another user.
A 15-minute minimum applies to scheduled and manual refreshes. Browser closure
pauses collection. A 401 stops all retries until token replacement; 403/404
explain Plan: read; rate-limit deadlines use the existing scheduler backoff.
Provider failures retain the last successful timestamp and readings.

## Manual acceptance · PENDING

Automated tests use fictional REST responses and tokens, never real GitHub accounts.

- Connect a real fine-grained Plan: read token; compare this month's premium
  requests with GitHub billing. Verify included/discounted usage is counted correctly.
- Connect a second user's token; compare both identities and readings. Verify
  the normal browser's GitHub login remains unchanged.
- Select a plan or custom allowance; confirm percentages and UTC reset.
- Reopen the browser after 15 minutes; refresh without GitHub website tabs.
- Revoke the token; after the next eligible fetch confirm the exact expired/revoked
  message and no subsequent requests until replacement. Replace using the same user.
- Try a token lacking Plan: read, and an expired token; confirm clear errors.
- Disconnect A, then Forget B; verify encrypted entries disappear independently.
- Verify a GitHub-generated 403/429 and rate-limit headers when safely available;
  do not intentionally flood the API.
