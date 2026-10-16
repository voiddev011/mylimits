# MyLimits 3.0 implementation plan

Authorized 16 October 2026. Branch: `v3/redesign`. Baseline: MyLimits 2.2.
One workstream, no parallel agents. Preserve account IDs, history and preferences.
All maintained Markdown stays directly in docs/.

## Contracts

- No Guide tab, task guidance or prompt tools in the shipped product.
- Dashboard has Overview, Accounts, History, Settings; popup is quick limits only.
- Genuine packaged provider assets; no runtime logo CDN or copied competitor UI.
- Dashboard body 16px, secondary 14px, section headings 20px; popup names 14px,
  values 16px, supporting labels 12px. Standard/Large preference persists.
- Optional floating launcher opens only a Coming soon preview, never reads text,
  prompts, selections, account readings or conversations. Explicit exact-site
  grants, persistent hide, corner movement, Escape/outside-click close, no auto-open.
- Keep browser login versus independent connections explicit. No universal quotas,
  fresh values inferred from resets, hosted grants or live/logout claims.
- Existing native profiles remain optional; basic tracking needs no helper.

## Ordered work packages

1. **V3-01 Foundation**: inspect instructions, preserve baseline, create plan and
   checkpoints; remove Guide runtime/core/tests, redirect old hash, package provider
   logos with provenance. Build coherent type/spacing/color primitives.
2. **V3-02 Dashboard and popup**: four dashboard destinations, full-width readable
   sections, primary actions, account details, compact 440px popup, large text
   option, controlled overflow, meaningful states, local reset clock details.
3. **V3-03 Preview and privacy**: replace the old on-page quota panel with the
   optional launcher; preserve opt-in site/corner preferences; no account needed;
   privacy mode masks identities consistently; local redacted diagnostics and
   version/help controls in Settings.
4. **V3-04 Account connections**: move setup into the dashboard, remove misleading
   independent-sign-in actions, make optional OpenAI profile management clearer,
   validate identity/duplicates and improve native packaging to bundle prerequisites.
   Independent Claude requires a permitted, reliable live-proven path; unavailable
   provider access is recorded, never represented by an enabled placeholder.
5. **V3-05 Verification and delivery**: migrations, types/core/native/browser checks,
   popup/DPI-layout/zoom/keyboard/hostile-page fixtures, actual packaged variants and
   clean archive checks. Screenshots, setup docs, V3-HANDOFF and branch publication.
   Store publication and real desktop/provider acceptance remain separate actions.

## Acceptance

- Existing names, readings, pinned meters and alert preferences survive upgrade.
- Guide is absent from UI and bundle; old links land on Overview.
- All enabled services show genuine local assets, in light and dark themes.
- Dashboard text does not reuse popup microtype. Long names/narrow windows and
  200% enlargement preserve controls and content; text-size changes survive reload.
- Popup retains quick scan and fixed footer; larger account sets scroll inside.
- Preview is absent until enabled; can be enabled without signing in to a service;
  its messages carry no account data; hide/position/close work and survive restart.
- Privacy mode masks names in overview, account details, history, popup, tooltips
  and notification copy, without overwriting stored aliases.
- Diagnostics contain version, generic source health and granted capability only;
  no credentials, URLs with query tokens, raw identities, names, paths or history.
- Independent connection additions verify profile ownership, preserve existing
  logins and do not silently create duplicate accounts. Real renewal/logout tests
  remain explicitly pending until provider-owned access is available.
- Windows connector distribution should bundle runtime/Codex so users do not need
  terminal installation. Reproducible pinned assets/checksums, platform packaging
  checks and actual unsigned compiler output are required before declaring built.

## Evidence informing the design

Research and proposed decisions are in the preceding user discussion. Primary
references: NN/g progressive disclosure/glanceable typography; W3C WCAG 2.2 resize,
contrast and target-size guidance; QuillBot site controls/Brave close-button help;
CodexBar account-switch/cached-reading issues and managed-account documentation;
OpenAI Sign in with ChatGPT storage/deployment boundaries; official provider brand
sources. Preserve scope and license provenance in local asset documentation.
