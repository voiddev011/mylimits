import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

test.use({ launchOptions: { executablePath: process.env.CHROMIUM_PATH } });

let server: Server;
let origin: string;
test.beforeAll(async () => {
  const root = resolve("site");
  server = createServer(async (req, res) => {
    const path = decodeURIComponent(
      new URL(req.url!, "http://localhost").pathname,
    );
    const file = resolve(root, path.replace(/^\/mylimits\//, ""));
    if (!path.startsWith("/mylimits/") || !file.startsWith(root + sep)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css",
            ".js": "text/javascript",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

for (const width of [360, 1280])
  for (const colorScheme of ["light", "dark"] as const) {
    for (const file of [
      "index.html",
      "how-it-works.html",
      "privacy.html",
      "faq.html",
    ]) {
      test(`site ${file} at ${width}px in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 640 });
        await page.emulateMedia({ colorScheme });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (req) => {
          if (!req.url().startsWith(origin + "/"))
            errors.push(`Unexpected request: ${req.url()}`);
        });
        page.on("response", (res) => {
          if (res.status() >= 400)
            errors.push(`HTTP ${res.status()}: ${res.url()}`);
        });
        await page.goto(`${origin}/mylimits/${file}`);
        await expect(page.locator("h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        for (const link of await page
          .locator("a[href]")
          .evaluateAll((nodes) =>
            nodes
              .map((n) => n.getAttribute("href")!)
              .filter((h) => !h.startsWith("https:")),
          )) {
          const target = new URL(link, page.url());
          expect(
            (await page.request.get(target.href)).status(),
            target.href,
          ).toBe(200);
          if (target.hash && target.pathname === new URL(page.url()).pathname)
            await expect(page.locator(target.hash)).toHaveCount(1);
        }
        if (file === "index.html") {
          await expect(page.locator("[data-store][href]")).toHaveCount(0);
          await expect(page.locator("[data-store] small")).toHaveText([
            "Coming soon",
            "Coming soon",
            "Coming soon",
          ]);
          expect(await page.evaluate(() => scrollY)).toBe(0);
          for (const control of await page
            .locator("[data-store], #install .button")
            .all()) {
            const bounds = await control.boundingBox();
            expect(bounds!.y).toBeGreaterThanOrEqual(0);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
          }
          if (width === 360 || colorScheme === "dark")
            await page.screenshot({
              path: `artifacts/site-${width}-${colorScheme}.png`,
              fullPage: true,
            });
        }
        expect(errors).toEqual([]);
      });
    }
  }

test("store configuration enables only valid HTTPS links", async ({ page }) => {
  await page.route("**/assets/config.js", async (route) => {
    const source = await readFile("site/assets/config.js", "utf8");
    await route.fulfill({
      contentType: "text/javascript",
      body: source
        .replace(/chrome:\s*['"]{2}/, 'chrome: "https://example.com/chrome"')
        .replace(/edge:\s*['"]{2}/, 'edge: "javascript:alert(1)"')
        .replace(/firefox:\s*['"]{2}/, 'firefox: "https://example.com/firefox"'),
    });
  });
  await page.goto(`${origin}/mylimits/index.html`);
  await expect(page.locator("[data-store=chrome]")).toHaveAttribute(
    "href",
    "https://example.com/chrome",
  );
  await expect(page.locator("[data-store=firefox]")).toHaveAttribute(
    "href",
    "https://example.com/firefox",
  );
  await expect(page.locator("[data-store=edge]")).not.toHaveAttribute("href");
  await expect(page.locator("[data-store=chrome] small")).toHaveText(
    "Install extension ↗",
  );
});

test("documentation, beta download and FAQ work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${origin}/mylimits/index.html`);
  await expect(
    page.getByRole("link", { name: "Download beta ZIP" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/voiddev011/mylimits/releases/latest",
  );
  await page.getByRole("navigation").getByRole("link", { name: "FAQ" }).click();
  await page
    .getByText("Are saved sign-ins available?", { exact: true })
    .click();
  await expect(
    page.getByText("Not in the current production policy.", { exact: false }),
  ).toBeVisible();
  await context.close();
});

test("website descriptions match the simplified extension and Copilot API path", async ({
  page,
}) => {
  await page.goto(`${origin}/mylimits/index.html`);
  const copilot = page
    .locator(".tool")
    .filter({
      has: page.getByRole("heading", { name: "GitHub Copilot", exact: true }),
    });
  await expect(copilot).toContainText("official GitHub API");
  await expect(copilot).not.toContainText("Coming soon");
  for (const file of [
    "index.html",
    "faq.html",
    "how-it-works.html",
    "privacy.html",
  ]) {
    await page.goto(`${origin}/mylimits/${file}`);
    const body = await page.locator("body").textContent();
    for (const retired of [
      "Desktop helper",
      "nativeMessaging",
      "Gemini",
      "Grok",
      "Perplexity",
      "snapshot sync",
    ])
      expect(body).not.toContain(retired);
  }
  await page.goto(`${origin}/mylimits/privacy.html`);
  await expect(page.locator("body")).toContainText("mylimits:tokens:v1");
  await expect(page.locator("body")).toContainText("api.github.com");
});
