# MyLimits — documentation

MyLimits brings AI account readings into one compact browser dashboard.
Website tracking exists. The active upgrade is **MyLimits Desktop + extension**:
separate official OpenAI/Codex and Claude profiles, combined in the extension.
Real two-account freshness/login acceptance remains pending for both providers.

The persistent-accounts development branch adds bounded website recovery: eligible
failures may briefly open an inactive provider tab, using the current browser
login. The setting is optional and browser-local. This does not preserve an
expired/revoked login or establish an independent account; private-session/vault
work remains gated by real-provider evidence. See [preview testing](INSTALL.md#persistent-accounts-checkpoint-a-c1c4).

## Implementation

- [Start here](START-HERE.md)
- [Current status](IMPLEMENTATION-STATUS.md)
- [Proposed persistent-accounts plan v2](MYLIMITS-PERSISTENT-ACCOUNTS-PLAN-v2.md)
- [Live session-persistence evidence ledger (pending)](SESSION-PERSISTENCE-EVIDENCE.md)
- [Provider support and manual acceptance](PROVIDER-CAPABILITIES.md)
- [Desktop delivery and pending live acceptance](DESKTOP-ACCOUNTS-HANDOFF.md)
- [Historical evidence and consolidated checkpoints](IMPLEMENTATION-HISTORY.md)
- [Competitor research](COMPETITOR-RESEARCH.md)

## Install and operate

- [Current extension installation](INSTALL.md)
- [Developer account-proof diagnostic](ACCOUNT-PROOF.md)
- [Platforms and packaging](PLATFORMS.md)

## Contracts and reference

- [Architecture](ARCHITECTURE.md)
- [Provider capabilities and integration evidence](PROVIDER-CAPABILITIES.md)
- [Privacy](PRIVACY.md)
- [Provider assets](PROVIDER-ASSETS.md)
- [Optional server operations](SERVER-SETUP.md)

Project Markdown lives directly in this folder. Completed execution plans and starter prompts are archived in Git history.
Older removed plans and phase ledgers remain in Git history; their unique evidence
is consolidated above. Version 3.4 defaults independent connections to Desktop.
The hosted provider registry remains empty and is not a fallback for Desktop.

## Docker build and optional API

The extension builder defaults to Node 24. Select another maintained major through
`NODE_VERSION` (22, 24 or 26); source tooling requires at least Node 22.15.

```powershell
docker build --build-arg NODE_VERSION=22 -t mylimits-extension-builder .
docker run --rm -v "${PWD}\.output:/app/.output" mylimits-extension-builder
```

This builds extension files; it does not host a browser extension or connect AI
accounts remotely. The root `compose.yaml` runs the optional API and PostgreSQL
with `docker compose up --build`. See [server setup](SERVER-SETUP.md) for local
configuration, data-volume behavior and production limitations.
