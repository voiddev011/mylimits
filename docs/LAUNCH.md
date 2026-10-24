# Launch MyLimits

## Install or share a beta immediately

From the repository on Node 24+:

```powershell
git fetch origin --prune
git switch main
git pull --ff-only origin main
npm ci --include=optional
npm run zip
```

Output: **`.output/mylimits-3.4.0-chrome.zip`**. Share this ZIP directly with testers.
They extract it, open Chrome/Brave's Extensions page, enable Developer mode and
choose **Load unpacked** → the extracted folder containing `manifest.json`.
[Exact installation steps](INSTALL.md). These installations do not auto-update.

This is immediate manual beta distribution, not a browser-store installation.
The repository is private, so its Releases link is not a public download URL.
No native app setup is needed. Never distribute `.output-spike` or a spike ZIP.

## Publish to Chrome Web Store

1. Open the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   Register the developer account, pay its one-time registration fee, enable
   2-Step Verification and complete the account/contact requirements shown there.
2. Choose **Add new item** and upload the normal Chrome ZIP above.
3. Add the name, accurate description, category, required icons/screenshots and
   contact/support information. Use screenshots of the actual extension; mark
   fictional/sample data clearly. Existing History images are in
   `tests/browser/screenshots/`; verify dashboard asset size requirements.
4. Complete the Privacy tab: single purpose, actual data practices, permission
   justifications and any review/testing instructions. Account/usage data and
   provider authentication access must be described accurately. Do not claim no
   data handling simply because storage is local. Never publish live credentials.
5. Supply a **publicly accessible privacy-policy URL and public support/help URL**.
   This private repo's Markdown/issues links are not public help pages. Host
   `site/privacy.html` and the setup/help content publicly before submitting;
   update the extension/site support links to those real public URLs.
6. Choose public visibility and **Submit for review**. Enable automatic publication
   after approval, or publish manually after approval. Store review is required;
   no instant approval or fixed review duration is promised.

Google's official instructions:
[registration](https://developer.chrome.com/docs/webstore/register),
[publishing](https://developer.chrome.com/docs/webstore/publish),
[review](https://developer.chrome.com/docs/webstore/review-process).

## Actual launch readiness

- Packaging, automated checks and the current website code are implemented.
- The repo is private and GitHub Pages is disabled. Public privacy/help hosting,
  live support URLs and store account/listing assets are operator setup, not done
  by producing a ZIP. Do not change repo visibility just to publish an extension.
- Run real-account smoke checks for every provider advertised in the listing.
  Copilot real-token acceptance remains pending; see [COPILOT.md](COPILOT.md).
- Saved ChatGPT sign-in is **experimental on Chromium**; Claude and other saved
  sign-ins, and Firefox saved sign-in, remain disabled. Fixture tests do not prove
  live session acceptance or survival after logout. Website account switching remembers last readings; it does not refresh
  every logged-out account. Codex buckets do not represent all ChatGPT limits.
- If the current version number already exists in your store listing, increase
  package.json, package-lock.json and the manifest version consistently before
  creating its next ZIP. Never reuse a published store version for a new upload.

Suggested single purpose: “Show available AI usage limits and reset times for
accounts the user connects, with local history and optional alerts.”

## Other distribution channels

- Chrome/Brave: Chrome Web Store listing or the manual beta ZIP.
- Edge: submit the browser package through the Microsoft Edge Add-ons developer
  dashboard; approval is a separate process.
- Firefox: `npm run zip:firefox`, then Mozilla Add-on Developer Hub submission for
  signing/listing. Temporary local installation does not replace signing.
- Optional GitHub release: use an unused version tag matching package.json only
  when authorized. The existing workflow builds the two normal ZIPs; private
  releases still require repository access. No release is created by this cleanup.
