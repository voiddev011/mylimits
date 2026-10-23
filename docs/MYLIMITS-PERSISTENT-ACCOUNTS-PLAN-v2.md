# MyLimits — keep tracking after logout, track two accounts at once, never ask for a site visit

Implementation plan for an AI coding agent.
Written 23 Oct 2026 against `main` (v2.2.0, commit `77f9537`) of `voiddev011/mylimits`.

**Revision 2 (review).** Nothing from revision 1 was removed. Additions are marked **[R2]**. They fix five bugs found in review:
- cross-account cookie mixing through the DNR rule (§5.4);
- incognito tabs leaking into the ambient fallback (T1.5);
- a 4 KB cap too small for ChatGPT (§5.3);
- the first account still dying on logout (§5.2);
- missing execution order for Codex (§11).

---

## 0. Rules for the agent

1. Work on a new branch `feat/persistent-accounts` cut from `main`. Do **not** edit `feature/desktop-independent-accounts` (see §9).
2. Do the phases in order. Every task ends green: `npm run typecheck && npm test`. After each phase also run `npm run build && npm run test:browser`.
3. **Gates (G0, G1) need a human.** At a gate, stop, fill the report template in §7.3 and ask. Do not guess the answer.
4. **Never log, store in `Store`, export, or sync a secret.** Secrets are cookie values, access tokens and vault ciphertext. Logging cookie *names* and attribute flags is fine.
5. Schema changes are additive. `Store.version` stays `2`. Every new field is optional with a default, and you add a migration test.
6. Match the repo's existing style (compact TypeScript, zod schemas, serialized `updateStore`). Do not add dependencies unless a task says so.
7. Update the docs listed at the end of each phase. `docs/ARCHITECTURE.md` currently states behaviours this plan deliberately changes.
8. Anything marked **VERIFY** is an assumption from documentation or other projects. Phase 0 tests it. Do not build on it before G0.
9. **[R2]** Work one task-group from §11 at a time, on its own branch `codex/<id>` cut from `feat/persistent-accounts`, with one PR into `feat/persistent-accounts`. Rule 1's integration branch stays; the human merges it to `main` at the checkpoints in §11.2.
10. **[R2]** Inject browser APIs (`tabs`, `cookies`, `windows`, `declarativeNetRequest`, `extension`) as parameters in every new platform module, so unit tests run in Node with fakes. Never send requests to real provider websites; use fixtures.
11. **[R2]** If something in this plan contradicts the code, stop and report instead of guessing. Write any browser-API behaviour you rely on but cannot see in code or types under "Assumptions" in the handoff report (§11.3).
12. **[R2]** `npm run check` (typecheck, unit, companion tests, build) must pass before a task is reported done.

---

## 1. Answer in one page

| Your problem | Root cause (in your code) | Fix | How sure |
| --- | --- | --- | --- |
| Asks me to visit the site after a long gap | (a) one 401/403 parks the connection until a tab event or manual click; (b) the only fallback is an *already open* tab; (c) the provider edge probably rejects extension-origin requests | Capped backoff instead of parking, cookie-change signals, bounded temporary tab, request-header normalisation | High for (a)(b); (c) is a hypothesis Phase 0 confirms |
| Two accounts at once | One connection per provider (`website:<provider>`) whose only credential is the browser cookie jar | Make connections per account. Give each extra account its **own** session, captured once through a private window | High for the refactor; medium for the session capture (Phase 0 decides) |
| Keeps tracking after I log out | Logout destroys the only credential MyLimits has | Track accounts through their own independent session, never the browser's current login | **Unknown until experiment E4.** If a provider revokes every session on any logout, no extension-only design can survive it |

Three decisions need you (see §4):

- **Claude policy.** Anthropic's published terms say developers may not collect or store Claude.ai session tokens. So the plan ships the credential vault for **ChatGPT first** and keeps the **Claude vault off by default**. Claude multi-account then uses the official-CLI route you already built on the Desktop branch.
- **Logout survival** is gated by experiment E4.
- **Brief background tab.** Opening one for a few seconds when the provider rejects background requests is on by default, with a switch.

Interim workarounds you can use today, with no code:

- Keep one pinned provider tab open. The existing tab fallback works with that.
- Use a second Chrome profile for the second account, with the extension loaded in both. You get two separate views unless you enable your optional snapshot sync.
- Use the Desktop branch for independent OpenAI/Claude accounts.

**[R2] Two limits you should know before starting:**
- **Two Claude accounts are not solved inside the extension** while `claude: 'off'` (D1). Until you decide otherwise at G1, the extension route for Claude is one Chrome profile per account (each stays signed in, so nothing is lost on "logout"). Views stay separate unless you run the snapshot server, which needs PostgreSQL plus OIDC (`docs/SERVER-SETUP.md`). Phase 5 Firefox containers are the other secret-free route.
- **"Never visit the site" is best-effort.** The temporary tab is an automated visit. It cannot pass an *interactive* Cloudflare challenge (Turnstile), and its daily cap can run out. T1.4 header normalisation probably will not beat a JavaScript challenge, so expect T1.5 to be the main fix.

---

## 2. Root causes, with evidence

### 2.1 One account per provider

- `src/core/model.ts:126-129` — `websiteConnection(provider)` creates exactly one connection per provider, id `website:<provider>`.
- `src/platform/controller.ts:69` — `refreshProvider` hard-codes `website:${provider}`.
- `src/providers/adapters.ts:22,44` — every request uses `credentials: 'include'`, so the browser's cookie jar is the credential. Whatever account the jar holds is the account you read.
- `src/core/account-setup.ts:14` — "Connect another account" only clears the workspace and bumps the generation. It *rebinds* the single connection. The first account is kept as a dated, stale reading (`src/ui/AccountConnect.tsx:69` says so).
- `src/core/engine.ts:51-59` — `markProvider` flips **every** active website account of that provider to the failure status. With two live accounts, one failure would wrongly mark both.

### 2.2 Logout stops tracking

The same fact: there is no credential except the cookie jar. `src/providers/reader.ts:36` throws `signed-out` when ChatGPT's session has no access token, and a 401 maps to `signed-out` in `adapters.ts:57,61`.

### 2.3 "Please visit the site"

1. `src/core/scheduler.ts:5` — once a connection is `needs-auth`, only the `manual` and `tab` reasons may refresh it. A single overnight 401/403 parks it until you open the site (`controller.ts:370` maps tab load to the `tab` reason).
2. `src/providers/adapters.ts:10-15, 53-60` — when the background fetch returns status 0, 401 or 403, the only fallback runs inside an already open tab. With none open it throws `waiting-for-tab`, which the UI renders as "Open Claude in this browser…". `docs/ARCHITECTURE.md` documents "no hidden tab".
3. **Hypothesis (VERIFY with E1/E2):** the provider edge rejects extension-origin requests that carry no recent challenge cookies. Supporting evidence:
   - Claude's own Chrome extension side panel gets 403 on `GET /api/bootstrap` while the same request from a normal claude.ai tab returns 200. The reporter suspects the `chrome-extension://` origin and fetch-metadata headers ([issue 90590](https://claudeissues.com/issue/90590-bug-claude-in-chrome-side-panel-cowork-mode-get-api-bootstrap-returns-403-from-e)).
   - AI Limits documents that Grok endpoints reject extension-background requests and that Cursor rejects cross-origin POSTs. Your Grok reader (`reader.ts:16`) makes exactly such a POST ([FAQ](https://github.com/TiantianFlow/ai-limits/blob/main/FAQ.md)).
   - Another multi-account tracker states that fresh usage needs a real browser session to clear Cloudflare and that there is no fully silent background refresh ([Neoo-Blue/ai_usage](https://github.com/Neoo-Blue/ai_usage)).
4. Nothing listens for cookie changes, so signing back in is only noticed by a tab load.
5. **[R2]** `controller.ts` (`refreshProvider` catch block, ~line 103) already computes `nextRetryAt` on every failure, including `signed-out`. The scheduler simply ignores it for `needs-auth`. T1.1 alone therefore removes most parked connections.

---

## 3. What existing tools do

| Project | Approach | Multi-account | After logout | Lesson for MyLimits |
| --- | --- | --- | --- | --- |
| Claude Monitor (extension) | Browser cookies, background fetch | No | Stops | Auth failure uses capped backoff (skips up to 6 ticks), **never parks**. Forced refresh bypasses it. Pins the org. ([source](https://github.com/claude-monitor/claude-monitor-browser-extension/blob/main/extension/background.js)) |
| TokenYou | Browser cookies, `credentials:'include'` | No | Stops | No header tricks and no Cloudflare handling. Same weakness you have. ([source](https://github.com/diegoparras/tokenyou/blob/main/src/lib/http.js)) |
| AI Limits | Browser cookies, alarm | Per-instance only; says to disconnect before switching accounts | Stops | May open **one inactive temporary tab**, wait 10–30 s, close only that tab; used only for Connect and manual refresh |
| Claude Usage Tracker (macOS) | Per-profile `sessionKey` + org id; embedded-browser sign-in; Keychain | Yes | Not stated; keys expire | Warns 24 h before key expiry; re-sign-in is the recovery ([listing](https://sharedcontext.ai/plugins/external/hamed-elfayome/claude-usage-tracker)) |
| Neoo-Blue/ai_usage | In-app browser sign-in per account; session kept in keychain | Yes | Not stated | An *isolated browser context per account* is the pattern. In Chrome the equivalent is a private window |
| UsageX (Firefox) | Intercepts claude.ai fetch responses in the page | Listed; mechanism not verified | Stops | Passive page interception; needs the site open ([listing](https://addons.mozilla.org/en-GB/android/addon/usagex/)) |
| OpenQuota, SessionWatcher, CodeZeno (desktop) | Official CLI logins, one config dir per account | Yes | Own login | Matches your Desktop branch. Claude Code documents `CLAUDE_CONFIG_DIR` per account ([docs](https://code.claude.com/docs/en/authentication)) |
| Your `feature/desktop-independent-accounts` | Official Codex/Claude CLIs, PTY `/usage` scrape | Yes | Own login | Right architecture. All live checks still PENDING; heavy Windows installer |

Your own `docs/COMPETITOR-RESEARCH.md` reached the same conclusion: no product proves "permanent one-time login" for every provider.

---

## 4. Constraints and decisions

### D1 — Anthropic credential policy (decision G1)

Anthropic's Claude Code legal page says developers may not collect, store or intermediate Claude.ai credentials or session tokens, and that sign-in must complete through Anthropic's own flow ([legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). A cookie vault for Claude is therefore a policy risk to your accounts, not just a technical choice.

- Implement the vault generically, but gate it with `src/core/vault-policy.ts` (Phase 3). Ship `chatgpt: 'experimental'` and `claude: 'off'`.
- Flipping Claude on is a human decision at G1 after reading that page.
- OpenAI's consumer terms also deserve a read before you publish anything. This plan is for your own accounts on your own machine.

### D2 — Your own privacy promise changes

`docs/ARCHITECTURE.md` says the extension "does not store passwords, copied cookies or refresh tokens". The vault stores encrypted session cookies. Therefore:

- It is opt-in, per account, with a consent checkbox.
- It is never exported, synced or logged.
- `docs/PRIVACY.md` and `ARCHITECTURE.md` are updated in Phase 4.

### D3 — Logout semantics are unknown

Whether a copied session survives a logout *elsewhere* depends on the provider's server. The design avoids the problem by never reusing the browser's login (private-window capture). E4 tests whether that is enough.

### D4 — MV3 facts (checked against Chrome docs)

- DNR session rules live in memory and are cleared on browser restart and extension update, so reinstall them at service-worker start. `tabIds` is supported only on session rules, and `TAB_ID_NONE` (-1) matches requests not tied to a tab. Whether that includes service-worker fetches is **VERIFY (E3)**. Limit is 5000 session rules ([DNR reference](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)).
- `modifyHeaders` restricts only the *append* operation to an allowlist, and `cookie` is on it. The docs do not state restrictions for `set` on `cookie`, `origin`, `referer`. **VERIFY (E3).**
- `chrome.cookies` needs the `cookies` permission plus host permissions. `getAll` accepts `storeId`, and `getAllCookieStores` lists stores (incognito has its own). `onChanged` reports a `cause` (`explicit`, `overwrite`, `expired`, `expired_overwrite`, `evicted`). Partitioned cookies need a `partitionKey` ([cookies reference](https://developer.chrome.com/docs/extensions/reference/api/cookies)).
- A service-worker `fetch` cannot set `Cookie`, `Origin`, `Referer` or any `Sec-*` header itself.
- **[R2]** `tabIds:[-1]` also matches the *provider site's own* service worker and any other tab-less request to that host, not just MyLimits. Every vault/normaliser rule must add `initiatorDomains: [browser.runtime.id]`. Whether Chrome matches an extension initiator this way is **VERIFY (E3)**.
- **[R2]** With `credentials:'omit'`, any `Set-Cookie` in the response is discarded. A vault copy never renews itself unless T4.2 captures rotation.
- **[R2]** Once "Allow in Incognito" is on, `tabs.query`, `tabs.onUpdated` and `cookies.onChanged` all include incognito tabs and stores. Every existing call site must filter them (T1.2, T1.5).

### D5 — Non-goals

- No cloud collectors, no remote browser, no password handling.
- No fake "keep-alive" requests that spend quota.
- No claim of permanent tracking. Expired sessions show a clear one-click **Re-sign-in**.

---

## 5. Target design

### 5.1 Connection sources

```text
ConnectionRecord.kind
  website  → id "website:<provider>"        credential = browser cookie jar (existing, "browser login")
  vault    → id "vault:<provider>:<slot>"   credential = encrypted session captured via private sign-in (new)
  companion→ existing OpenAI companion      credential = Codex App Server profile
  independent-local → reserved for the Desktop branch's Claude/OpenAI profiles
```

`readAccountProvider(provider, options, read)` in `reader.ts` is already transport-injected (`ReadJSON`). New sources only need a different `ReadJSON`.

### 5.2 Independent session via private window (the key idea)

A *new login should create a new server-side session*, separate from the one in your normal profile, so signing out of the normal profile should not end it. **VERIFY (E4)** — this is the assumption the whole of Phase 3 rests on. The steps:

1. User clicks **Add account → Private sign-in**.
2. MyLimits opens an **incognito window** at the provider's login page. This needs the one-time "Allow in Incognito" toggle. Check with `browser.extension.isAllowedIncognitoAccess()`.
3. User signs in as account B in that window.
4. MyLimits finds the incognito cookie store (`cookies.getAllCookieStores`, the store whose `tabIds` contain the window's tab) and reads **only** the provider's allowlisted cookies from it.
5. MyLimits verifies them with one vault read (§5.4) that sends **no browser cookies**, shows the detected account, and asks for a nickname.
6. On confirm it encrypts and stores the cookies, then **closes the window without signing out**.

The main browser is never touched, and account A can stay logged in or out.

**[R2] Private sign-in is offered for every account, including the first.** If account A stays on browser login, logging out of A in the browser still stops A's tracking (scenario 2), which is the original complaint. So:
- the method chooser (T3.6) defaults to Private sign-in for the first account too;
- browser login becomes the fallback.

Rejected alternatives:

- Keeping a hidden incognito window open forever: it dies on browser restart.
- Swapping cookies in the main jar: it logs the user out of the page they are looking at.
- Own OAuth flow via `launchWebAuthFlow`: it would mean reusing the official CLIs' OAuth client IDs, which is the third-party credential handling D1 warns about.

### 5.3 Vault

- Key `mylimits:vault:v1` in `browser.storage.local`, separate from `mylimits:state:v2`. `controller.ts:337` already sets `TRUSTED_CONTEXTS` access so content scripts cannot read it.
- Value `{ version:1, entries:{ [slot]: { provider, capturedAt, notAfter|null, cookieNames[], nonce, ciphertext } } }`.
- Payload encrypted with AES-GCM-256. The CryptoKey is generated **non-extractable** and kept in IndexedDB (`mylimits-vault-key`). Use `additionalData = slot|provider`.
- Honest limit: this stops casual reading of the storage file and accidental export. It does not stop malware running as you, or someone who copies the whole profile.
- Payload: `{ v:1, origin, cookies:[{name,value,expirationDate?}] }`. Only the cookies in a per-provider allowlist (§6 T3.1), capped at 4 KB total.
- **[R2] Cap correction: use 16 KB, not 4 KB.** ChatGPT's NextAuth session token is split into `.0`, `.1` … chunks of about 4 KB each, so 4 KB would reject every ChatGPT capture. Keep a cap, at 16 KB.
- **[R2]** If E7 passes, the payload also holds `{ accessToken, accessTokenExp }` for ChatGPT (see T3.5).

### 5.4 Vault transport (no browser cookies involved)

```ts
// per-host mutex → one DNR session rule alive per request → fetch with credentials:'omit'
addRules: [{
  id, priority: 2,
  action: { type: 'modifyHeaders', requestHeaders: [
    { header: 'cookie',  operation: 'set', value: cookieHeader },
    { header: 'origin',  operation: 'set', value: origin },
    { header: 'referer', operation: 'set', value: origin + '/' } ] },
  condition: { requestDomains: [host], resourceTypes: ['xmlhttprequest'], tabIds: [-1] },
}]
// fetch(url, { credentials: 'omit', redirect: 'error', headers, signal })
// finally: removeRuleIds: [id]
```

The rule exists only for the duration of one fetch and matches only extension-originated requests to one host. After a service-worker crash, remove stale rules at start (`getSessionRules`, delete the vault id range).

**[R2] Required changes to the rule above:**

```ts
condition: { requestDomains: [host], resourceTypes: ['xmlhttprequest'], tabIds: [-1],
             initiatorDomains: [browser.runtime.id] },   // VERIFY E3
```

- **Per-host lock for every transport, not only vault.** While a vault rule is live, an ambient `website:` fetch to the same host from the service worker would receive account B's cookie. The reader's identity re-check would *not* catch this, because both of its reads would return B. `src/platform/host-lock.ts` (T2.3) is therefore taken by the ambient, page, temp-tab and vault transports alike, for exactly one request at a time.
- The T1.4 normaliser rule is long-lived, but it only sets `origin`/`referer`, never `cookie`, so it does not need the lock.

### 5.5 Refresh state machine (replaces "park on auth failure")

```text
success                    → active
401 / signed-out
   cookie present/unknown  → needs-auth, nextRetryAt = capped backoff (5,10,20,40,60 min, then 60)
   cookie absent           → needs-auth, nextRetryAt = null  (wait for cookie-set / tab / manual)
403 / challenge / status 0 → ladder: normalised background fetch → open tab → temporary tab
                             → still failing: soft failure with the same capped backoff
vault, 3 consecutive 401   → needs-auth, nextRetryAt = null; message "Saved sign-in was rejected. Re-sign in."
Bypass reasons (ignore backoff, still obey the 15 s click cooldown): manual, tab, cookie
```

### 5.6 Data model changes (all additive)

- `ConnectionKind` gains `'vault'` (`model.ts:111`, `schema.ts:39`).
- Vault slot UUID reuses `ConnectionRecord.profileId`, which `public.ts:2` already strips from public state.
- `AccountSetup` gains `method?: 'ambient' | 'private'` and `slotId?: string`.
- `Settings` gains `autoRecoverTab?: boolean` (default `true`) and `normalizeHeaders?: boolean` (default `true`). Check `src/core/sync-contracts.ts` that new keys are either allowlisted deliberately or excluded.
- New helpers `src/core/connection-id.ts`: `websiteId(p)`, `vaultId(p, slot)`, `parseConnectionId(id)`.

---

## 6. Tasks

Each task lists files, steps and acceptance criteria. "Test" means a unit test next to the module, registered in `scripts/run-tests.mjs`.

### Phase 0 — Evidence spike (no production behaviour change)

Goal: replace assumptions with measurements. Output is `docs/SESSION-PERSISTENCE-EVIDENCE.md` (template in §7.2). Phases 1 and 2 do not depend on it and may run in parallel.

**T0.1 Diagnostics ring buffer** (`src/platform/diagnostics.ts`, call sites in `adapters.ts`)
- Record per request: provider, path (no query), status, `content-type`, `cf-mitigated` header, `retry-after`, whether page fallback ran, whether a tab was available, session-cookie presence (name list only), time since last success.
- Keep the last 200 entries in `browser.storage.session`. Never store bodies or header values other than the three above.
- Add a "Copy diagnostics" button in the dashboard Settings that copies the redacted JSON.
- Accept: a Claude refresh with no tab open produces entries; no entry contains a token, cookie value or response body.
- **[R2]** Add a field `transport: 'background' | 'page' | 'temp-tab' | 'vault'`. `pageJSON` must also return `content-type` and `cf-mitigated`, so page-fallback entries are as complete as background ones. If `storage.session` is unavailable, fall back to an in-memory array. Test the redaction with a pure helper: an entry built from a fake response that carries a `set-cookie` header and a token-like body contains neither.

**T0.2 Spike page** (`entrypoints/spike/index.html` + `main.ts`)
- Built only when `MYLIMITS_SPIKE=1`. Use a WXT `entrypoints:resolved` hook, or an equivalent, to drop the entrypoint otherwise. In the same condition add `cookies`, `declarativeNetRequestWithHostAccess`, `webRequest` to the manifest permissions.
- Add a check in `scripts/check-packages.mjs` that release ZIPs contain no `spike` file and none of those three permissions.
- Buttons, each printing a result table:
  - **A** list cookie *names + flags* (`httpOnly`, `secure`, `session`, `expirationDate`) for a provider, from the default store and from every store.
  - **B** run each reader endpoint three ways: (1) as today, (2) with DNR Origin/Referer set, (3) via DNR `cookie` set + `credentials:'omit'` using cookies you pass in.
  - **C** decode a ChatGPT access token's `exp` (no value printed) and test the usage call with Bearer only.
  - **D** observe `Set-Cookie` *names* on responses via `webRequest.onHeadersReceived` (non-blocking, `extraHeaders`).
  - **E** private-window capture dry run: report `isAllowedIncognitoAccess`, store ids, cookie names found.
  - **[R2] F** ChatGPT `/backend-api/wham/usage` with only `Authorization: Bearer` and `credentials:'omit'` (no cookies, no DNR). Print the status only.
  - **[R2]** Button B(3) uses the §5.4 [R2] rule with `initiatorDomains`, and prints whether the rule matched (via `getMatchedRules` if available, otherwise by the request's success).
- Accept: `npm run build` (without the flag) produces a package with no spike code; `MYLIMITS_SPIKE=1 npm run build` produces a loadable one.

**T0.3 Experiments.** A human runs these on their own test accounts (§7.1). The agent does not run live provider traffic.

**Gate G0.** Fill §7.3 and stop. Decision rules:

| Result | Consequence |
| --- | --- |
| E2(b) removes the 403s | Ship header normalisation (T1.4) as the primary fix; temporary tab stays as backup |
| E2 does not help | Temporary tab becomes the primary recovery path |
| E3 fails (DNR cannot set `cookie`, or `tabIds:[-1]` misses service-worker fetches) | **Cancel Phase 3.** Independent accounts use the Desktop route only |
| E4 passes for provider X | Phase 3 proceeds for X |
| E4 fails for provider X | Phase 3 is cancelled for X. Document "logging out ends tracking" for X and point to the Desktop route |
| E5/E6 show short or rolling sessions | Do T4.1 / T4.2 respectively |
| **[R2]** `initiatorDomains:[runtime.id]` does not match (E3) | Find another way to scope the rule to MyLimits only. If none exists, cancel Phase 3: an unscoped cookie rule is unsafe |
| **[R2]** E6 shows the session cookie is rotated **and** old values are rejected | T4.2 moves into Phase 3 (same task group as T3.2), not later |
| **[R2]** E7 passes (Bearer-only works) | T3.5 uses Bearer-only for the usage call; DNR cookie only for `/api/auth/session` when the token is near expiry |

### Phase 1 — No-revisit reliability for browser-login connections

All safe, all independent of G0 except T1.4 (benefit measured by E2).

**T1.1 Scheduler: backoff instead of parking** (`src/core/scheduler.ts`, `scheduler.test.ts`)
- Add reasons `'cookie'` and `'idle'` to `RefreshReason`.
- Replace the needs-auth early return with:

```ts
const BYPASS: RefreshReason[] = ['manual', 'tab', 'cookie'];
// after the 15 s click-cooldown check:
if (c.status === 'needs-auth') {
  if (BYPASS.includes(reason)) return true;
  if (c.nextRetryAt === null) return false;   // waiting for a sign-in signal
  return now >= c.nextRetryAt;                // ordinary capped backoff
}
if (c.nextRetryAt !== null && now < c.nextRetryAt) return false; // unchanged for other statuses
```

- Leave `nextRetry` as is (cap 60 min).
- Tests: needs-auth with future `nextRetryAt` → not refreshed on `scheduled`; with past `nextRetryAt` → refreshed; `nextRetryAt = null` → only bypass reasons; non-auth statuses still cannot bypass a persisted provider wait; startup after a long gap refreshes.
- **[R2]** The snippet must replace today's line 5 *and* move the 15 s cooldown above it, so a manual click within 15 s of the last attempt stays blocked even when `needs-auth`. Add that test. List in the handoff report every existing assertion you changed because it encoded the old parking rule.

**T1.2 Cookie signals** (`src/platform/session-cookies.ts`, `controller.ts`, `wxt.config.ts`, `AccountConnect.tsx`)
- Add `cookies` to `optional_permissions`. Request it in the same click as the site permission (`AccountConnect.tsx:36`). Without it everything degrades to backoff-only.
- Session cookie patterns (confirm names with spike button A before relying on them):

```ts
const SESSION: Partial<Record<ProviderId, RegExp[]>> = {
  claude:  [/^sessionKey$/],
  chatgpt: [/^__Secure-next-auth\.session-token(\.\d+)?$/],   // VERIFY
};
export async function sessionCookieState(p: ProviderId): Promise<'present'|'absent'|'unknown'>;
export function listenSessionCookies(onSet: (p: ProviderId) => void): void;
```

- `onChanged` listener: only when `!removed`, cause is `explicit` or `overwrite`, domain matches, debounce 2 s per provider. **Trigger a refresh only when that connection is `needs-auth` or `needs-tab`.** Otherwise a rolling session cookie would cause a refresh loop.
- In `refreshProvider`'s catch: if the error is `signed-out`, set `nextRetryAt = (await sessionCookieState(p)) === 'absent' ? null : nextRetry(...)`.
- Test: pure helper that maps (error, cookie state, failures) → `nextRetryAt`; test the loop guard.
- **[R2] Default store only.** `sessionCookieState` reads, and `listenSessionCookies` reacts to, the default (non-incognito) cookie store only. Ignore any `onChanged` event whose cookie `storeId` is not the default store. Otherwise a private sign-in of account B (T3.3) would trigger a refresh of account A. Add a test: an incognito-store event is ignored.

**T1.3 Classify provider rejections** (`errors.ts`, `adapters.ts`)
- Read `cf-mitigated` and `content-type` on non-OK responses. A 403 with `cf-mitigated: challenge`, or an HTML body on a JSON endpoint, becomes `AdapterError('waiting-for-tab', …, null, 'challenge')`, not `unavailable`.
- Test with fake `Response` objects for each case.
- **[R2]** Check `content-type` **before** calling `.json()` on a 2xx response too. Today an HTML 200 throws inside the `try`, is swallowed, and becomes status 0, which hides the challenge. A 2xx with `text/html` on a JSON endpoint is a `challenge` as well.

**T1.4 Header normalisation for background requests** (`src/platform/request-headers.ts`, `controller.ts`, `wxt.config.ts`)
- Add `declarativeNetRequestWithHostAccess` to `permissions` (no install warning; uses the already optional host permissions).
- Pure builder `normalizeRule(id, provider)` returns a session rule with `requestHeaders` set `origin` and `referer` to the provider's home, condition `{ requestDomains:[host], resourceTypes:['xmlhttprequest'], tabIds:[-1] }`.
- `installNormalizers()` removes and re-adds rules for providers whose host permission is granted. Call it at service-worker start, from `permissions.onAdded`/`onRemoved`, and when `Settings.normalizeHeaders` changes.
- Test the pure builder (host, ids, conditions). The DNR effect itself is verified by E2 and recorded in the evidence file. Do not rely on Playwright's `context.route` to observe DNR-modified headers; check that once by hand rather than assuming.
- If E2 shows no benefit, delete this task's code rather than shipping dead rules.
- **[R2]** Add `initiatorDomains: [browser.runtime.id]` to the condition (§D4 [R2]) so the provider site's own service worker is never rewritten. Because T1.4's value is unproven, implement it **after** G0, not in the first Phase 1 task groups (§11).

**T1.5 Temporary-tab recovery** (`src/platform/bootstrap-tab.ts`, `adapters.ts`)
- Refactor `pageJSON(provider, path, headers, request, tabId?)` to accept an explicit tab.
- Ladder in `readJSON` for status 0/403 and `challenge`: existing open tab → temporary tab (only if `Settings.autoRecoverTab`, session cookie not `absent`, cooldown passed) → soft failure.
- `withTemporaryTab(provider, run)`: `tabs.create({url: home, active:false})`; wait for `status === 'complete'` (≤ 20 s); run; **close only the tab it created** in `finally`. Keep its id in `storage.session`. One at a time per provider.
- Limits: ≥ 30 min between temporary tabs per provider, ≤ 8 per day per provider, persisted counters.
- If `tabs.create` fails (no browser window), treat it as "unavailable" and fall through to backoff.
- Tests, with injected `tabs` fakes: opens one tab, closes it on success and on error; never closes an unrelated tab; respects cooldown and daily cap; skipped when the setting is off or the cookie is absent.
- **[R2] Incognito safety (do this first in the task).** `pageJSON` must use only tabs with `tab.incognito === false`. The `tabs.onUpdated` listener (`controller.ts` ~line 370) must ignore incognito tabs. Without this, enabling "Allow in Incognito" for Phase 3 lets the ambient connection read the incognito account. Test: given a normal and an incognito tab, `pageJSON` picks the normal one, or throws `waiting-for-tab` if only incognito exists.
- **[R2]** Never use the temporary tab for a plain 401 (that means signed out). After `status === 'complete'`, wait about 3 s more for challenge scripts before running. On service-worker start, close any leftover temp tab whose id is recorded in `storage.session`. Keep the counters in `storage.local`, not in `Store`, so they never sync or export. Record `transport: 'temp-tab'` in diagnostics.

**T1.6 Wording and triggers**
- Replace "Open Claude in this browser to refresh its existing session." with "Retrying in the background" while recovery is possible. Keep "Open website to refresh" only when `autoRecoverTab` is off or limits are exhausted (`model.ts:134`, `adapters.ts:13`).
- Add a dashboard Settings switch "Recover without opening the site (briefly opens a background tab)".
- Add `idle` to `permissions`. On `idle.onStateChanged → 'active'`, run `refreshAll(false, 'idle')` so a laptop opened next morning refreshes at once.
- **[R2]** Expect little from `idle`: `chrome.alarms` already fire on wake, and `runtime.onStartup` covers a browser restart. Keep it (cheap), but treat `'idle'` like `'scheduled'` in `shouldRefresh`, so it never bypasses a wait. Decide deliberately whether `autoRecoverTab` / `normalizeHeaders` are in the sync allowlist (`sync-contracts.ts`), and say which in the report.

**Phase 1 done when**
- Unit tests above pass and the previous suite passes (`docs/COMPACT-ACCOUNTS-HANDOFF.md` records 97 core tests and 24 Playwright tests; keep all green, updating only assertions the new behaviour changes).
- Update `docs/ARCHITECTURE.md` ("Authentication rejection pauses scheduled/open retries…" and "no hidden tab") and `README.md` provider boundaries.

### Phase 2 — Multi-connection refactor (behaviour-preserving)

**T2.1 Connection ids** (`src/core/connection-id.ts` + test).

**T2.2 Scope failure handling to one connection** (`engine.ts`, `engine.test.ts`)
- Add `markConnection(store, connectionId, status, message, now)`. It updates that connection only. It sets `providers[p]` only when the connection kind is `website`. It flips only accounts whose *live* source is that connection (use `projectAccounts`).
- Keep `markProvider(store, provider, …)` as a wrapper for `website:<provider>`.
- Test: two connections of one provider, one fails, the other account stays `active`.

**T2.3 Refresh by connection** (`controller.ts`)
- `refreshProvider(p, …)` becomes `refreshConnection(connectionId, manual, reason)`. `refreshProvider` loops over enabled connections of that provider.
- `refreshAll` iterates connections. `RefreshCoordinator` ids become connection ids. Keep concurrency 2. Vault connections of the same host also take the per-host lock (Phase 3).
- `'refresh'` command already accepts `connectionId`; make `handle()` route `vault` kind.
- **[R2] Host lock.** New `src/platform/host-lock.ts`: `withHostLock(host, fn)`, a FIFO mutex per host. Every transport takes it per request (§5.4 [R2]). Tests: two calls for one host run one after the other; calls for different hosts run in parallel; the lock is released when `fn` throws or is aborted.

**T2.4 Pluggable transport** (`adapters.ts`)
- Export `type Transport = (path, headers?, request?) => Promise<unknown>` and `ambientTransport(provider, signal)` (today's `readJSON`).
- `readProvider(provider, options, signal, transport = ambientTransport(provider, signal))`.

**T2.5 Setup generalisation** (`account-setup.ts`, `model.ts`, `schema.ts`, `account-setup.test.ts`)
- `AccountSetup.method` and `slotId`. `setupCandidate` looks up the connection by `method`/`slotId`. Existing `detect`/`another` ambient behaviour is unchanged.

**T2.6 Schema + migration** (`model.ts`, `schema.ts`, `migrations.test.ts`)
- Add the `'vault'` kind. Test that a v2 state saved by 2.2.0 still parses. Test that `toPublicState` never exposes `profileId` for vault connections.

**T2.7 UI** (`src/ui`)
- Show a source badge per connection: "Browser login", "Saved sign-in", "Companion". Account rows keep nickname, meters and reset times unchanged.

**Phase 2 done when** the full suite is green and a new test runs two fake connections of the same provider with independent statuses and snapshots, refreshed concurrently.

### Phase 3 — Independent sessions (vault + private sign-in)

Only after **G0 (E3, E4)** and **G1 (policy)**. Per provider, as allowed by `vault-policy.ts`.

**T3.0 Policy gate** (`src/core/vault-policy.ts`)

```ts
export const VAULT_POLICY: Record<ProviderId, 'off' | 'experimental'> = {
  chatgpt: 'experimental', claude: 'off', gemini: 'off', grok: 'off', perplexity: 'off', cursor: 'off',
};
```

The UI hides vault options for `off` providers and explains the alternative (Desktop route).

**T3.1 Vault store** (`src/platform/vault.ts`, `vault.test.ts`)
- API: `putVault(slot, provider, payload)`, `getVault(slot)`, `deleteVault(slot)`, `listVault()`.
- Per-provider cookie allowlist, filled from spike button A. ChatGPT needs the session token chunks plus whatever E3 shows is required. Include challenge cookies (`cf_clearance`, `__cf_bm`) only if E3 shows they are needed.
- Zod-validate on read. Inject the key store so tests run in Node, which has no IndexedDB.
- Tests: round trip; wrong slot or provider fails to decrypt (AAD); tampered ciphertext rejected; payload over the cap rejected.
- **[R2]** Cap is 16 KB (§5.3 [R2]). Add a test that a payload with two 4 KB session-token chunks is accepted.

**T3.2 Vault transport** (`src/platform/vault-transport.ts`, test)
- Implements §5.4. Per-host mutex. Remove the rule in `finally`. At service-worker start remove stale rules in the vault id range.
- Skip expired cookies when building the header. Never log the header.
- Tests with a fake `declarativeNetRequest`: rule added with exact host and `tabIds:[-1]`; removed on success, on error and on abort; concurrent calls for one host serialise.
- **[R2]** Rule includes `initiatorDomains: [browser.runtime.id]` (test asserts it). Uses `withHostLock` from T2.3. Test: an ambient call and a vault call to the same host never overlap.

**T3.3 Private sign-in flow** (`src/platform/private-signin.ts`, new commands in `messages.ts`/`handle()`)
- Commands: `vault-signin-start`, `vault-signin-save`, `vault-signin-cancel` (zod-validated, dashboard-only sender, like `account-setup-*`).
- Start: check `isAllowedIncognitoAccess()`. If false, return a typed error the UI turns into the "Allow in Incognito" instructions. Otherwise create the incognito window and find its store.
- While waiting (timeout 10 min): watch `cookies.onChanged` **filtered to that `storeId`** for the provider's session cookie. Read cookies only from that store.
- On cookie: capture the allowlist, create a `vault` connection and a pending `AccountSetup{method:'private',slotId}`, and run one vault read. Show the detected account (`setupCandidate`), nickname, consent checkbox, **Save**.
- On save: encrypt and persist, mark the connection enabled, close the window. **Never navigate to or call a logout endpoint.** On cancel or timeout: delete the pending slot and close the window.
- Test with injected fakes for `windows`, `cookies`, `extension`: no read from any other store; cancel leaves no vault entry; timeout cleans up; save requires the consent flag.

**T3.4 Fallback capture without incognito** (same module)
- If incognito is unavailable (blocked by policy, or the user declines "Allow in Incognito"; **[R2]** Brave and Edge do have private windows, so detect, don't assume by browser name), offer "Save current login". It copies from the default store and states plainly that **signing out of the website will probably end this connection**. This is the weaker mode; label it so in the UI.

**T3.5 Wire into refresh** (`controller.ts`)
- `refreshConnection` for `kind: 'vault'` uses `vaultTransport`. The reader's identity recheck stays; for vault connections you may skip the second `/api/account` call (`reader.ts:28`) since the credential cannot change identity. That saves one of Claude's four requests per refresh.
- Three consecutive 401s → `needs-auth` with `nextRetryAt = null` and a re-sign-in message. A 403 challenge on a vault read does **not** use the tab ladder, because the browser jar is a different account. Mark it soft-failed with backoff and surface **Re-sign-in**, which re-captures challenge cookies.
- **[R2] ChatGPT with E7 passed:** call `/backend-api/wham/usage` with `Authorization: Bearer` and `credentials:'omit'`, no DNR. Fetch `/api/auth/session` via the DNR cookie rule only when there is no token, or `accessTokenExp` is less than 1 h away; store the new token encrypted. This halves cookie-rule usage and the mixing risk.

**T3.6 UI** (`AccountConnect.tsx`, `OpenAICompanion.tsx` sibling)
- Method chooser: **Private sign-in (recommended)**, **Use current browser login**, **Independent connection** (existing companion).
- Copy to include: "Sign in in the private window, then **close it — do not log out**", "Allow in Incognito" help, and the D2 disclosure.
- Show an "Expires in N days" line when `notAfter` is known.
- **[R2]** Offer Private sign-in for the **first** account of a provider too, and pre-select it (§5.2 [R2]). Allow converting an existing browser-login account to a saved sign-in: run the private flow, and if the detected identity matches, keep the account id and history and switch its live source.

**T3.7 Forget and disconnect**
- `forget` and `disconnect` for a vault connection delete the vault entry and its slot. Test that no key remains in `storage.local` except `mylimits:vault:v1` itself, and no ciphertext remains for that slot.

**T3.8 Secret-leak tests** (new `src/platform/secrets.test.ts`)
- Build a store plus vault with a recognisable fake cookie value. Assert the fake value appears in none of: `toPublicState`, `exportReadings` (json and csv), sync payloads (`sync-contracts.ts`), diagnostics, error messages.

**Phase 3 done when** unit tests pass, Playwright covers the flow against a fake provider (route-stubbed, incognito stubbed through the injected APIs), and §7.1 scenarios 1–6 pass live for each enabled provider. **[R2]** Scenarios 8–10 also pass.

### Phase 4 — Hardening

**T4.1 Expiry watchdog** (needs E5). Compute `notAfter` from the session cookie's `expirationDate`. Daily alarm. Notify 48 h and 24 h before (reuse the existing notification permission and quiet hours). Status text "Sign-in expires in N days". Session cookies without an expiry have `notAfter = null`; rely on 401 detection.

**T4.2 Rotation capture** (only if E6 shows the provider re-issues the session cookie). Use non-blocking `webRequest.onHeadersReceived` with `extraHeaders` for vault requests to read `Set-Cookie` and update the vault entry atomically. Adds the `webRequest` permission, so only do it if the evidence demands it.

**T4.3 Docs.** Update `docs/ARCHITECTURE.md` (state machine, connection kinds), `docs/PRIVACY.md` (vault disclosure, what is and is not protected), `README.md` (provider boundaries, "logout survival per provider"), and add `docs/SESSION-PERSISTENCE.md` summarising the evidence and final behaviour.

**T4.4 Browser coverage.** Smoke test on Chrome, Edge ("InPrivate") and Brave. Record each in the evidence file.

### Phase 5 — Optional

- **Firefox containers.** `contextualIdentities` gives a persistent per-account cookie jar with **no stored secrets**: open a temporary tab with `cookieStoreId`, run the page-context fetch, close it. This is the policy-cleanest multi-account route and works for Claude too. Cost: Firefox-only, temporary-tab polling, so use a longer interval.
- **Reconcile with the Desktop branch** (§9).

---

## 7. Verification

### 7.1 Live experiments and acceptance (human, own test accounts)

Run with the spike build for E1–E8, then with the real build for scenarios 1–7. Record results in the evidence file.

| ID | What to do | What to record |
| --- | --- | --- |
| E1 | Browser open, all provider tabs closed, wait ≥ 12 h (or delete `__cf_bm`/`cf_clearance` to emulate). Trigger a background read | Status, `cf-mitigated`, content type, cookie names present, whether a tab was needed |
| E2 | For every reader endpoint, run variants (1) as today (2) DNR Origin/Referer, with no provider tab open. Include Grok's POST | Status per variant per endpoint |
| E3 | Capture cookies through the spike. Replay with DNR `cookie` + `credentials:'omit'` while the jar has **no** cookies for the site. Then find the minimal cookie subset | Works yes/no; minimal cookie names; whether `tabIds:[-1]` matched; whether user tabs were unaffected |
| E4 | Private-window sign-in as account B (capture S2). In the normal window sign in to the **same** account B, then explicitly **log out**. Replay S2 | S2 works after the normal logout? Then: does S2 survive signing out *inside* the incognito window (informs the "do not log out" copy)? Does "log out everywhere" kill it (expected yes) |
| E5 | Record the cookie `expirationDate` for S2. Replay after 24 h, 72 h, 7 d | Lifetime; whether it is rolling |
| E6 | Observe `Set-Cookie` names on vault reads | Does the session cookie get re-issued? How often? |
| E7 | ChatGPT: decode access-token `exp`; call usage with Bearer only and no cookies | Token lifetime; works without cookies |
| E8 | `isAllowedIncognitoAccess`, store enumeration, window creation on Chrome, Edge, Brave | Per-browser result and any policy block |

| # | Acceptance scenario | Pass condition |
| --- | --- | --- |
| 1 | Account A via browser login, account B via private sign-in, same provider | Both show readings; both update within one interval; different nicknames |
| 2 | Log out of the website in the normal window | A shows "Signed out in browser, retrying" (no error storm). **B keeps updating.** Log back in as A: A recovers with no MyLimits click and no site visit |
| 3 | Close the browser overnight, reopen, never open the provider site | First refresh succeeds on startup or on idle-active; no "open the website" message |
| 4 | Use account B on a phone | Next poll reflects it |
| 5 | Make a vault entry's `notAfter` near | Notification and "expires in N days" status appear; Re-sign-in works |
| 6 | Forget account B | Vault entry deleted; secret-leak test still passes; A untouched |
| 7 | `claude: 'off'` | UI shows no vault option for Claude and points to the Desktop route |
| 8 **[R2]** | Both A and B via private sign-in. Log out of the website in the normal window | **Both** keep updating |
| 9 **[R2]** | "Allow in Incognito" on; an incognito window is signed in as another account; trigger refreshes and sign-ins there | Browser-login account never switches identity; no refresh fires for A from incognito cookie changes |
| 10 **[R2]** | Vault refresh of B and browser-login refresh of A, same provider, forced to run together (two quick manual refreshes) | Each shows its own identity; diagnostics show the two requests did not overlap |

### 7.2 Evidence file template (`docs/SESSION-PERSISTENCE-EVIDENCE.md`)

```md
| Exp | Provider | Browser | Date | Result | Notes (no secrets) |
| --- | --- | --- | --- | --- | --- |
```

### 7.3 Gate report (post this before continuing)

```md
Gate: G0 | G1
Completed experiments: E1 E2 …
Findings: one line each
Recommended branch of the decision table: …
Open risks: …
Question for the human: …
```

---

## 8. Risks and open questions

1. **Server-side revocation (E4).** The biggest unknown. If it fails, Phase 3 is cancelled for that provider and the honest product statement is "tracking ends when you log out".
2. **Provider terms.** Anthropic's text is explicit (D1). Review OpenAI's terms before distributing anything. A hobby build for your own accounts is a different risk from a published product.
3. **Secrets at rest.** If the extension or profile is compromised, stored sessions are exposed. Mitigations: encryption, non-extractable key, no sync/export/logs, minimal allowlist, `TRUSTED_CONTEXTS`.
4. **Edge-bot rules.** Challenge cookies can be bound to IP and user agent. VPN changes may force a re-sign-in.
5. **Undocumented endpoints** can change. Keep the existing fixture-based parser tests.
6. **Browser policy.** Managed Chrome may disable incognito or extension access to it. T3.4 is the weaker fallback.
7. **Temporary tabs** can be visible for seconds. The limits in T1.5 and the setting in T1.6 bound that.
8. **Request volume.** Claude uses 4 requests and ChatGPT 3 per refresh (`docs/COMPACT-ACCOUNTS-HANDOFF.md`). Every added account multiplies that. Consider a longer default interval when more than 3 connections exist.
9. **[R2] Cross-account mixing.** A cookie-setting DNR rule that matches the wrong request could make one account read as another. This is mitigated by `initiatorDomains`, the per-host lock for all transports, and the incognito filters, and tested in scenarios 9–10.
10. **[R2] Stale vault sessions.** `credentials:'omit'` drops `Set-Cookie`, so a rotating session goes stale. Mitigations are T4.2 (pulled into Phase 3 by the G0 rule) and the E7 Bearer-only path.
11. **[R2] Legal note.** The D1 citation covers Claude Code / Agent SDK credentials. The existing ambient reader also calls claude.ai internal endpoints, so policy risk is not limited to the vault. This is not legal advice; read the providers' consumer terms before publishing.

---

## 9. Relationship to your other branches

`feature/desktop-independent-accounts` (last commit 2026-10-23) already gives independent OpenAI and Claude accounts through official CLIs, one config directory per account. Its handoff lists **every live acceptance row as PENDING**, and its Claude reader scrapes a terminal `/usage` panel that can change.

This plan is complementary:

- **Phases 1 and 2 are branch-agnostic.** Land them on `main`, then merge `main` into the Desktop branch. Expect conflicts in `controller.ts`, `engine.ts`, `model.ts`, `schema.ts` and `AccountConnect.tsx`; resolve by keeping `kind: 'independent-local'` and `'companion'` as separate sources behind the same `refreshConnection`.
- **Phase 3 is the lightweight alternative** for ChatGPT: no installer, no 465 MB runtime.
- **For Claude, keep the Desktop route** unless you decide otherwise at G1.

---

## 10. Sources

- Claude Code legal and compliance (credential use): https://code.claude.com/docs/en/legal-and-compliance
- Claude Code authentication (multiple accounts, config directory): https://code.claude.com/docs/en/authentication
- Chrome declarativeNetRequest reference: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- Chrome cookies reference: https://developer.chrome.com/docs/extensions/reference/api/cookies
- AI Limits FAQ: https://github.com/TiantianFlow/ai-limits/blob/main/FAQ.md
- Claude Monitor background script: https://github.com/claude-monitor/claude-monitor-browser-extension/blob/main/extension/background.js
- TokenYou HTTP layer: https://github.com/diegoparras/tokenyou/blob/main/src/lib/http.js
- Claude Usage Tracker listing: https://sharedcontext.ai/plugins/external/hamed-elfayome/claude-usage-tracker
- Neoo-Blue/ai_usage: https://github.com/Neoo-Blue/ai_usage
- Claude in Chrome 403 report: https://claudeissues.com/issue/90590-bug-claude-in-chrome-side-panel-cowork-mode-get-api-bootstrap-returns-403-from-e
- UsageX listing: https://addons.mozilla.org/en-GB/android/addon/usagex/
- In your repo: `docs/COMPETITOR-RESEARCH.md`, `docs/HOSTED-FEASIBILITY.md`, `docs/ARCHITECTURE.md`; on `feature/desktop-independent-accounts`: `docs/DESKTOP-ACCOUNTS-HANDOFF.md`, `docs/ACCOUNT-PROOF.md`

---

## 11. [R2] Execution plan for Codex

The human runs Codex one task group at a time. Each group is small enough to finish, test and review in one sitting.

### 11.1 Task groups

| Id | Contents | Needs before start | Reasoning effort |
| --- | --- | --- | --- |
| C0 | Add this file as `docs/PERSISTENT-ACCOUNTS-PLAN.md` and `AGENTS.md` (§11.4) | — | low |
| C1 | T0.1 diagnostics | C0 merged | medium |
| C2 | T1.1 scheduler | C1 | medium |
| C3 | T1.3 classification + T1.2 cookie signals | C2 | medium |
| C4 | T1.5 temp tab (incognito safety first) + T1.6 wording/settings + Phase 1 docs | C3 | high |
| **Checkpoint A** | Human merges `feat/persistent-accounts` → `main`, uses it 3–4 days, keeps diagnostics of any failure | — | — |
| C5 | Phase 2: T2.1–T2.7 incl. host lock | Checkpoint A | high |
| **Checkpoint B** | Human merges to `main` again | — | — |
| C6 | T0.2 spike page (+ [R2] button F and `initiatorDomains` check) | C5 | medium |
| Human | Run E1–E8 (§7.1) with the spike build, fill `docs/SESSION-PERSISTENCE-EVIDENCE.md` | C6 | — |
| C7 | Write the G0 gate report (§7.3) from the evidence file and the decision table; change no code | evidence file | medium |
| C8 | T1.4 header normalisation, **only if** E2 showed benefit | G0 | medium |
| Human | G1: decide the per-provider vault policy | G0 | — |
| C9 | T3.0 + T3.1 + T3.2 (+ T4.2 if the G0 rule moved it here) | G0 + G1 | high |
| C10 | T3.3 + T3.4 + T3.5 | C9 | high |
| C11 | T3.6 + T3.7 + T3.8 | C10 | high |
| C12 | T4.1 + T4.3 (T4.4 is human) | C11 | medium |
| C13 | Phase 5, optional | any time after C5 | high |

If G0 cancels Phase 3, skip C9–C12 and do only T4.3 (document the outcome).

### 11.2 Prompts

**C0 (attach this file to the task):**

```text
Add the attached file to the repo as docs/PERSISTENT-ACCOUNTS-PLAN.md, unchanged.
Create AGENTS.md at the repo root with exactly the markdown inside the code block of
§11.4 of that file (without the surrounding fences). Commit on a branch codex/c0-setup
from main and open a PR into main. Change nothing else.
```

After merging C0, create `feat/persistent-accounts` from `main` on GitHub (branch dropdown → type the name → Create).

**C1–C13 (same template; change the id):**

```text
Read AGENTS.md and docs/PERSISTENT-ACCOUNTS-PLAN.md, including every [R2] note.
Implement task group C<N> from §11.1 only.
Branch codex/c<N> from the latest feat/persistent-accounts; open the PR into feat/persistent-accounts.
Follow each task's steps, tests and acceptance criteria. Do not start the next group.
Write the handoff report from §11.3 as the PR description.
If the plan contradicts the code, stop and explain instead of guessing.
```

**C7 (attach your filled evidence file if it is not committed):**

```text
Read docs/PERSISTENT-ACCOUNTS-PLAN.md §6 Gate G0 and docs/SESSION-PERSISTENCE-EVIDENCE.md.
Write the G0 gate report in the §7.3 format, apply the decision table (including the [R2] rows),
and list which of C8–C12 should run and with what changes. Do not change any code.
```

**Fix-up (reply in the same task, never a new one):**

```text
Manual test failed: <what you did> → <what you saw>.
Diagnostics: <paste the Copy diagnostics JSON, or the relevant entries>.
Fix this on the same branch and update the handoff report.
```

### 11.3 Handoff report (PR description)

```md
## Summary
## Files changed
## Tests added
## `npm run check` result (pass/fail counts) and `npm run test:browser` result
## Existing assertions changed, and why
## Assumptions / unverified browser behaviour
## Manual test steps (exact clicks)
## Known limitations
```

### 11.4 `AGENTS.md`

```md
# Agent rules for MyLimits

Plan: docs/PERSISTENT-ACCOUNTS-PLAN.md. Follow §0 rules 1–12 and every [R2] note.

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
```

### 11.5 Local testing on Windows 11 (human)

One-time setup (PowerShell):

```powershell
node -v                       # 24 or newer
git clone https://github.com/voiddev011/mylimits.git
cd mylimits
npm ci
npx playwright install chromium
```

For each PR:

```powershell
git fetch origin
git switch codex/c<N>
npm ci                        # only if package-lock.json changed
npm run check
npm run test:browser
npm run build                 # output folder: .output\chrome-mv3
```

Loading the build:
1. Open `chrome://extensions` and turn on Developer mode.
2. The first time, choose **Load unpacked** → `.output\chrome-mv3`. After later builds, press the reload icon on the MyLimits card; stored data stays.
3. Background logs: click **service worker** on the card.

Use a separate Chrome profile for testing.

| Group | Manual check | Pass |
| --- | --- | --- |
| C1 | Refresh, then Copy diagnostics into Notepad | Entries per request; no token, cookie value or body |
| C2 | Log out of ChatGPT, click Refresh once. Log back in, close the tab, wait ≤ 60 min without touching MyLimits | Reading returns by itself |
| C3 | Same, but watch MyLimits right after signing back in | Recovers within ~10 s. Also try with the cookies permission denied: still recovers via backoff |
| C4 | Open chatgpt.com → F12 → Application → Cookies → delete only `__cf_bm` and `cf_clearance`. Close the tab. Refresh in MyLimits | Reading updates; a background tab may appear briefly and close; diagnostics show `temp-tab` |
| C4 | Real overnight test: close Chrome at night, reopen in the morning, open only the MyLimits popup | No "Open website to refresh" |
| C4 | Allow MyLimits in Incognito; sign in to another account in an incognito window | Main account never switches (scenario 9) |
| C5 | Repeat C2–C4 | Behaves exactly as before |
| C6 | `$env:MYLIMITS_SPIKE="1"; npm run build`, then a normal `npm run build` | Spike page works in the first; absent from the second |
| C9–C11 | §7.1 scenarios 1–10 | All pass for each enabled provider |
