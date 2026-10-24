# MyLimits

See your available AI usage limits and reset times in one place, across Claude,
ChatGPT / Codex, Cursor, and GitHub Copilot. MyLimits is a browser extension;
your data stays in your browser and no MyLimits account or server is required.

**Website:** [voiddev011.github.io/mylimits-website](https://voiddev011.github.io/mylimits-website/index.html)

## Features

- View provider-reported usage and reset times from one dashboard.
- Keep track of multiple provider accounts, with aliases and dated readings.
- Review local usage history, charts, and CSV or JSON exports.
- Choose a limit for the browser toolbar badge and configure notifications.
- Manage privacy and account data from the dashboard.

Provider data and features depend on each provider and browser. ChatGPT saved
sign-in is experimental on Chromium browsers. See the [privacy notes](docs/PRIVACY.md)
for details and limitations.

## Install

Download a browser ZIP from the [GitHub Releases](https://github.com/voiddev011/mylimits/releases)
page, extract it to a permanent folder, and load it as an unpacked extension:

- **Chrome, Brave, or Edge:** open the browser's Extensions page, enable
  **Developer mode**, select **Load unpacked**, and choose the extracted folder
  containing `manifest.json`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, select **Load
  Temporary Add-on**, and choose the extracted `manifest.json`. This temporary
  installation ends when Firefox restarts.

Use the ZIP attached to a release, not GitHub's automatically generated
**Source code** archive. More installation and update instructions are in
[docs/INSTALL.md](docs/INSTALL.md).

## Development

Requirements: Node.js 22.15 or newer.

```sh
npm ci --include=optional
npm run dev
```

Build the extension with `npm run build`. Browser-specific builds and packaging
instructions are in [docs/INSTALL.md](docs/INSTALL.md).

## Documentation

- [Installation and updates](docs/INSTALL.md)
- [Privacy](docs/PRIVACY.md)
- [Architecture and maintenance](docs/ARCHITECTURE.md)
- [GitHub Copilot setup](docs/COPILOT.md)
- [Provider artwork and licenses](docs/PROVIDER-ASSETS.md)
- [Release and store launch](docs/LAUNCH.md)

## License

**Proprietary — all rights reserved.** This project is not licensed under MIT
or another open-source license. No permission is granted to copy, modify,
redistribute, sell, or commercially use this project. See [LICENSE](LICENSE).

GitHub's Terms of Service allow users to view and fork public repositories on
GitHub. Repository visibility and platform permissions are separate from
permission to reuse or commercialize the project.

