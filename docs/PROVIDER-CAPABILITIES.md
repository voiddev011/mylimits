# Provider capabilities — Phase 1

Checked: 15 October 2026. Evidence is code/documentation plus fictional fixtures;
no real signed-in provider account is available in this environment. A successful
fixture test never establishes live quota access or survival of website logout.

| Provider / source | Quota scope | Tab requirement | Account-wide | Website logout / renewal | Multiple live accounts | Hosted |
| --- | --- | --- | --- | --- | --- | --- |
| Claude website | Reported subscription/workspace windows where returned | Background first; existing permitted tab fallback | Unverified live; intended provider account/workspace reading | Session-bound; logout independence unsupported by this connection | One current website session; remembered accounts retained | Unverified; not implemented |
| ChatGPT website | Work/Codex and code-review windows when returned; not ordinary chat limits | Background first; existing permitted tab fallback | Unverified live; intended provider-reported pool | Current website session needed to obtain transient bearer | One current website session; remembered accounts retained | Unverified; not implemented |
| OpenAI optional companion | Returned Codex App Server buckets | No website tab needed by design | Unverified live | Separate native authorization; actual logout/renewal behavior unverified | Isolated native profiles implemented; live verification pending | Not implemented; local support does not establish hosted eligibility |
| Gemini browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |
| Grok browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |
| Perplexity browser observer | Local successful recognized request counts only | Existing provider page required | Unsupported for this source | No independent authorization or renewal | Browser-scoped activity; no verified remote account | Not implemented |

## Evidence and release boundaries

- Existing website adapters use exact HTTPS provider origins and request-local
  authentication. Claude selects a workspace and reads its usage; ChatGPT reads
  the website session and Work/Codex usage response. Internal interfaces are not
  stable public contracts. Fixture evidence is separate from a live acceptance.
- [Official Codex App Server](https://developers.openai.com/codex/app-server/)
  documents rate-limit reads, not a universal consumer ChatGPT quota endpoint.
- [OpenAI sign-in overview](https://developers.openai.com/siwc/token-sharing-open-source)
  distinguishes local/open-source plan integration from remotely hosted offerings.
  It does not establish that a MyLimits hosted quota reader is authorized.
- Tab closure, browser restart, activity elsewhere, website logout, collector
  revocation and global logout must be recorded separately for each connection.
- Actual Windows Chrome/Brave popup scaling, native host launch and provider
  behavior remain manual acceptance checks. No passwords/tokens are requested.

Phase 1 retains the current source scope. Additional providers, new independent
grants and hosted collection belong to Phase 2, which has not started.
