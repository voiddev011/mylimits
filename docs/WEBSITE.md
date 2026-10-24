# MyLimits website (P1)

The buildless website is in `site/`. Open `site/index.html` directly, or serve
that directory with a static HTTP server. It uses system fonts, relative links,
plain HTML/CSS and one small configuration script; there is no analytics.
The hero is a clearly labeled HTML illustration with fictional readings.

## Store links

Edit only the three values in `site/assets/config.js` after the listings are
published. Empty / invalid / non-HTTPS URLs leave the corresponding link
disabled with “Coming soon”. Page content and beta downloads work without JS.

## Pages setup and deployment

Expected production URL: **https://voiddev011.github.io/mylimits/**.
It becomes live after this PR is merged and the first Pages deployment succeeds.

1. Open the repository → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
   Do not create another suggested workflow; this PR supplies `pages.yml`.
3. Merge the P1 PR into **main**. Its `site/**` changes trigger deployment.
4. Open **Actions** → **Deploy website to GitHub Pages** → the latest run.
   Check the deployment job, then open its **github-pages** environment URL.
5. For a manual deployment after setup, choose **Run workflow** → branch
   **main** → **Run workflow**. Automatic runs occur only on pushes to main
   touching `site/**`, as requested. Workflow-only edits need a manual run.

The workflow uploads only `site/` with the official Pages actions and uses
an environment with Pages / OIDC permissions. No extension build is needed.
See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Releases

After merging, push a version tag matching `package.json`, for example `v3.4.0`
(only if that tag is unused). `release.yml` runs `npm ci`, `npm run check`,
`npm run zip`, and `npm run zip:firefox` on Node 24. Only the exact normal
Chrome / Firefox filenames are copied to release assets; spike entries are
rejected. A separate write-enabled job creates a GitHub Release with generated
notes or attaches the files to an existing release on rerun. It never builds or
uploads `.output-spike`. The beta link opens `/releases/latest` so users can
choose the appropriate ZIP. No tag is created as part of P1.

## Verification and content maintenance

Run `npm run check`, `npx playwright install chromium`, then
`npm run test:browser`. `tests/browser/site.spec.ts` uses a local server under
`/mylimits/` to check all pages at 360 / 1280 px in both color schemes, links,
unexpected network traffic, store configuration and no-JS behavior. It is
automatically discovered by the existing Playwright configuration. Preview
screenshots are written to ignored `artifacts/`.

Update the dated privacy notice when permissions or storage / network behavior
change. It was checked against `wxt.config.ts`, `src/core/vault-policy.ts`,
`src/platform/{repository,history,session-cookies,bootstrap-tab,vault,vault-key-store,saved-sessions,sync,companion}.ts`,
the provider catalog and `docs/PRIVACY.md` on 24 October 2026. All production
vault providers are currently disabled. Optional sync and Desktop are disclosed
separately from default browser tracking. GitHub Copilot is labeled coming soon
because the current provider catalog has no Copilot reader.
