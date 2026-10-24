# Provider assets

Downloaded 16 October 2026 from each service’s publicly advertised favicon.
Bundled unchanged for service identification; trademarks belong to their owners.
No endorsement or ownership is implied. No runtime icon network requests.
Brand/store acceptance remains part of release review.

- `public/providers/chatgpt.svg`: https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg
- `public/providers/claude.svg`: https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg
- `public/providers/cursor.svg`: https://cursor.com/marketing-static/favicon-light.svg

- `public/providers/copilot.svg`: Primer Octicons `copilot-24.svg`, fetched via
  https://api.github.com/repos/primer/octicons/contents/icons/copilot-24.svg
  on 24 October 2026. [Octicons MIT license](https://github.com/primer/octicons/blob/main/LICENSE).
  Bundled unchanged for provider identification.

Octicons license:

```text
MIT License

Copyright (c) 2026 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## MyLimits brand

The three rounded bars in `src/ui/BrandMark.tsx` and `public/icon/logo.svg`
match [the website mark](https://github.com/voiddev011/mylimits-website/blob/979dadef5e8cec1bdbdda161cc06751f9b4d6c95/assets/styles.css):
5px bars, 3px gaps, heights 12/23/17px, 2px corner radius. The UI inherits its
existing theme colour. Toolbar icons use the website’s ink (#183b2d) and wash
(#edf2e6) with a padded rounded tile for contrast. No provider logos are changed.

Regenerate 16/32/48/128px PNGs from the SVG with
`node scripts/render-brand-icons.mjs` using the existing Playwright browser
installation (`CHROMIUM_PATH` is supported). Icons are bundled locally.
