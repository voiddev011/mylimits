# Privacy

MyLimits tracks provider-reported usage for **Claude / Claude Code**, **ChatGPT / Codex** and **Cursor** through the account currently signed into each website. Ordinary ChatGPT message/image quotas are not inferred from Codex buckets. Unknown quotas and reset times stay unknown.

Saved-sign-in code remains present with every provider policy **off** and empty cookie allowlists. Private sign-in is hidden until evidence and approval enable a provider. Website cards remember previous identities but do not independently refresh logged-out accounts. Copilot token connections are separate.

Website access is optional and restricted to three exact website HTTPS origins; Copilot separately requests api.github.com. The readers obtain account/workspace identity and available usage data; they do not read prompts, chat history or model response text. Identity is salted/hashed before account storage; nickname and quota readings are local plaintext. Where required, the website session bearer is transient and not logged or exported.

Diagnostics contain bounded sanitized request metadata: provider/path template, status, transport and timing, never bodies, cookie values or tokens. Copy safe diagnostics copies this report only when clicked.

Saved-sign-in code is disabled. Its prepared encryption protects accidental exposure, not malware or a copied whole browser profile. Session expiry/revocation and logout survival require real evidence. Notifications honor existing permission, quiet hours, mute and privacy controls; missing expiry is never guessed.

U1 removes retired provider/source accounts, snapshots and history on first load and erases obsolete feature storage keys. A metadata-only journal makes interrupted deletion retryable. Remaining account data and history are preserved. History exports contain dated readings only. Forget removes the selected account and history.

Evidence-spike capture is explicit and temporary in a separate test profile. Captures disappear on disconnect/restart; copied reports exclude secrets. [Maintainer test instructions](ARCHITECTURE.md#maintainer-test-builds).

## GitHub Copilot REST tokens

Optional Copilot connections use fine-grained tokens with Plan: read. The token
is encrypted separately in `mylimits:tokens:v1` using the existing non-extractable
AES-GCM key. Only requests to `api.github.com` receive it. Documented billing is the default;
explicit experimental opt-in also sends the token to GitHub’s undocumented
`copilot_internal/user` entitlement endpoint. No IDE impersonation or cookie
collection is used for Copilot. Tokens are
excluded from account state, history, exports and diagnostics. Disconnect removes
the chosen token; Forget removes that account's tokens and history. See [COPILOT.md](COPILOT.md).
