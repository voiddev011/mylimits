# Platforms

Chrome and Brave use `.output/chrome-mv3`; Edge uses `.output/edge-mv3`; Firefox uses `.output/firefox-mv3`. Firefox has a sidebar and no Chromium sidePanel grant. Saved-sign-in choices remain disabled on all normal builds; the evidence spike supports Chromium only.

Source builds use Node 24+ and npm. Run `npm ci`, `npm run check`, then `npm run test:browser`. Chromium is installed with `npx playwright install chromium`. Variants: `npm run build:edge`, `npm run build:firefox`. Archives: `npm run zip`, `npm run zip:firefox`; inspect with `node scripts/check-packages.mjs` and `python scripts/check-archives.py`.

Required normal permissions: storage, alarms, scripting, idle; Chromium also sidePanel. Optional: notifications and cookies. Optional hosts: claude.ai, chatgpt.com, cursor.com and api.github.com. No required provider host access. The separate spike additionally requires cookies, declarativeNetRequestWithHostAccess and webRequest for its explicit experiments.

Copilot tokens require trusted-context storage protection; unsupported browsers fail closed. Firefox token setup is unverified.

Actual Chrome/Brave/Edge/Firefox provider authentication and logout behavior remain unverified by automated fixtures.
