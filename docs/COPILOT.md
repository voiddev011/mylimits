# GitHub Copilot usage

## Choose a reading source

MyLimits has two distinct Copilot sources. Neither is a streaming feed: refreshes
run at most once per account every 15 minutes while the browser is running, and
respect GitHub throttling. Other-device usage appears after GitHub updates its
counters and the next successful eligible refresh.

**Account quotas (experimental)** reads the first-party IDE entitlement endpoint
used by VS Code. Where GitHub permits the supplied token, it displays separate
Credits / Chat, Inline suggestions and allocated premium quota meters, with the
returned percentages, allowances, unlimited status and reset times. It is an
undocumented interface, not a supported public REST contract. A fine-grained
Plan: read token is **not guaranteed** to have entitlement access. No client-ID
impersonation, IDE headers, IDE token extraction, browser cookies or scraping are
used. A denial stays an explicit error; there is no silent billing fallback.

**Billing (default)** uses documented GitHub REST reports. GitHub documents user
billing as applicable to personally purchased Copilot plans, not Free-plan
entitlements or organization-billed seats. Current AI credit usage is read first.
The report supplies usage, not the VS Code quota percentage or inline-suggestion
allowance. If no matching credit items are returned, MyLimits checks legacy
premium requests. Only actual matching legacy rows select that source. Empty
reports show **Quota unavailable through billing API**, never a fabricated zero
Free-plan reading. A real matching report row with quantity zero remains zero.

## Connect or update

1. Choose **+ → GitHub Copilot** and create a fine-grained token from the intended
   account at [GitHub token settings](https://github.com/settings/personal-access-tokens/new).
   Grant **Plan → Read-only**; repository access is not needed for billing.
2. To try the VS Code-style quota meters, explicitly check **Read account quotas
   (experimental)**. If GitHub rejects the token, MyLimits cannot claim Free/paid
   quota support for that account. Billing permission alone does not grant IDE
   entitlement access.
3. Paste the token into MyLimits and Connect; approve `api.github.com` access.
   The normal full dashboard handles token setup. Popup/sidebar actions open it.
4. Existing users can expand their Copilot card and enable the same checkbox.
   The change fences old in-flight reads and takes effect at the next eligible
   refresh. It does not bypass cooldowns. Old readings remain dated until replaced.
5. Use Preferences → Display → Used to compare a returned quota with VS Code's
   used percentage. Remaining is supported too. Unlimited stays Unlimited.
6. For a verified **legacy premium-request** source only, set a custom allowance
   or the legacy annual Pro / Pro+ preset. There is no Free 50-request preset.
   Legacy allowances never overwrite credit or entitlement meters.

For account B choose **Add another GitHub account**, create B's own token (a
private window keeps the normal GitHub login unchanged), then connect it. Each
connection has a separate encrypted token, identity and refresh schedule. A
second token for A is a duplicate, not B. Replace token must verify the original
GitHub user ID. Aliases and history remain available.

Disconnect removes only that connection's encrypted token and retains dated
readings. Forget also deletes its history. Revoke tokens on GitHub separately.
Switching sources does not rewrite older history or reinterpret requests as
credits. Previously saved zero readings are not retroactively claimed accurate.

## Evidence and exact requests

Verified against official documentation and source on 24 October 2026:

- [GitHub billing API](https://docs.github.com/en/rest/billing/usage): current
  credit endpoint, Plan: read, user-billing eligibility and response fields.
- [GitHub billing transition](https://github.blog/news-insights/company-news/GitHub-copilot-is-moving-to-usage-based-billing/):
  AI Credits replaced premium requests for current billing; exceptions retain
  legacy request-based annual subscriptions.
- [VS Code configuration](https://github.com/microsoft/vscode/blob/main/product.json)
  and [quota parser](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/chat/common/chatEntitlementService.ts):
  entitlement URL, quota snapshots, legacy Free quantities and unlimited handling.

Every path verifies `GET https://api.github.com/user` before and after collection.
The immutable numeric ID is the account identity. Returned entitlement ID/login,
when present, must match. Credentials are sent only to this exact HTTPS origin;
requests omit browser cookies and reject redirects.

Documented billing paths:

- `/users/{login}/settings/billing/ai_credit/usage?year=YYYY&month=M`
- `/users/{login}/settings/billing/premium_request/usage?year=YYYY&month=M&product=Copilot`

Headers use `Accept: application/vnd.github+json` and
`X-GitHub-Api-Version: 2026-03-10`. Credit reports require matching
`product = Copilot AI Credits`, `unitType = ai-credits`; legacy requests require
`product = Copilot`, `unitType = requests`. Gross quantities include discounted
usage. Response user/year/month are validated. Missing allowance stays unknown.
Legacy billing's monthly reset is calculated; entitlement resets are only the
actual returned timestamps. Credit billing does not invent a reset timestamp.

Explicit experimental opt-in enables `/copilot_internal/user`. Parsed fields:
`copilot_plan`, `token_based_billing`, `quota_snapshots.chat/completions/premium_interactions`,
`percent_remaining`, `entitlement`, `credits_used`, `quota_remaining`, `unlimited`,
`quota_reset_at`, and account reset dates. Legacy Free fallback uses
`monthly_quotas` / `limited_user_quotas`. Zero allocated snapshots are omitted;
missing fields stay unknown. No quota at all is an error, not a successful zero.

## Storage, errors and compatibility

PATs remain encrypted in `mylimits:tokens:v1` with AES-GCM and a non-extractable
IndexedDB key, outside Store, history, exports, diagnostics and logs. Password
inputs clear after attempts. No helper, backend, additional permission or cookie
access is added. Store.version stays 2. Optional `copilotQuotaAccess` defaults to
false for old connections; old IDs, aliases, tokens, allowances and history remain.
The optional meter `unlimited` field is additive. Unlimited quotas do not produce
projected resets, percentages or low-limit alerts.

401 stops refresh until token replacement. 403/404 on experimental quota access
explain that billing authorization does not grant IDE entitlement access. Billing
403/404 explain permission and plan eligibility. 429/Retry-After retain existing
backoff. Failures preserve prior readings and successful timestamps; they do not
turn cached values into fresh quotas.

## Live acceptance · PENDING

Automated checks use fictional data, never real account credentials. Source-code
compatibility is not evidence that a user's fine-grained PAT can access quotas.

- Real Copilot Free: authorize quota access; compare Credits and Inline Suggestions
  with VS Code, using the same account, display mode and reading time.
- Real paid Copilot: check credits, unlimited suggestions and actual reset times.
- Denied fine-grained PAT: explicit error, no false zero, no fallback success.
- Two real accounts: independent identity and counters, no browser login change;
  usage on another device appears on the next eligible refresh.
- Credit-billed and legacy annual plans: confirm appropriate public billing rows
  and units, and that legacy custom allowances do not alter quota/credit readings.
- Throttling, revocation and token replacement; disconnect B leaves A working.
- Windows Chrome/Brave end-to-end setup and Firefox storage compatibility.
