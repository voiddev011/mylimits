// Rasterize the canonical website-derived mark at each required browser icon size.
// Uses the existing Playwright development dependency; no network requests.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const svg = await readFile(
  new URL("../public/icon/logo.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
});
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    const png = await page.evaluate(
      async ({ svg, size }) => {
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(img, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    await writeFile(
      new URL(`../public/icon/${size}.png`, import.meta.url),
      Buffer.from(png, "base64"),
    );
    console.log(`Rendered ${size} × ${size}`);
  }
} finally {
  await browser.close();
}
