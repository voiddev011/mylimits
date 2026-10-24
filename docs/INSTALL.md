# Install and update

In your existing repository (Node 24+):

```powershell
git fetch origin
git switch codex/u1-simplify
git pull --ff-only
npm ci
npm run build
```

Open brave://extensions or chrome://extensions and reload the existing unpacked extension. Its folder is `<repository>/.output/chrome-mv3`. First installation: enable Developer mode, Load unpacked and select that folder. Keep the same folder/extension entry when updating.

Click + → choose a provider → Use current browser login; sign in to that website if needed, then Check account and Save detected account. Preferences, Website access, Help & updates and History remain in the full dashboard. Private sign-in is shown only for an approved enabled vault provider; all current policies are off.

U1's first load deletes retired accounts/readings and preserves the remaining website accounts, aliases, preferences and history. Do not install this cleanup build over data you intend to keep for retired features; use your existing browser-profile backup. Code remains archived on archive/pre-simplify.

## C6 evidence spike (test accounts only)

C6 is a separate diagnostic extension build for your own experiments, not the
independent-account feature. It never starts normal automatic tracking, writes
account state, or saves captured credentials. Use a **separate test browser profile**.

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
npm ci --include=optional
npm run build:spike
```

Load `<repository>\.output-spike\chrome-mv3` in that test profile. It has a
different extension ID from the normal output folder. Click its toolbar icon
(it opens a persistent tab), or Details → Extension options, to open the evidence page. Required cookie/DNR/
webRequest permissions apply only to this diagnostic build. Site access is still
requested per provider when you click a test. The C6 spike supports Chromium
(Chrome/Edge/Brave); ordinary Firefox builds remain supported.

Equivalent direct flag: `$env:MYLIMITS_SPIKE="1"; npm run build`, then
`Remove-Item Env:MYLIMITS_SPIKE`. The output is still `.output-spike`, separate
from the normal `.output`. `npm run build` without the flag excludes spike files,
runtime listener and required diagnostic permissions. Normal builds retain C3's
existing optional cookie permission for sign-in-change detection.

1. **A:** choose the provider → List cookie metadata. It shows normal/all stores
   and names/flags, never values. Select names from one store, choose that capture
   store, tick explicit consent, then Capture selected names in memory. Begin with
   the names you found; use E3 to identify a minimal subset. No manual token input.
2. **D:** optionally start response-name observation before B/C. It watches only
   extension worker requests to that provider's reader paths, stops after 60s,
   and prints names only. Read/stop it when finished.
3. **B:** close provider tabs for E2, then Compare three transports. It runs the
   current background/existing-page reader, Origin/Referer rules, then captured
   replay with browser credentials omitted. Each variant can make several usage
   reads. Status 0 means a failed request, not HTTP success. Respect retry waits;
   a 429 stops later requests. C4 automatic temporary tabs are disabled in this
   diagnostic comparison so they do not confound the no-tab experiment.
4. **E3:** in this disposable profile, capture first; then clear the site's browser
   cookies through browser developer tools (not provider logout) and replay B.
   Record statuses, selected cookie names, rule-feedback availability, and whether
   unrelated provider tabs stayed unaffected. Success alone cannot establish the
   extension-initiator match. Do not remove initiatorDomains/tabIds to force a pass.
5. **E:** enable Allow in Incognito in extension details. Close other private
   windows in this test profile before Open private dry run. Sign into your test
   account yourself; Inspect private stores, then use A to capture selected names
   from that specific store. Close owned private window without signing out.
   For E4, sign into the same test account in the normal test window and log out
   there, then replay. Record private logout and global revocation separately.
6. **C/F:** ChatGPT only. C obtains a transient session token from the chosen
   current/captured source, decodes only exp and tests usage with Bearer alone.
   F uses that in-memory token for one usage request with credentials omitted and
   no DNR rule, printing only status. Expiry decoding is not token verification.
7. **Copy sanitized results**, then add live findings to
   [the evidence ledger](SESSION-PERSISTENCE-EVIDENCE.md). Keep E1–E8 separate by
   provider/browser/version/date. For E5, losing the in-memory capture ends that
   original-session trial; recapturing cannot prove its lifetime.
8. **Clear captured state and results** or close the page when finished. Captures
   are not durable across page disconnect/worker/browser restart. Only owned
   private windows are closed; no logout endpoint or cookie deletion is automated.

If rule cleanup or cooldown storage fails, stop testing and reload the diagnostic
extension; do not loosen scoping or clear provider waits. A reconnect may lose
capture data and requires a new explicit capture.

`npm run test:spike` runs the separate simulated Chromium suite, restores normal
generated types, and never contacts providers. `npm run zip:spike` writes a
clearly separate `*-spike.zip` under `.output-spike`; Actions publishes it as
`mylimits-evidence-spike-not-for-release`. Ordinary release ZIPs are checked for
spike files/runtime/required permissions. Live evidence and approval remain pending.
