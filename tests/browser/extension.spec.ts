import {
  test as base,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
import { mkdtemp, rm, mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { emptyStore, type Store, type Account } from "../../src/core/model";
import { demoState } from "../../src/ui/demo";
import { accountId, applySnapshot } from "../../src/core/engine";
import type { browser } from "wxt/browser";
declare const chrome: typeof browser;

const extensionPath = path.resolve(".output/chrome-mv3");
const test = base.extend<{
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  profilePath: string;
  grantedProviderOrigin: string | null;
  grantedCookieAccess: boolean;
}>({
  grantedProviderOrigin: [null, { option: true }],
  grantedCookieAccess: [false, { option: true }],
  profilePath: async ({}, use) => {
    const dir = await mkdtemp(path.join(tmpdir(), "mylimits-browser-"));
    try {
      await use(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  context: async (
    { profilePath, grantedProviderOrigin, grantedCookieAccess },
    use,
  ) => {
    if (!existsSync(path.join(extensionPath, "manifest.json")))
      throw new Error("Run npm run build before browser tests.");
    let loadedExtensionPath = extensionPath;
    if (grantedProviderOrigin || grantedCookieAccess) {
      loadedExtensionPath = path.join(profilePath, "fixture-extension");
      await cp(extensionPath, loadedExtensionPath, { recursive: true });
      const file = path.join(loadedExtensionPath, "manifest.json");
      const manifest = JSON.parse(await readFile(file, "utf8"));
      if (grantedProviderOrigin)
        manifest.host_permissions = [grantedProviderOrigin];
      if (grantedCookieAccess) manifest.permissions.push("cookies");
      await writeFile(file, JSON.stringify(manifest));
    }
    const userData = profilePath;
    const configured = process.env.CHROMIUM_PATH;
    const executablePath = configured; // Prefer Playwright's extension-capable Chromium.
    const context = await chromium.launchPersistentContext(userData, {
      ignoreDefaultArgs: ["--disable-extensions"],
      executablePath,
      channel: executablePath ? undefined : "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${loadedExtensionPath}`,
        `--load-extension=${loadedExtensionPath}`,
        "--no-sandbox",
        "--disable-background-networking",
      ],
    });
    // These tests use fixtures only; never contact real AI accounts.
    await context.route(/^https?:\/\//, (route) => route.abort());
    try {
      await use(context);
    } finally {
      await context.close();
      await rm(userData, { recursive: true, force: true });
    }
  },
  worker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
    await expect
      .poll(async () =>
        worker.evaluate(
          async () =>
            (await chrome.storage.local.get("mylimits:active-schema"))[
              "mylimits:active-schema"
            ],
        ),
      )
      .toBe(2);
    await use(worker);
  },
  extensionId: async ({ worker }, use) => use(new URL(worker.url()).host),
});

test.describe("bounded temporary-tab recovery (fictional provider)", () => {
  test.use({ grantedProviderOrigin: "https://claude.ai/*" });
  test("one inactive recovery tab completes identity and quota reads, preserves aliases, then closes itself", async ({
    context,
    worker,
    extensionId,
  }) => {
    await context.route("https://claude.ai/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Fictional recovery provider</p>",
      }),
    );
    await context.addInitScript(() => {
      if (location.origin !== "https://claude.ai") return;
      window.fetch = async (input) => {
        const p = new URL(String(input)).pathname;
        const body =
          p === "/api/account"
            ? { uuid: "recovery-user" }
            : p === "/api/organizations"
              ? [
                  {
                    uuid: "recovery-org",
                    name: "Personal",
                    capabilities: ["chat"],
                  },
                ]
              : {
                  five_hour: {
                    utilization: 35,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      };
    });
    await context.route("https://example.test/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Keep my tab</p>",
      }),
    );
    const unrelated = await context.newPage();
    await unrelated.goto("https://example.test/");
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    const salt = "fictional-recovery-salt",
      id = await accountId("claude", "recovery-user:recovery-org", salt),
      oldTime = Date.now() - 3600000;
    const store = applySnapshot(
      emptyStore(salt),
      "claude",
      id,
      {
        kind: "account",
        displayName: "Personal",
        plan: "pro",
        meters: [{ ...demoState().accounts[0]!.meters[0]!, usedPercent: 90 }],
      },
      oldTime,
    );
    store.accounts[0]!.alias = "Personal saved";
    store.providers.claude.enabled = true;
    Object.assign(store.connections.find((c) => c.id === "website:claude")!, {
      enabled: true,
      lastAttemptAt: null,
      nextRetryAt: null,
    });
    await worker.evaluate(async (store) => {
      globalThis.fetch = async () =>
        new Response(null, {
          status: 403,
          headers: { "content-type": "text/html", "cf-mitigated": "challenge" },
        });
      await chrome.storage.local.set({ "mylimits:state:v2": store });
    }, store);
    const refresh = page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "refresh", provider: "claude" }),
    );
    await expect(
      page.getByText("Retrying in the background", { exact: false }),
    ).toBeVisible();
    expect((await refresh).ok).toBe(true);
    const saved = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(saved.accounts).toHaveLength(1);
    expect(saved.accounts[0]).toMatchObject({ id, alias: "Personal saved" });
    const diag = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(
      saved.accounts[0]!.meters[0]!.usedPercent,
      JSON.stringify({ connections: saved.connections, diag }),
    ).toBe(35);
    expect(saved.accounts[0]!.updatedAt).toBeGreaterThan(oldTime);
    expect(
      diag.data.entries.filter(
        (e: { transport: string }) => e.transport === "temp-tab",
      ),
    ).toHaveLength(4);
    const local = await worker.evaluate(() =>
      chrome.storage.local.get("mylimits:recovery-counters:v1"),
    );
    expect(
      (
        local["mylimits:recovery-counters:v1"] as {
          claude: { attempts: number };
        }
      ).claude.attempts,
    ).toBe(1);
    expect(
      (
        await worker.evaluate(() =>
          chrome.storage.session.get("mylimits:recovery-tabs:v1"),
        )
      )["mylimits:recovery-tabs:v1"],
    ).toEqual([]);
    await expect
      .poll(
        () =>
          context.pages().filter((p) => p.url().startsWith("https://claude.ai"))
            .length,
      )
      .toBe(0);
    expect(unrelated.isClosed()).toBe(false);
    expect(unrelated.url()).toBe("https://example.test/");
  });
  test("normal tab wins over an active private-tagged tab and private-only context is never read", async ({
    context,
    worker,
    extensionId,
  }) => {
    await context.route("https://claude.ai/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Fictional provider</p>",
      }),
    );
    const normal = await context.newPage();
    await normal.goto("https://claude.ai/normal");
    const privateFixture = await context.newPage();
    await privateFixture.goto("https://claude.ai/private-fixture");
    for (const [page, used] of [
      [normal, 20],
      [privateFixture, 80],
    ] as const)
      await page.evaluate((used) => {
        const scope = window as typeof window & { quotaReads: number };
        scope.quotaReads = 0;
        window.fetch = async (input) => {
          scope.quotaReads++;
          const p = new URL(String(input)).pathname;
          const body =
            p === "/api/account"
              ? { uuid: "normal-user" }
              : p === "/api/organizations"
                ? [
                    {
                      uuid: "normal-org",
                      name: "Personal",
                      capabilities: ["chat"],
                    },
                  ]
                : {
                    five_hour: {
                      utilization: used,
                      resets_at: "2030-01-01T00:00:00Z",
                    },
                  };
          return new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
          });
        };
      }, used);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await worker.evaluate(() => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (q) => {
        const tabs = await query(q);
        return q.url
          ? tabs
              .sort(
                (a, b) =>
                  Number(b.url?.includes("private-fixture")) -
                  Number(a.url?.includes("private-fixture")),
              )
              .map((t) => ({
                ...t,
                incognito: t.url?.includes("private-fixture") ?? false,
                active: t.url?.includes("private-fixture") ?? false,
              }))
          : tabs;
      };
      globalThis.fetch = async () => new Response(null, { status: 403 });
    });
    await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "enable",
        provider: "claude",
        enabled: true,
      }),
    );
    const saved = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(saved.accounts[0]!.meters[0]!.usedPercent).toBe(20);
    expect(
      await privateFixture.evaluate(
        () => (window as typeof window & { quotaReads: number }).quotaReads,
      ),
    ).toBe(0);
    await normal.close();
    await worker.evaluate(async () => {
      const data = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      data.settings.autoRecoverTab = false;
      Object.assign(data.connections.find((c) => c.id === "website:claude")!, {
        lastAttemptAt: null,
        nextRetryAt: null,
      });
      await chrome.storage.local.set({ "mylimits:state:v2": data });
    });
    await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "refresh", provider: "claude" }),
    );
    expect(
      await privateFixture.evaluate(
        () => (window as typeof window & { quotaReads: number }).quotaReads,
      ),
    ).toBe(0);
  });
  test("plain unauthorized responses create no temporary tab and the recovery opt-out persists", async ({
    context,
    worker,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel(
        "Recover without opening the site (briefly opens a background tab)",
        { exact: true },
      )
      .uncheck();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByLabel(
        "Recover without opening the site (briefly opens a background tab)",
        { exact: true },
      ),
    ).not.toBeChecked();
    await worker.evaluate(async () => {
      globalThis.fetch = async () =>
        new Response(null, {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      const data = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      data.settings.autoRecoverTab = true;
      await chrome.storage.local.set({ "mylimits:state:v2": data });
    });
    const before = context.pages().length;
    await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "enable",
        provider: "claude",
        enabled: true,
      }),
    );
    expect(context.pages().length).toBe(before);
    expect(
      (
        await worker.evaluate(() =>
          chrome.storage.local.get("mylimits:recovery-counters:v1"),
        )
      )["mylimits:recovery-counters:v1"],
    ).toBeUndefined();
  });
});

test.describe("connection-scoped refresh (fictional providers only)", () => {
  test.use({ grantedProviderOrigin: "https://claude.ai/*" });
  test("a reserved saved source never borrows browser login, and refresh/disconnect affect only the selected connection", async ({
    context,
    worker,
    extensionId,
  }) => {
    const { vaultId } = await import("../../src/core/connection-id");
    const slot = "0ca82d0c-54da-4b17-901f-64d7c7964adb",
      savedId = vaultId("claude", slot),
      salt = "fictional-source-salt",
      old = Date.now() - 3600000;
    const websiteAccount = await accountId("claude", "web-user:web-org", salt);
    let state = applySnapshot(
      emptyStore(salt),
      "claude",
      websiteAccount,
      {
        kind: "account",
        displayName: "Website A",
        plan: null,
        meters: [{ ...demoState().accounts[0]!.meters[0]!, usedPercent: 90 }],
      },
      old,
    );
    state.connections.find((c) => c.id === "website:claude")!.lastAttemptAt =
      Date.now();
    state.connections.push({
      ...state.connections[0]!,
      id: savedId,
      kind: "vault",
      profileId: slot,
      accountId: null,
      lastAttemptAt: null,
    });
    state = applySnapshot(
      state,
      "claude",
      "fictional-saved-B",
      {
        kind: "account",
        displayName: "Saved B",
        plan: null,
        meters: [{ ...demoState().accounts[0]!.meters[0]!, usedPercent: 80 }],
      },
      old,
      { connectionId: savedId },
    );
    state.accounts.find((a) => a.id === "fictional-saved-B")!.alias =
      "Personal B";
    await worker.evaluate(async (state) => {
      const scope = globalThis as typeof globalThis & {
        sourceFixtureReads: number;
      };
      scope.sourceFixtureReads = 0;
      globalThis.fetch = async (input) => {
        scope.sourceFixtureReads++;
        const p = new URL(String(input)).pathname;
        const body =
          p === "/api/account"
            ? { uuid: "web-user" }
            : p === "/api/organizations"
              ? [{ uuid: "web-org", name: "Personal", capabilities: ["chat"] }]
              : {
                  five_hour: {
                    utilization: 25,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      };
      await chrome.storage.local.set({ "mylimits:state:v2": state });
    }, state);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    expect(
      (
        await page.evaluate(
          (connectionId) =>
            chrome.runtime.sendMessage({ type: "refresh", connectionId }),
          savedId,
        )
      ).ok,
    ).toBe(true);
    const failed = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(failed.accounts.find((a) => a.id === websiteAccount)).toMatchObject({
      connection: "active",
      updatedAt: old,
    });
    expect(
      failed.accounts.find((a) => a.id === "fictional-saved-B"),
    ).toMatchObject({
      alias: "Personal B",
      connection: "unavailable",
      updatedAt: old,
    });
    expect(
      failed.accounts.find((a) => a.id === "fictional-saved-B")!.meters[0]!
        .usedPercent,
    ).toBe(80);
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { sourceFixtureReads: number })
            .sourceFixtureReads,
      ),
    ).toBe(0);
    expect(failed.connections.find((c) => c.id === savedId)!.message).toContain(
      "Provider evidence and setup",
    );
    const publicState = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "state" }),
    );
    expect(
      publicState.data.connections.find(
        (c: { id: string }) => c.id === savedId,
      ),
    ).not.toHaveProperty("profileId");
    await expect(
      page
        .getByRole("button", { name: "Details for Personal B", exact: true })
        .locator(".source-badge"),
    ).toHaveText("Saved sign-in");
    await page.evaluate(
      (connectionId) =>
        chrome.runtime.sendMessage({ type: "disconnect", connectionId }),
      savedId,
    );
    await worker.evaluate(async () => {
      const store = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      store.connections.find((c) => c.id === "website:claude")!.lastAttemptAt =
        null;
      await chrome.storage.local.set({ "mylimits:state:v2": store });
    });
    await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "refresh",
        connectionId: "website:claude",
      }),
    );
    const final = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(
      final.accounts.find((a) => a.id === websiteAccount)!.meters[0]!
        .usedPercent,
    ).toBe(25);
    expect(
      final.accounts.find((a) => a.id === "fictional-saved-B"),
    ).toMatchObject({
      alias: "Personal B",
      connection: "inactive",
      updatedAt: old,
    });
    expect(final.accounts).toHaveLength(2);
  });
  test("disconnecting website A retains access for saved B and requests optional-grant release only for the last source", async ({
    context,
    worker,
    extensionId,
  }) => {
    const { vaultId } = await import("../../src/core/connection-id"),
      slot = "10000000-0000-4000-8000-000000000003",
      sourceId = vaultId("claude", slot),
      old = Date.now() - 3600000;
    let state = applySnapshot(
      emptyStore("shared-access-fixture"),
      "claude",
      "website-A",
      { kind: "account", displayName: "A", plan: null, meters: [] },
      old,
    );
    state.connections.find((c) => c.id === "website:claude")!.lastAttemptAt =
      Date.now();
    state.connections.push({
      ...state.connections[0]!,
      id: sourceId,
      kind: "vault",
      profileId: slot,
      accountId: null,
      lastAttemptAt: Date.now(),
    });
    state = applySnapshot(
      state,
      "claude",
      "saved-B",
      { kind: "account", displayName: "B", plan: null, meters: [] },
      old,
      { connectionId: sourceId },
    );
    state.accounts[1]!.alias = "Personal B";
    await worker.evaluate(async (state) => {
      // This fixture grants required host access to avoid a real approval prompt. Model optional removal explicitly.
      const scope = globalThis as typeof globalThis & {
        sharedGrantRemovals: number;
      };
      scope.sharedGrantRemovals = 0;
      const remove = chrome.permissions.remove.bind(chrome.permissions);
      chrome.permissions.remove = async (grants) => {
        if (grants.origins?.includes("https://claude.ai/*")) {
          scope.sharedGrantRemovals++;
          return true;
        }
        return remove(grants);
      };
      await chrome.storage.local.set({ "mylimits:state:v2": state });
    }, state);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    expect(
      (
        await page.evaluate(() =>
          chrome.runtime.sendMessage({
            type: "disconnect",
            connectionId: "website:claude",
          }),
        )
      ).ok,
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        chrome.permissions.contains({ origins: ["https://claude.ai/*"] }),
      ),
    ).toBe(true);
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { sharedGrantRemovals: number })
            .sharedGrantRemovals,
      ),
    ).toBe(0);
    const kept = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(kept.connections.find((c) => c.id === sourceId)!.enabled).toBe(true);
    expect(kept.accounts.find((a) => a.id === "saved-B")).toEqual(
      state.accounts[1],
    );
    const removed = await page.evaluate(
      (connectionId) =>
        chrome.runtime.sendMessage({ type: "disconnect", connectionId }),
      sourceId,
    );
    expect(removed.ok, removed.error).toBe(true);
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { sharedGrantRemovals: number })
            .sharedGrantRemovals,
      ),
    ).toBe(1);
  });
});

// Protocol-2 fixture: first-party processes are fictional; no provider is contacted.
test("new install starts empty and sample preview does not write fake accounts to storage", async ({
  context,
  worker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.getByText("A clear view starts here.")).toBeVisible();
  await page.getByRole("button", { name: "Preview with sample data" }).click();
  await expect(
    page.getByText("Preview · sample accounts and readings"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Details for Claude Work", exact: true }),
  ).toBeVisible();
  const count = await worker.evaluate(
    async () =>
      (
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store
      ).accounts.length,
  );
  expect(count).toBe(0);
  await page.getByRole("button", { name: "Exit sample preview" }).click();
  await expect(page.getByText("A clear view starts here.")).toBeVisible();
});

test("two Claude and three ChatGPT records can be renamed independently and persist on reload", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("fictional-browser-test-salt"),
    accounts: demoState().accounts,
  };
  await worker.evaluate(
    async (store) => chrome.storage.local.set({ "mylimits:state:v2": store }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page
    .getByRole("button", { name: "Details for Claude Personal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rename Claude Personal", exact: true })
    .click();
  await page.getByLabel("Account nickname").fill("Writing account");
  await page
    .getByRole("button", { name: "Save nickname", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Details for Writing account",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Details for Claude Work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Details for GPT Work", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Details for Writing account",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts).toHaveLength(5);
  expect(
    saved.accounts.find(
      (account: { id: string }) => account.id === "demo-claude-personal",
    )!.alias,
  ).toBe("Writing account");
  expect(
    saved.accounts.find(
      (account: { id: string }) => account.id === "demo-gpt-personal",
    )!.alias,
  ).toBe("GPT Personal");
});

test("preferences persist and account warnings remain separately configurable", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("fictional-browser-test-salt"),
    accounts: demoState().accounts,
  };
  await worker.evaluate(
    async (store) => chrome.storage.local.set({ "mylimits:state:v2": store }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Early warning").fill("30");
  await page.getByLabel("Critical warning").fill("10");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Early warning")).toHaveValue("30");
  await expect(page.getByLabel("Critical warning")).toHaveValue("10");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Details for Claude Work", exact: true })
    .click();
  await page.getByLabel("Warning for Claude Work").fill("15");
  await page
    .getByRole("button", { name: "Save threshold", exact: true })
    .click();
  await expect
    .poll(async () =>
      worker.evaluate(
        async () =>
          (
            (await chrome.storage.local.get("mylimits:state:v2"))[
              "mylimits:state:v2"
            ] as Store
          ).accounts.find(
            (account: { id: string }) => account.id === "demo-claude-work",
          )!.alertRemaining,
      ),
    )
    .toBe(15);
});

test("production-off expiry metadata shows honest labels but cannot arm warnings or change reading timestamps", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = emptyStore("production-expiry-off"),
    now = Date.now(),
    slot = "10000000-0000-4000-8000-000000000001",
    id = `vault:claude:${slot}`;
  const account = { ...demoState(now).accounts[0]!, meters: [] };
  fixture.accounts = [account];
  fixture.connections.push({
    ...fixture.connections.find((c) => c.provider === "claude")!,
    id,
    kind: "vault",
    profileId: slot,
    accountId: account.id,
    enabled: true,
    status: "active",
    savedSignIn: { method: "private", notAfter: now + 20 * 3600000 },
  });
  fixture.settings.desktopAlerts = true;
  await worker.evaluate(async (s) => {
    const scope = globalThis as typeof globalThis & {
      expiryNotifications: number;
    };
    scope.expiryNotifications = 0;
    const contains = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = async (p) =>
      p.permissions?.includes("notifications") ? true : contains(p);
    Object.defineProperty(chrome, "notifications", {
      configurable: true,
      value: {
        create: async () => {
          scope.expiryNotifications++;
          return "fictional-notification";
        },
      },
    });
    await chrome.storage.local.set({ "mylimits:state:v2": s });
  }, fixture);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page
    .getByRole("button", { name: "Details for Claude Work", exact: true })
    .click();
  await expect(
    page.getByText("Sign-in expires in 1 day", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.evaluate(
        async (settings) =>
          chrome.runtime.sendMessage({ type: "settings", settings }),
        fixture.settings,
      )
    ).ok,
  ).toBe(true);
  expect(
    await worker.evaluate(() => chrome.alarms.get("mylimits:signin-expiry")),
  ).toBeUndefined();
  expect(
    await worker.evaluate(
      () =>
        (globalThis as typeof globalThis & { expiryNotifications: number })
          .expiryNotifications,
    ),
  ).toBe(0);
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts[0]!.updatedAt).toBe(account.updatedAt);
  expect(saved.alertLedger).toEqual({});
  await worker.evaluate(async () => {
    const s = (await chrome.storage.local.get("mylimits:state:v2"))[
      "mylimits:state:v2"
    ] as Store;
    s.connections.find((c) => c.kind === "vault")!.savedSignIn!.notAfter = null;
    await chrome.storage.local.set({ "mylimits:state:v2": s });
  });
  await expect(
    page.getByText("Sign-in expires in 1 day", { exact: true }),
  ).toHaveCount(0);
});

test("denying website permission creates no account and popup fits its viewport", async ({
  context,
  worker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
  await page.getByRole("button", { name: /Claude \/ Claude Code/ }).click();
  await page.evaluate(() => {
    chrome.permissions.request = async () => false;
  });
  await page
    .getByRole("button", { name: "Use current browser login", exact: true })
    .click();
  await expect(page.getByText("Site access was not granted.")).toBeVisible();
  const store = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(store.accounts).toHaveLength(0);
  expect(store.providers.claude.enabled).toBe(false);
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBe(true);
});

test("capture dashboard preview and reject invalid or foreign UI messages", async ({
  context,
  worker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1120, height: 920 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#demo`);
  await expect(
    page.getByRole("button", { name: "Details for Claude Work" }),
  ).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/dashboard-preview.png",
    fullPage: true,
  });
  const result = await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "rename",
      accountId: "x",
      alias: "a".repeat(200),
    }),
  );
  expect(result.ok).toBe(false);
  const before = await worker.evaluate(
    async () =>
      (
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store
      ).accounts.length,
  );
  expect(before).toBe(0);
});

test("quick popup shows six accounts without dashboard clutter or scrolling", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/popup.html#demo`);
  await expect(page.locator(".meter-chip")).toHaveCount(7);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".quick-main")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
  ).toBe(true);
  await page.getByRole("button", { name: "Low only", exact: true }).click();
  await expect(page.locator(".quick-account")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "View GPT Work in full dashboard" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Low only", exact: true }).click();
  await expect(page.locator(".quick-account")).toHaveCount(5);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/compact-popup-preview.png" });
});

test("popup honors dashboard pins without changing account nicknames", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("six-fixture"),
    accounts: demoState().accounts,
  };
  fixture.accounts.push({
    ...fixture.accounts[0]!,
    id: "sixth",
    alias: "Claude Research",
    connection: "inactive",
  });
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page
    .getByRole("button", { name: "Details for GPT Projects", exact: true })
    .click();
  await page.getByRole("button", { name: "Pin account", exact: true }).click();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator(".quick-account")).toHaveCount(6);
  await expect(page.locator(".quick-account").first()).toContainText(
    "GPT Projects",
  );
  await page.reload();
  await expect(page.locator(".quick-account").first()).toContainText(
    "GPT Projects",
  );
  expect(
    await page
      .locator(".quick-main")
      .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
});

test("real IndexedDB pagination, safe export and history deletion preserve account preferences", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("history-fixture"),
    accounts: demoState().accounts,
  };
  fixture.accounts[0]!.alias = "=SUM(A1:A2)";
  await worker.evaluate(
    async ({ fixture, now }) => {
      await chrome.storage.local.set({ "mylimits:state:v2": fixture });
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("mylimits-history", 2);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("readings", "readwrite"),
            s = tx.objectStore("readings");
          for (let i = 0; i < 53; i++) {
            const time = now - Math.floor(i / 2) * 60000;
            s.add({
              schemaVersion: 2,
              accountId: fixture.accounts[0]!.id,
              time,
              observedAt: time,
              receivedAt: now,
              connectionId: "website:claude",
              snapshotKey: `fixture:${i}`,
              meters: [
                {
                  id: "session",
                  label: "Session",
                  scope: "subscription",
                  evidence: "reported",
                  unit: "percent",
                  used: null,
                  total: null,
                  usedPercent: i,
                  resetsAt: now + 3600000,
                  source: "Fixture",
                },
              ],
            });
          }
          s.add({
            accountId: fixture.accounts[1]!.id,
            time: now,
            meters: [],
            legacy: true,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { fixture, now: Date.now() },
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const result = await page.evaluate(async (id) => {
    const one = await chrome.runtime.sendMessage({
      type: "history-page",
      accountId: id,
      limit: 20,
    });
    const two = await chrome.runtime.sendMessage({
      type: "history-page",
      accountId: id,
      limit: 20,
      before: one.data.cursor,
    });
    const three = await chrome.runtime.sendMessage({
      type: "history-page",
      accountId: id,
      limit: 20,
      before: two.data.cursor,
    });
    const csv = await chrome.runtime.sendMessage({
      type: "export-history",
      accountId: id,
      format: "csv",
    });
    const json = await chrome.runtime.sendMessage({
      type: "export-history",
      accountId: id,
      format: "json",
    });
    return {
      pages: [one.data, two.data, three.data],
      csv: csv.data.text,
      json: json.data.text,
    };
  }, fixture.accounts[0]!.id);
  expect(result.pages.map((p) => p.points.length)).toEqual([20, 20, 13]);
  const ids = result.pages.flatMap((p) =>
    p.points.map((r: { id: number }) => r.id),
  );
  expect(new Set(ids).size).toBe(53);
  expect(result.csv).toContain("'=SUM(A1:A2)");
  expect(result.json).not.toContain("history-fixture");
  expect(JSON.parse(result.json).readings).toHaveLength(53);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load older readings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm clear history", exact: true })
    .click();
  await expect(
    page.getByText("No readings yet. They appear after the first refresh."),
  ).toBeVisible();
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts).toHaveLength(5);
  expect(saved.accounts[0]!.alias).toBe("=SUM(A1:A2)");
});

test("V1 state and IndexedDB history migrate on extension restart without losing nicknames", async ({
  context,
  worker,
  extensionId,
  profilePath,
}) => {
  const {
    cursor: _newProvider,
    copilot: _copilot,
    ...legacyProviders
  } = emptyStore("legacy-keep-salt").providers;
  const legacy = {
    ...emptyStore("legacy-keep-salt"),
    providers: {
      ...legacyProviders,
      gemini: legacyProviders.claude,
      grok: legacyProviders.claude,
      perplexity: legacyProviders.claude,
    },
    version: 1,
    observationLedger: [],
    accounts: demoState().accounts,
  };
  legacy.accounts[0]!.alias = "Old work nickname";
  await worker.evaluate(async (legacy) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.deleteDatabase("mylimits-history");
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("History database still open"));
    });
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("mylimits-history", 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore("readings", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("account", "accountId");
        s.createIndex("time", "time");
      };
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("readings", "readwrite");
        tx.objectStore("readings").add({
          accountId: legacy.accounts[0]!.id,
          time: Date.now() - 3600000,
          meters: [{ id: "legacy-meter", usedPercent: 42 }],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ "mylimits:state:v1": legacy });
  }, legacy);
  await context.close();
  const reopened = await chromium.launchPersistentContext(profilePath, {
    ignoreDefaultArgs: ["--disable-extensions"],
    executablePath: process.env.CHROMIUM_PATH,
    channel: process.env.CHROMIUM_PATH ? undefined : "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-sandbox",
      "--disable-background-networking",
    ],
  });
  await reopened.route(/^https?:\/\//, (route) => route.abort());
  try {
    const restarted =
      reopened.serviceWorkers()[0] ??
      (await reopened.waitForEvent("serviceworker"));
    await expect
      .poll(async () =>
        restarted.evaluate(
          async () =>
            (await chrome.storage.local.get("mylimits:active-schema"))[
              "mylimits:active-schema"
            ],
        ),
      )
      .toBe(2);
    const saved = await restarted.evaluate(async () =>
      chrome.storage.local.get(["mylimits:state:v2", "mylimits:backup:v1"]),
    );
    const migrated = saved["mylimits:state:v2"] as Store;
    const backup = saved["mylimits:backup:v1"] as { version: number };
    expect(migrated.installSalt).toBe("legacy-keep-salt");
    expect(migrated.accounts[0]!.alias).toBe("Old work nickname");
    expect(backup.version).toBe(1);
    const page = await reopened.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    const history = await page.evaluate(
      async (id) =>
        chrome.runtime.sendMessage({ type: "history-page", accountId: id }),
      legacy.accounts[0]!.id,
    );
    expect(history.ok).toBe(true);
    expect(history.data.points[0].legacy).toBe(true);
    expect(history.data.points[0].meters[0].usedPercent).toBe(42);
    const forgotten = await page.evaluate(
      async (id) =>
        chrome.runtime.sendMessage({ type: "forget", accountId: id }),
      legacy.accounts[0]!.id,
    );
    expect(forgotten.ok).toBe(true);
    const backups = await restarted.evaluate(async () =>
      chrome.storage.local.get([
        "mylimits:state:v1",
        "mylimits:backup:v1",
        "mylimits:state:v2",
      ]),
    );
    expect(JSON.stringify(backups)).not.toContain("Old work nickname");
  } finally {
    await reopened.close();
  }
});

test("permitted fixture provider updates real history and prunes expired observations", async ({
  context,
  worker,
  extensionId,
}) => {
  await worker.evaluate(async () => {
    const original = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = async (p) =>
      p.origins?.includes("https://claude.ai/*") ? true : original(p);
    globalThis.fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      const value =
        path === "/api/account"
          ? { uuid: "fictional-user" }
          : path === "/api/organizations"
            ? [
                {
                  uuid: "fictional-org",
                  name: "Test team",
                  capabilities: ["chat"],
                },
              ]
            : {
                five_hour: {
                  utilization: 25,
                  resets_at: new Date(Date.now() + 3600000).toISOString(),
                },
              };
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("mylimits-history", 2);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("readings", "readwrite");
        tx.objectStore("readings").add({
          accountId: "expired",
          time: Date.now() - 31 * 86400000,
          meters: [],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
  });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const enabled = await page.evaluate(async () =>
    chrome.runtime.sendMessage({
      type: "enable",
      provider: "claude",
      enabled: true,
    }),
  );
  expect(enabled.ok).toBe(true);
  const account = enabled.data.accounts.find(
    (a: Account) => a.provider === "claude",
  );
  expect(account).toBeTruthy();
  const history = await page.evaluate(
    async (id) =>
      chrome.runtime.sendMessage({ type: "history-page", accountId: id }),
    account.id,
  );
  expect(
    history.data.points,
    JSON.stringify({
      issue: enabled.data.historyIssue,
      connections: enabled.data.connections,
    }),
  ).toHaveLength(1);
  expect(history.data.points[0].connectionId).toBe("website:claude");
  expect(history.data.points[0].meters[0].scope).toBe("subscription");
  const old = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: "history-page", accountId: "expired" }),
  );
  expect(old.data.points).toHaveLength(0);
  const wire = JSON.stringify(enabled.data);
  expect(wire).not.toContain("fictional-org");
  expect(wire).not.toContain("fictional-user");
  await worker.evaluate(async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const state = (await chrome.storage.local.get("mylimits:state:v2"))[
      "mylimits:state:v2"
    ] as Store;
    state.connections.find((c) => c.id === "website:claude")!.lastAttemptAt =
      null;
    await chrome.storage.local.set({ "mylimits:state:v2": state });
  });
  const offline = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: "refresh", provider: "claude" }),
  );
  expect(
    offline.data.connections.find(
      (c: { id: string }) => c.id === "website:claude",
    ).status,
  ).toBe("offline");
  expect(offline.data.accounts[0].updatedAt).toBe(account.updatedAt);
  const after = await page.evaluate(
    async (id) =>
      chrome.runtime.sendMessage({ type: "history-page", accountId: id }),
    account.id,
  );
  expect(after.data.points).toHaveLength(1);
});

test("shared views preserve dark theme, long names and keyboard focus at narrow layouts", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("layout-fixture"),
    accounts: demoState().accounts,
  };
  fixture.settings.theme = "dark";
  fixture.accounts[0]!.alias =
    "A long account nickname to verify narrow extension surfaces";
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  for (const [surface, width] of [
    ["dashboard", 1120],
    ["sidepanel", 360],
    ["popup", 440],
  ] as const) {
    await page.setViewportSize({ width, height: 600 });
    await page.goto(`chrome-extension://${extensionId}/${surface}.html`);
    if (surface === "popup") {
      await expect(
        page.getByRole("button", {
          name: `View ${fixture.accounts[0]!.alias} in full dashboard`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      continue;
    }
    const details = page.getByRole("button", {
      name: `Details for ${fixture.accounts[0]!.alias}`,
      exact: true,
    });
    await expect(details).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await details.focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(details).toBeFocused();
    // CSS zoom stresses layout only; this is not a Windows DPI certification.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".app")!.style.zoom = "1.25";
    });
    await expect(
      page.getByRole("button", { name: "Accounts", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Add Claude / Claude Code account",
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("history shows simple limit charts and persists 90-day retention", async ({
  context,
  worker,
  extensionId,
}) => {
  const now = Date.now(),
    fixture = emptyStore("history-insights-fixture");
  fixture.accounts = [{ ...demoState(now).accounts[0]!, connection: "active" }];
  const id = fixture.accounts[0]!.id;
  fixture.connections[0] = {
    ...fixture.connections[0]!,
    enabled: true,
    status: "active",
    accountId: id,
    lastAttemptAt: now,
    lastSuccessAt: now,
  };
  fixture.providers.claude = {
    ...fixture.providers.claude,
    enabled: true,
    status: "active",
    activeAccountId: id,
    checkedAt: now,
  };
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  await worker.evaluate(
    async ({ id, now }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("mylimits-history", 2);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("readings", "readwrite");
          for (let i = 0; i < 5; i++)
            tx.objectStore("readings").add({
              accountId: id,
              time: now - (4 - i) * 600000,
              connectionId: "website:claude",
              meters: [
                {
                  id: "session",
                  label: "Session",
                  scope: "subscription",
                  evidence: "reported",
                  unit: "percent",
                  usedPercent: 10 + i * 5,
                  resetsAt: now + 7200000,
                },
              ],
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { id, now },
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Session usage over time" }),
  ).toBeVisible();
  await expect(page.locator(".history-current strong")).toHaveText("30 % used");
  await expect(
    page.getByText(
      /At a similar pace:|observed segments|Reported reset timeline/,
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "90 days", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("History retention").selectOption("90");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText(/90-day local retention/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "90 days", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "90 days", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "90 days", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Guide is removed and its legacy link lands on Overview without prompt tools", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("removed-guide"),
    accounts: demoState().accounts,
  };
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#guide`);
  await expect(
    page.getByRole("button", { name: "Guide", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Prompt to review")).toHaveCount(0);
});

// Account setup is deliberately exercised through real extension messages and storage.
test("popup opens the selected account in the full dashboard and keeps six rows visible", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("compact-six"),
    accounts: demoState().accounts,
  };
  fixture.accounts.push({
    ...fixture.accounts[0]!,
    id: "sixth",
    alias: "Sixth account",
  });
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator(".quick-account")).toHaveCount(6);
  const bounds = await page.locator(".quick-popup").boundingBox();
  expect(bounds!.width).toBe(440);
  expect(bounds!.height).toBeLessThanOrEqual(560);
  expect(
    await page
      .locator(".quick-main")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
  ).toBe(true);
  const opened = context.waitForEvent("page");
  await page
    .getByRole("button", {
      name: "View GPT Work in full dashboard",
      exact: true,
    })
    .click();
  const dashboard = await opened;
  await expect(
    dashboard.getByRole("button", {
      name: "Details for GPT Work",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    dashboard.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    dashboard.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/compact-popup-six-accounts.png" });
});

test("minimal dashboard keeps limits first and advanced controls discoverable without changing saved accounts", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("minimal-ui"),
    accounts: demoState().accounts,
  };
  fixture.providers.claude.message =
    "Reconnect to refresh this browser account.";
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 1120, height: 920 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MyLimits");
  await expect(
    page.getByRole("button", { name: "Add account", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Sort limits")).toBeHidden();
  await expect(page.getByLabel("Filter provider")).toBeHidden();
  expect(
    (await page.locator(".account-summary").first().boundingBox())!.y,
  ).toBeLessThan(360);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/minimal-dashboard.png",
    fullPage: true,
  });
  await page.getByLabel("Search accounts").fill("GPT");
  await expect(page.locator(".account-row")).toHaveCount(3);
  const filters = page.locator(".overview-filters>summary");
  await filters.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Filter provider").selectOption("chatgpt");
  await page.getByLabel("Sort limits").selectOption("remaining");
  await expect(page.locator(".account-identity").first()).toHaveAccessibleName(
    "Details for GPT Work",
  );
  await filters.click();
  await expect(page.getByLabel("2 active filters")).toBeVisible();
  await expect(page.getByLabel("Sort limits")).toBeHidden();
  await page.getByRole("button", { name: "Low only", exact: true }).click();
  await expect(page.locator(".account-row")).toHaveCount(1);
  await expect(page.getByLabel("3 active filters")).toBeVisible();
  await filters.click();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Low only", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Filter provider")).toHaveValue("all");
  await expect(page.getByLabel("Sort limits")).toHaveValue("default");
  await page.getByLabel("Search accounts").fill("");
  await expect(page.locator(".account-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(
    page.getByText("Reconnect to refresh this browser account.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open website", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".website-top button")).toHaveCount(4);
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts).toEqual(fixture.accounts);
  expect(saved.connections).toEqual(fixture.connections);
});

test("provider picker lists only the retained services", async ({
  context,
  worker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
  for (const name of ["ChatGPT / Codex", "Claude / Claude Code", "Cursor"])
    await expect(
      page.getByRole("button", {
        name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      }),
    ).toBeVisible();
  expect(
    await page
      .locator(".connect-provider img")
      .evaluateAll((images) =>
        images.every(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await page
      .locator(".provider-mark")
      .first()
      .evaluate((e) => getComputedStyle(e).colorScheme),
  ).toBe("light");
  const darkPixels = await page
    .locator('img[src="/providers/chatgpt.svg"]')
    .evaluate((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d")!;
      context.drawImage(image as HTMLImageElement, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i]! < 100 &&
          pixels[i + 1]! < 100 &&
          pixels[i + 2]! < 100 &&
          pixels[i + 3]! > 128
        )
          count++;
      return count;
    });
  expect(darkPixels).toBeGreaterThan(20); // The adaptive official logo must not turn white on its light tile.
  await page.getByRole("button", { name: /Cursor/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Use current browser login",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts).toHaveLength(0);
});

test("larger account collections scroll inside the popup and search stays available", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("many-accounts"),
    accounts: demoState().accounts,
  };
  for (let i = 0; i < 5; i++)
    fixture.accounts.push({
      ...fixture.accounts[0]!,
      id: `extra-${i}`,
      alias: `Extra ${i}`,
    });
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator(".quick-account")).toHaveCount(10);
  expect(
    await page
      .locator(".quick-main")
      .evaluate((e) => e.scrollHeight > e.clientHeight),
  ).toBe(true);
  expect((await page.locator(".quick-footer").boundingBox())!.y).toBeLessThan(
    560,
  );
  await page.getByLabel("Search accounts").fill("Extra 3");
  await expect(page.locator(".quick-account")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "View Extra 3 in full dashboard",
      exact: true,
    }),
  ).toBeVisible();
});

test("popup plus opens dashboard setup and local genuine logos load without external requests", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = { ...emptyStore("v3-icons"), accounts: demoState().accounts };
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator(".quick-brand .mylimits-mark rect")).toHaveCount(3);
  await expect(page.locator(".quick-brand .mylimits-mark")).toHaveAttribute(
    "viewBox",
    "0 0 21 23",
  );
  await expect(page.locator(".provider-mark img")).toHaveCount(5);
  expect(
    await page
      .locator(".provider-mark img")
      .evaluateAll((imgs) =>
        imgs.every(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  expect(
    await page
      .locator(".quick-copy strong")
      .first()
      .evaluate((e) => getComputedStyle(e).fontSize),
  ).toBe("15px");
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const dashboard = await opened;
  await expect(dashboard.locator(".brand .mylimits-mark rect")).toHaveCount(3);
  await expect(
    dashboard.getByRole("region", { name: "Add an account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Add an account" }),
  ).toHaveCount(0);
});

test("large text persists, privacy masks every surface, and 200 percent enlargement retains controls", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("v3-layout-private"),
    accounts: demoState().accounts,
  };
  fixture.accounts[0]!.alias =
    "Private writing workspace with a very long account name";
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 1120, height: 920 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByLabel("Search accounts").fill(fixture.accounts[0]!.alias);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Text size", { exact: true }).selectOption("large");
  await page.getByLabel("Privacy mode", { exact: true }).selectOption("on");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByLabel("Search accounts")).toHaveValue("");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  await expect(page.getByLabel("Privacy mode", { exact: true })).toHaveValue(
    "on",
  );
  for (const tab of ["Overview", "Accounts", "History"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    for (const a of fixture.accounts)
      await expect(page.getByText(a.alias, { exact: false })).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByLabel("Search accounts")).toHaveValue("");
  await page
    .getByRole("button", { name: "Details for Account 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rename Account 1", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 560, height: 920 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
  const saved = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(saved.accounts[0]!.alias).toBe(fixture.accounts[0]!.alias);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    popup.getByRole("button", {
      name: "View Account 1 in full dashboard",
      exact: true,
    }),
  ).toBeVisible();
  await expect(popup.getByText(fixture.accounts[0]!.alias)).toHaveCount(0);
});

test.describe("current website account", () => {
  test.use({ grantedProviderOrigin: "https://claude.ai/*" });
  test("automatically retries persisted due authentication backoff when MyLimits opens, without a provider tab", async ({
    context,
    worker,
    extensionId,
  }) => {
    const store = emptyStore("fictional-c2-retry-salt");
    const connection = store.connections.find(
      (c) => c.id === "website:claude",
    )!;
    Object.assign(connection, {
      enabled: true,
      status: "needs-auth",
      lastAttemptAt: Date.now() - 20 * 60000,
      nextRetryAt: Date.now() - 60000,
      failures: 3,
    });
    Object.assign(store.providers.claude, {
      enabled: true,
      status: "signed-out",
      nextRetryAt: connection.nextRetryAt,
      failures: 3,
    });
    await worker.evaluate(async (store) => {
      const scope = globalThis as typeof globalThis & {
        fixtureRequestCount: number;
      };
      scope.fixtureRequestCount = 0;
      globalThis.fetch = async (input) => {
        scope.fixtureRequestCount++;
        const pathname = new URL(String(input)).pathname;
        const body =
          pathname === "/api/account"
            ? { uuid: "fictional-c2-user" }
            : pathname === "/api/organizations"
              ? [
                  {
                    uuid: "fictional-c2-workspace",
                    name: "Personal",
                    capabilities: ["chat"],
                  },
                ]
              : {
                  five_hour: {
                    utilization: 40,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };
      await chrome.storage.local.set({ "mylimits:state:v2": store });
    }, store);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const saved = (await chrome.storage.local.get("mylimits:state:v2"))[
            "mylimits:state:v2"
          ] as Store;
          return saved.connections.find((c) => c.id === "website:claude")!
            .status;
        }),
      )
      .toBe("active");
    const saved = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(
      saved.connections.find((c) => c.id === "website:claude"),
    ).toMatchObject({ failures: 0, nextRetryAt: null });
    expect(saved.accounts[0]!.meters[0]!.usedPercent).toBe(40);
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { fixtureRequestCount: number })
            .fixtureRequestCount,
      ),
    ).toBe(4);
    expect(
      await worker.evaluate(() =>
        chrome.tabs.query({ url: "https://claude.ai/*" }),
      ),
    ).toHaveLength(0);
  });
  test("uses existing tab without opening a replacement login", async ({
    context,
    extensionId,
  }) => {
    await context.route("https://claude.ai/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Fictional signed-in website</p>",
      }),
    );
    const existing = await context.newPage();
    await existing.goto("https://claude.ai/");
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
    await page.getByRole("button", { name: /Claude \/ Claude Code/ }).click();
    await page.evaluate(() => {
      chrome.permissions.request = async () => true;
    });
    const before = context.pages().length;
    await page
      .getByRole("button", { name: "Use current browser login", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Add an account" }),
    ).toHaveCount(0);
    expect(context.pages().length).toBe(before);
    expect(existing.url()).toBe("https://claude.ai/");
  });
});

test.describe("request diagnostics (fictional providers only)", () => {
  test.use({ grantedProviderOrigin: "https://claude.ai/*" });
  test("HTML 200 is a challenge, preserves HTTP status, and never creates a fabricated quota", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response("<html>PRIVATE_CHALLENGE_BODY</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "enable",
        provider: "claude",
        enabled: true,
      }),
    );
    const store = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(store.accounts).toHaveLength(0);
    expect(
      store.connections.find((c) => c.id === "website:claude"),
      JSON.stringify(store.connections),
    ).toMatchObject({ status: "needs-tab", lastSuccessAt: null });
    const diagnostic = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(diagnostic.data.entries[0]).toMatchObject({
      status: 200,
      contentType: "text/html",
      pageFallbackRan: true,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("PRIVATE_CHALLENGE_BODY");
  });
  test("declining optional cookie access keeps an explicit site-only connection path", async ({
    context,
    worker,
    extensionId,
  }) => {
    await context.route("https://claude.ai/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Fictional provider</p>",
      }),
    );
    const website = await context.newPage();
    await website.goto("https://claude.ai/");
    await worker.evaluate(() => {
      globalThis.fetch = async (input) => {
        const pathname = new URL(String(input)).pathname;
        const body =
          pathname === "/api/account"
            ? { uuid: "fictional-denied-cookie-user" }
            : pathname === "/api/organizations"
              ? [
                  {
                    uuid: "fictional-denied-cookie-workspace",
                    name: "Personal",
                    capabilities: ["chat"],
                  },
                ]
              : {
                  five_hour: {
                    utilization: 10,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      };
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
    await page.evaluate(() => {
      const scope = window as typeof window & { permissionRequests: unknown[] };
      scope.permissionRequests = [];
      chrome.permissions.request = async (request) => {
        scope.permissionRequests.push(request);
        return !request.permissions?.includes("cookies");
      };
      chrome.permissions.contains = async () => false;
    });
    await page.getByRole("button", { name: /Claude \/ Claude Code/ }).click();
    await page
      .getByRole("button", { name: "Use current browser login", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Continue without sign-in detection",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Choose a different service", exact: true })
      .click();
    await page.getByRole("button", { name: /^Cursor/ }).click();
    await expect(
      page.getByRole("button", {
        name: "Continue without sign-in detection",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Choose a different service", exact: true })
      .click();
    await page.getByRole("button", { name: /Claude \/ Claude Code/ }).click();
    await page
      .getByRole("button", { name: "Use current browser login", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Continue without sign-in detection",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Details for Claude account 1",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { permissionRequests: unknown[] })
            .permissionRequests,
      ),
    ).toEqual([
      { origins: ["https://claude.ai/*"], permissions: ["cookies"] },
      { origins: ["https://claude.ai/*"], permissions: ["cookies"] },
      { origins: ["https://claude.ai/*"] },
    ]);
  });
  test("records no-tab rejection and copies redacted request metadata from Settings", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response("BODY_SECRET", {
          status: 403,
          headers: {
            "content-type": "text/html; secret=HEADER_SECRET",
            "cf-mitigated": "challenge",
            "retry-after": "120",
            "set-cookie": "sessionKey=COOKIE_SECRET",
          },
        });
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    expect(
      (
        await page.evaluate(() =>
          chrome.runtime.sendMessage({
            type: "enable",
            provider: "claude",
            enabled: true,
          }),
        )
      ).ok,
    ).toBe(true);
    const response = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(response.ok).toBe(true);
    expect(response.data.entries).toMatchObject([
      {
        provider: "claude",
        path: "/api/account",
        transport: "background",
        status: 403,
        contentType: "text/html",
        cfMitigated: "challenge",
        retryAfter: "120",
        pageFallbackRan: true,
        tabAvailable: false,
        sessionCookieState: "unknown",
      },
      {
        provider: "claude",
        path: "/api/account",
        transport: "page",
        status: 0,
        pageFallbackRan: true,
        tabAvailable: false,
      },
    ]);
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async (value: string) => {
          (
            window as typeof window & { copiedDiagnostics: string }
          ).copiedDiagnostics = value;
        },
      });
    });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Copy safe diagnostics", exact: true })
      .click();
    await expect(
      page.getByText("Diagnostics copied.", { exact: true }),
    ).toBeVisible();
    const copied = await page.evaluate(
      () =>
        (window as typeof window & { copiedDiagnostics: string })
          .copiedDiagnostics,
    );
    expect(JSON.parse(copied).requests.entries).toHaveLength(2);
    for (const secret of [
      "BODY_SECRET",
      "HEADER_SECRET",
      "COOKIE_SECRET",
      "set-cookie",
    ])
      expect(copied).not.toContain(secret);
    const local = await worker.evaluate(() => chrome.storage.local.get(null));
    expect(JSON.stringify(local)).not.toContain("request-diagnostics");
    const session = await worker.evaluate(() =>
      chrome.storage.session.get("mylimits:request-diagnostics:v1"),
    );
    expect(session["mylimits:request-diagnostics:v1"]).toHaveLength(2);
  });
  test("page fallback retains safe response metadata, hides workspace identity, and denies website reads", async ({
    context,
    worker,
    extensionId,
  }) => {
    await context.route("https://claude.ai/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Fictional provider</p>",
      }),
    );
    const website = await context.newPage();
    await website.goto("https://claude.ai/");
    await website.evaluate(() => {
      window.fetch = async (input) => {
        const pathname = new URL(String(input)).pathname;
        const body =
          pathname === "/api/account"
            ? { uuid: "ACCOUNT_SECRET", accessToken: "TOKEN_SECRET" }
            : pathname === "/api/organizations"
              ? [
                  {
                    uuid: "WORKSPACE_SECRET",
                    name: "PRIVATE_NAME",
                    capabilities: ["chat"],
                  },
                ]
              : {
                  five_hour: {
                    utilization: 25,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "set-cookie": "sessionKey=COOKIE_SECRET",
          },
        });
      };
    });
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(null, {
          status: 403,
          headers: { "content-type": "text/html", "cf-mitigated": "challenge" },
        });
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    expect(
      (
        await page.evaluate(() =>
          chrome.runtime.sendMessage({
            type: "enable",
            provider: "claude",
            enabled: true,
          }),
        )
      ).ok,
    ).toBe(true);
    const response = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(response.ok).toBe(true);
    expect(response.data.entries).toHaveLength(8);
    expect(
      response.data.entries.filter(
        (e: { transport: string }) => e.transport === "page",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/api/organizations/:organization/usage",
          status: 200,
          contentType: "application/json",
          tabAvailable: true,
          pageFallbackRan: true,
        }),
      ]),
    );
    for (const secret of [
      "ACCOUNT_SECRET",
      "WORKSPACE_SECRET",
      "PRIVATE_NAME",
      "TOKEN_SECRET",
      "COOKIE_SECRET",
    ])
      expect(JSON.stringify(response)).not.toContain(secret);
    const saved = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(saved.accounts[0]!.meters[0]!.usedPercent).toBe(25);
    const denied = await worker.evaluate(async () => {
      const tab = (await chrome.tabs.query({ url: "https://claude.ai/*" }))[0]!;
      return (
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () =>
            chrome.runtime.sendMessage({ type: "request-diagnostics" }),
        })
      )[0]!.result;
    });
    expect(denied.ok).toBe(false);
  });
});

test.describe("optional cookie signals (fictional cookies and provider)", () => {
  test.use({
    grantedProviderOrigin: "https://claude.ai/*",
    grantedCookieAccess: true,
  });
  test("a normal-store sign-in cookie recovers only failed tracking and never enters diagnostics as a value", async ({
    context,
    worker,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    const store = emptyStore("fictional-c3-cookie-salt");
    Object.assign(store.connections.find((c) => c.id === "website:claude")!, {
      enabled: true,
      status: "needs-auth",
      lastAttemptAt: Date.now() - 60000,
      nextRetryAt: Date.now() + 3600000,
    });
    Object.assign(store.providers.claude, {
      enabled: true,
      status: "signed-out",
    });
    await worker.evaluate(async (store) => {
      const scope = globalThis as typeof globalThis & {
        fixtureRequestCount: number;
      };
      scope.fixtureRequestCount = 0;
      globalThis.fetch = async (input) => {
        scope.fixtureRequestCount++;
        const pathname = new URL(String(input)).pathname;
        const body =
          pathname === "/api/account"
            ? { uuid: "fictional-cookie-user" }
            : pathname === "/api/organizations"
              ? [
                  {
                    uuid: "fictional-cookie-workspace",
                    name: "Personal",
                    capabilities: ["chat"],
                  },
                ]
              : {
                  five_hour: {
                    utilization: 15,
                    resets_at: "2030-01-01T00:00:00Z",
                  },
                };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      };
      await chrome.storage.local.set({ "mylimits:state:v2": store });
      await chrome.cookies.set({
        url: "https://claude.ai",
        name: "sessionKey",
        value: "FICTIONAL_COOKIE_VALUE",
        secure: true,
      });
    }, store);
    await expect
      .poll(
        () =>
          worker.evaluate(async () => {
            const saved = (await chrome.storage.local.get("mylimits:state:v2"))[
              "mylimits:state:v2"
            ] as Store;
            return saved.connections.find((c) => c.id === "website:claude")!
              .status;
          }),
        { timeout: 10000 },
      )
      .toBe("active");
    const diagnostic = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(diagnostic.data.entries[0]).toMatchObject({
      sessionCookieState: "present",
      cookieNames: ["sessionKey"],
    });
    expect(JSON.stringify(diagnostic)).not.toContain("FICTIONAL_COOKIE_VALUE");
    expect(
      JSON.stringify(
        await worker.evaluate(() => chrome.storage.local.get(null)),
      ),
    ).not.toContain("FICTIONAL_COOKIE_VALUE");
    const before = await worker.evaluate(
      () =>
        (globalThis as typeof globalThis & { fixtureRequestCount: number })
          .fixtureRequestCount,
    );
    await worker.evaluate(() =>
      chrome.cookies.set({
        url: "https://claude.ai",
        name: "sessionKey",
        value: "FICTIONAL_ROLLING_VALUE",
        secure: true,
      }),
    );
    await page.waitForTimeout(2300);
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { fixtureRequestCount: number })
            .fixtureRequestCount,
      ),
    ).toBe(before);
  });
});

test("U1 first load deletes retired provider/source history and keys while retaining the website account", async ({
  context,
  worker,
  extensionId,
  profilePath,
}) => {
  await expect
    .poll(() =>
      worker.evaluate(
        async () =>
          (await chrome.storage.local.get("mylimits:u1-completed:v1"))[
            "mylimits:u1-completed:v1"
          ],
      ),
    )
    .toBe(true);
  const fixture = {
    ...emptyStore("u1-real-storage"),
    accounts: [demoState().accounts[0]!],
  };
  await worker.evaluate(async (s) => {
    const kept = s.accounts[0]!,
      retired = { ...kept, id: "retired-old", provider: "gemini" },
      remote = { ...kept, id: "retired-cloud" };
    const raw = {
      ...s,
      accounts: [kept, retired, remote],
      connections: [
        ...s.connections,
        {
          ...s.connections[0],
          id: "cloud:old",
          kind: "cloud",
          accountId: remote.id,
        },
      ],
      providers: { ...s.providers, gemini: s.providers.claude },
    };
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("mylimits-history", 2);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("readings", "readwrite");
        for (const id of [kept.id, retired.id, remote.id])
          tx.objectStore("readings").add({
            accountId: id,
            time: Date.now(),
            schemaVersion: 2,
            observedAt: Date.now(),
            receivedAt: Date.now(),
            connectionId: id === remote.id ? "cloud:old" : "website:claude",
            meters: [],
          });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    await chrome.storage.local.remove("mylimits:u1-completed:v1");
    await chrome.storage.local.set({
      "mylimits:state:v2": raw,
      "mylimits:widget:v1": {},
      "mylimits:sync:private:v1": {},
      "mylimits:hosted:attempt:v1": {},
    });
  }, fixture);
  await context.close();
  const reopened = await chromium.launchPersistentContext(profilePath, {
    ignoreDefaultArgs: ["--disable-extensions"],
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-sandbox",
      "--disable-background-networking",
    ],
  });
  await reopened.route(/^https?:\/\//, (route) => route.abort());
  try {
    const w =
      reopened.serviceWorkers()[0] ??
      (await reopened.waitForEvent("serviceworker"));
    await expect
      .poll(() =>
        w.evaluate(
          async () =>
            (await chrome.storage.local.get("mylimits:u1-completed:v1"))[
              "mylimits:u1-completed:v1"
            ],
        ),
      )
      .toBe(true);
    const result = await w.evaluate(async () => {
      const storage = await chrome.storage.local.get(null),
        s = storage["mylimits:state:v2"] as Store;
      const rows = await new Promise<{ accountId: string }[]>(
        (resolve, reject) => {
          const r = indexedDB.open("mylimits-history", 2);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction("readings"),
              get = tx.objectStore("readings").getAll();
            get.onsuccess = () => resolve(get.result);
            tx.oncomplete = () => db.close();
            tx.onerror = () => reject(tx.error);
          };
        },
      );
      return {
        accounts: s.accounts,
        rows,
        keys: Object.keys(storage),
        version: s.version,
      };
    });
    expect(result.version).toBe(2);
    expect(result.accounts).toEqual(fixture.accounts);
    expect(result.rows.map((r) => r.accountId)).toEqual([
      fixture.accounts[0]!.id,
    ]);
    for (const key of [
      "mylimits:widget:v1",
      "mylimits:sync:private:v1",
      "mylimits:hosted:attempt:v1",
    ])
      expect(result.keys).not.toContain(key);
  } finally {
    await reopened.close();
  }
});

test("website A B A is remembered automatically with separate cards and real history only", async ({
  context,
  worker,
  extensionId,
}) => {
  await worker.evaluate(() => {
    const state = globalThis as typeof globalThis & { switchIdentity: string };
    state.switchIdentity = "A";
    const contains = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = async (p) =>
      p.origins?.includes("https://cursor.com/*") ? true : contains(p);
    globalThis.fetch = async (input) =>
      new Response(
        JSON.stringify(
          new URL(String(input)).pathname === "/api/auth/me"
            ? { sub: state.switchIdentity }
            : {
                individualUsage: {
                  plan: {
                    autoPercentUsed: state.switchIdentity === "A" ? 30 : 80,
                  },
                },
              },
        ),
        { headers: { "content-type": "application/json" } },
      );
  });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "enable",
      provider: "cursor",
      enabled: true,
    }),
  );
  await expect(
    page.getByRole("button", {
      name: "Details for Cursor account 1",
      exact: true,
    }),
  ).toBeVisible();
  for (const identity of ["B", "A"]) {
    await worker.evaluate(async (identity) => {
      (
        globalThis as typeof globalThis & { switchIdentity: string }
      ).switchIdentity = identity;
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      s.connections.find((c) => c.id === "website:cursor")!.lastAttemptAt =
        null;
      await chrome.storage.local.set({ "mylimits:state:v2": s });
    }, identity);
    expect(
      (
        await page.evaluate(() =>
          chrome.runtime.sendMessage({ type: "refresh", provider: "cursor" }),
        )
      ).ok,
    ).toBe(true);
  }
  const s = await worker.evaluate(
    async () =>
      (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store,
  );
  expect(s.accounts).toHaveLength(2);
  expect(
    s.accounts.find((a) => a.defaultName === "Cursor account 1")!.connection,
  ).toBe("active");
  expect(
    s.accounts.find((a) => a.defaultName === "Cursor account 2")!.connection,
  ).toBe("inactive");
  await expect(
    page.getByRole("button", { name: "Save detected account" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Remembered · last checked/)).toBeVisible();
  await worker.evaluate(async () => {
    const saved = (await chrome.storage.local.get("mylimits:state:v2"))[
      "mylimits:state:v2"
    ] as Store;
    const b = saved.accounts.find((a) => a.defaultName === "Cursor account 2")!;
    b.meters[0]!.resetsAt = Date.now() - 1000;
    await chrome.storage.local.set({ "mylimits:state:v2": saved });
  });
  await expect(
    page.getByText("Projected · Reset · full limit available", { exact: true }),
  ).toBeVisible();
  const history = await page.evaluate(
    async (id) =>
      chrome.runtime.sendMessage({ type: "history-page", accountId: id }),
    s.accounts[0]!.id,
  );
  expect(
    history.data.points.every((p: { meters: { evidence: string }[] }) =>
      p.meters.every((m) => m.evidence === "reported"),
    ),
  ).toBe(true);
});

test.describe("Copilot official API token connections (simulated)", () => {
  test.use({ grantedProviderOrigin: "https://api.github.com/*" });
  test("connect two accounts, select allowance, preserve encrypted tokens and delete one independently", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      globalThis.fetch = async (input, options) => {
        const url = new URL(String(input));
        if (url.origin !== "https://api.github.com")
          throw Error("Fixture blocks other network");
        const headers = new Headers(options?.headers),
          id = headers.get("Authorization")?.endsWith("SECOND") ? 2 : 1;
        if (
          options?.credentials !== "omit" ||
          headers.get("X-GitHub-Api-Version") !== "2026-03-10"
        )
          throw Error("Invalid REST transport");
        const login = id === 1 ? "alice" : "bob";
        const offset =
          (globalThis as typeof globalThis & { copilotUsageOffset?: number })
            .copilotUsageOffset ?? 0;
        return new Response(
          JSON.stringify(
            url.pathname === "/user"
              ? { id, login }
              : {
                  user: login,
                  timePeriod: {
                    year: new Date().getUTCFullYear(),
                    month: new Date().getUTCMonth() + 1,
                  },
                  usageItems: url.pathname.includes("/ai_credit/")
                    ? []
                    : [
                        {
                          product: "Copilot",
                          unitType: "requests",
                          grossQuantity: id * 20 + offset,
                          netQuantity: 0,
                        },
                      ],
                },
          ),
        );
      };
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
    async function add(token: string, chooseProvider = true) {
      if (chooseProvider)
        await page
          .getByRole("button", { name: "GitHub Copilot", exact: false })
          .click();
      await page.getByLabel("Fine-grained personal access token").fill(token);
      await page
        .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "GitHub Copilot", exact: true }),
      ).toHaveCount(0);
    }
    const token = "github_pat_FICTIONAL_BROWSER_SECRET_FIRST";
    await add(token);
    await page
      .locator(".overview-tools")
      .getByRole("button", { name: "Add another GitHub account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Add another GitHub account",
        exact: true,
      }),
    ).toBeVisible();
    await add(token + "SECOND", false);
    await expect(page.locator(".account-row")).toHaveCount(2);
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await expect(
      page.locator('.account-row img[src$="/copilot.svg"]').first(),
    ).toHaveCSS("filter", "none");
    expect(
      await page
        .locator('.account-row img[src$="/copilot.svg"]')
        .first()
        .evaluate(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
    ).toBe(true);
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "light"),
    );
    await expect(
      page.locator('.account-row img[src$="/copilot.svg"]').first(),
    ).toHaveCSS("filter", "none");
    const sourceId = await worker.evaluate(async () => {
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      const c = s.connections.find((c) => c.kind === "copilot")!;
      c.lastAttemptAt = Date.now() - 900001;
      (
        globalThis as typeof globalThis & { copilotUsageOffset: number }
      ).copilotUsageOffset = 5;
      await chrome.storage.local.set({ "mylimits:state:v2": s });
      return c.id;
    });
    expect(
      (
        await page.evaluate(
          async (id) =>
            chrome.runtime.sendMessage({ type: "refresh", connectionId: id }),
          sourceId,
        )
      ).ok,
    ).toBe(true);
    const refreshed = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    expect(
      refreshed.accounts.find((a) => a.defaultName.includes("alice"))!
        .meters[0]!.used,
    ).toBe(25);
    expect(
      refreshed.accounts.find((a) => a.defaultName.includes("bob"))!.meters[0]!
        .used,
    ).toBe(40);
    await page
      .getByRole("button", { name: "Details for GitHub Copilot · alice" })
      .click();
    await page.getByLabel("Legacy request allowance").selectOption("Pro");
    await page
      .getByRole("button", { name: "Save allowance", exact: true })
      .click();
    await expect(page.locator(".account-detail")).toContainText(
      "25 / 300 used",
    );
    const stored = await worker.evaluate(
      async () =>
        await chrome.storage.local.get([
          "mylimits:state:v2",
          "mylimits:tokens:v1",
        ]),
    );
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(Object.keys(stored["mylimits:tokens:v1"] as object)).toHaveLength(2);
    const publicState = await page.evaluate(
      async () => await chrome.runtime.sendMessage({ type: "state" }),
    );
    expect(JSON.stringify(publicState)).not.toContain(token);
    const diag = await page.evaluate(
      async () =>
        await chrome.runtime.sendMessage({ type: "request-diagnostics" }),
    );
    expect(JSON.stringify(diag)).not.toContain(token);
    await page
      .locator(".account-detail")
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect
      .poll(async () =>
        worker.evaluate(
          async () =>
            Object.keys(
              (await chrome.storage.local.get("mylimits:tokens:v1"))[
                "mylimits:tokens:v1"
              ] as object,
            ).length,
        ),
      )
      .toBe(1);
    await expect(page.locator(".account-row")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Details for GitHub Copilot · bob" })
      .click();
    await page
      .getByRole("button", { name: "Forget saved account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm forget", exact: true })
      .click();
    await expect(page.locator(".account-row")).toHaveCount(1);
    await expect
      .poll(async () =>
        worker.evaluate(
          async () =>
            Object.keys(
              (await chrome.storage.local.get("mylimits:tokens:v1"))[
                "mylimits:tokens:v1"
              ] as object,
            ).length,
        ),
      )
      .toBe(0);
  });
});

async function seedHistoryDesign(worker: Worker) {
  const now = Date.now(),
    fixture = emptyStore("history-design");
  fixture.accounts = demoState(now).accounts.slice(0, 2);
  fixture.accounts[0]!.alias = "Personal";
  fixture.accounts[1]!.alias = "Work";
  await worker.evaluate(
    async ({ fixture, now }) => {
      await chrome.storage.local.set({ "mylimits:state:v2": fixture });
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("mylimits-history", 2);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("readings", "readwrite"),
            s = tx.objectStore("readings");
          for (let i = 0; i < 72; i++) {
            if (i >= 40 && i <= 46) continue;
            const time = now - (71 - i) * 300000;
            s.add({
              accountId: fixture.accounts[0]!.id,
              time,
              connectionId: "PRIVATE_CONNECTION_ID",
              workspaceId: "PRIVATE_WORKSPACE",
              meters: [
                {
                  id: "session",
                  label: "5-hour limit",
                  scope: "subscription",
                  evidence: "reported",
                  unit: "percent",
                  usedPercent: i < 36 ? 15 + i * 2 : 5 + ((i - 36) * 57) / 35,
                  resetsAt: i < 36 ? now - 10800000 : now + 10800000,
                  source: "PRIVATE_SOURCE",
                },
                {
                  id: "weekly",
                  label: "Weekly limit",
                  scope: "subscription",
                  evidence: "reported",
                  unit: "percent",
                  usedPercent: 25 + i * 0.4,
                  resetsAt: now + 172800000,
                  source: "PRIVATE_SOURCE",
                },
              ],
            });
          }
          for (let i = 0; i < 13; i++)
            s.add({
              accountId: fixture.accounts[1]!.id,
              time: now - (12 - i) * 600000,
              connectionId: "WORK_CONNECTION",
              meters: [
                {
                  id: "session",
                  label: "5-hour limit",
                  scope: "work-codex",
                  evidence: "reported",
                  unit: "percent",
                  usedPercent: 33 + i * 2.5,
                  resetsAt: now + 7200000,
                  source: "PRIVATE_SOURCE",
                },
              ],
            });
          for (const [days, value] of [
            [2, 88],
            [20, 95],
          ])
            s.add({
              accountId: fixture.accounts[0]!.id,
              time: now - days! * 86400000,
              connectionId: "PRIVATE_CONNECTION_ID",
              meters: [
                {
                  id: "session",
                  label: "5-hour limit",
                  scope: "subscription",
                  evidence: "reported",
                  unit: "percent",
                  usedPercent: value,
                  resetsAt: now - days! * 86400000 + 3600000,
                },
              ],
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      });
    },
    { fixture, now },
  );
  return { fixture, now };
}
test("History groups accounts, filters ranges, exposes tooltips and reset lines, and hides technical fields", async ({
  context,
  worker,
  extensionId,
}) => {
  const { fixture } = await seedHistoryDesign(worker),
    page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#history`);
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("How much of each limit you used over time."),
  ).toBeVisible();
  await expect(page.getByLabel("History account")).toHaveValue("");
  await expect(page.locator(".history-account")).toHaveCount(2);
  await page.getByRole("button", { name: "24 h", exact: true }).click();
  const personal = page.locator(".history-account").filter({
    has: page.getByRole("heading", { name: "Personal", exact: true }),
  });
  await expect(personal.locator(".history-limit")).toHaveCount(2);
  await expect(personal.locator(".history-current strong").first()).toHaveText(
    "62 % used",
  );
  await expect(personal.locator(".history-reset")).toHaveCount(1);
  const chart = personal.getByRole("group", {
    name: "5-hour limit usage over time",
  });
  expect(
    (await chart.locator(".history-axis").allTextContents()).slice(0, 3),
  ).toEqual(["0%", "50%", "100%"]);
  expect(await chart.locator("polyline").count()).toBeGreaterThanOrEqual(3);
  const dot = chart.getByRole("button", { name: /62 % used$/ });
  await dot.hover();
  await expect(personal.getByRole("tooltip")).toContainText("62 % used");
  await expect(personal.getByRole("tooltip").locator("time")).not.toBeEmpty();
  await dot.focus();
  await expect(personal.getByRole("tooltip")).toBeVisible();
  await dot.press("Escape");
  await expect(personal.getByRole("tooltip")).toHaveCount(0);
  await page.getByText("Show all readings", { exact: true }).click();
  await expect(page.locator(".history-table th")).toHaveText([
    "Time",
    "Account",
    "Limit",
    "Used",
  ]);
  await expect(page.locator(".history-table")).not.toContainText("88 % used");
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load older readings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load older readings" }).click();
  await expect(page.locator(".history-table")).toContainText("88 % used");
  await expect(page.locator(".history-table")).not.toContainText("95 % used");
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load older readings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load older readings" }).click();
  await expect(page.locator(".history-table")).toContainText("95 % used");
  await page
    .getByLabel("History account")
    .selectOption(fixture.accounts[1]!.id);
  await expect(page.locator(".history-account")).toHaveCount(1);
  await expect(page.locator(".history-account h3")).toHaveText("Work");
  const text = await page.locator(".history-panel").innerText();
  for (const hidden of [
    "connectionId",
    "scope",
    "evidence",
    "sample counts",
    "observed segments",
    "PRIVATE_CONNECTION_ID",
    "PRIVATE_SOURCE",
    "PRIVATE_WORKSPACE",
    "WORK_CONNECTION",
    "work-codex",
    "subscription",
  ])
    expect(text).not.toContain(hidden);
  await expect(page.getByLabel("History from")).toHaveCount(0);
  await expect(page.getByLabel("Compare history account")).toHaveCount(0);
  await expect(page.getByLabel("History window")).toHaveCount(0);
});
test("History downloads the selected range through existing commands and manages clearing separately", async ({
  context,
  worker,
  extensionId,
}) => {
  const { fixture } = await seedHistoryDesign(worker),
    page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#history`);
  await page.getByRole("button", { name: "24 h", exact: true }).click();
  await expect(page.locator(".history-account")).toHaveCount(2);
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "CSV (Excel)", exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "JSON", exact: true }).click();
  const file = await downloading;
  const json = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(
    new Set(json.readings.map((r: { accountId: string }) => r.accountId)).size,
  ).toBe(2);
  expect(
    json.readings.every(
      (r: { time: number }) => Date.now() - r.time <= 86405000,
    ),
  ).toBe(true);
  await page
    .getByLabel("History account")
    .selectOption(fixture.accounts[1]!.id);
  await expect(page.locator(".history-account")).toHaveCount(1);
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Clear history", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".history-account")).toHaveCount(1);
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm clear history", exact: true })
    .click();
  await expect(
    page.getByText("No readings yet. They appear after the first refresh."),
  ).toBeVisible();
  await page
    .getByLabel("History account")
    .selectOption(fixture.accounts[0]!.id);
  await expect(page.locator(".history-account")).toHaveCount(1);
});
test("History is readable in both themes at 360px, supports tap and records after screenshots", async ({
  context,
  worker,
  extensionId,
}) => {
  await seedHistoryDesign(worker);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#history`);
  await page.getByRole("button", { name: "24 h", exact: true }).click();
  await expect(page.locator(".history-account")).toHaveCount(2);
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.screenshot({
    path: "artifacts/history-after-light.png",
    fullPage: true,
  });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.screenshot({
    path: "artifacts/history-after-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeVisible();
  const dot = page.locator(".history-hit").first();
  await dot.dispatchEvent("click");
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.screenshot({
    path: "artifacts/history-after-360px.png",
    fullPage: true,
  });
  await page.getByText("Show all readings", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("History keeps unknown percentages unknown and masks account names when privacy is enabled", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = emptyStore("unknown-history"),
    now = Date.now();
  fixture.accounts = demoState(now).accounts.slice(0, 1);
  fixture.accounts[0]!.alias = "Sensitive account";
  await worker.evaluate(
    async ({ fixture, now }) => {
      await chrome.storage.local.set({ "mylimits:state:v2": fixture });
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("mylimits-history", 2);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("readings", "readwrite");
          tx.objectStore("readings").add({
            accountId: fixture.accounts[0]!.id,
            time: now,
            meters: [
              {
                id: "premium",
                label: "Premium requests",
                usedPercent: null,
                used: 20,
                total: null,
                unit: "requests",
                scope: "subscription",
                evidence: "reported",
                resetsAt: null,
              },
            ],
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      });
    },
    { fixture, now },
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#history`);
  await expect(page.locator(".history-current strong")).toHaveText("20 used");
  await expect(
    page.getByText("Usage percentage unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-hit")).toHaveCount(0);
  await expect(page.locator(".history-current")).toContainText(
    "Reset not reported",
  );
  await worker.evaluate(async () => {
    const s = (await chrome.storage.local.get("mylimits:state:v2"))[
      "mylimits:state:v2"
    ] as Store;
    s.settings.privacyMode = true;
    await chrome.storage.local.set({ "mylimits:state:v2": s });
  });
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("History account")).not.toContainText(
    "Sensitive account",
  );
  await expect(page.locator(".history-account")).toHaveCount(0);
  await expect(
    page.getByText("Turn privacy mode off to view or export history."),
  ).toBeVisible();
});

test.describe("Copilot add-another shortcut and account identity (simulated)", () => {
  test.use({ grantedProviderOrigin: "https://api.github.com/*" });
  test("popup opens a new-token flow; a duplicate stays an error and another identity adds its own card", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      globalThis.fetch = async (input, options) => {
        const url = new URL(String(input));
        if (url.origin !== "https://api.github.com")
          throw Error("Fixture blocks other network");
        const second = new Headers(options?.headers)
            .get("Authorization")
            ?.endsWith("SECOND"),
          id = second ? 2 : 1,
          login = second ? "bob" : "alice";
        return new Response(
          JSON.stringify(
            url.pathname === "/user"
              ? { id, login }
              : {
                  user: login,
                  timePeriod: {
                    year: new Date().getUTCFullYear(),
                    month: new Date().getUTCMonth() + 1,
                  },
                  usageItems: url.pathname.includes("/ai_credit/")
                    ? []
                    : [
                        {
                          product: "Copilot",
                          unitType: "requests",
                          grossQuantity: id * 10,
                        },
                      ],
                },
          ),
        );
      };
    });
    const token = "github_pat_FICTIONAL_COPILOT_ADD_ACCOUNT";
    const first = await context.newPage();
    await first.goto(
      `chrome-extension://${extensionId}/dashboard.html#add-copilot`,
    );
    await first.getByLabel("Fine-grained personal access token").fill(token);
    await first
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    await expect(first.locator(".account-row")).toHaveCount(1);
    const before = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(
      popup.getByRole("button", {
        name: "Add another GitHub account",
        exact: true,
      }),
    ).toBeVisible();
    const opened = context.waitForEvent("page");
    await popup
      .getByRole("button", { name: "Add another GitHub account", exact: true })
      .click();
    const page = await opened;
    await expect(page).toHaveURL(/dashboard\.html#add-copilot$/);
    await expect(
      page.getByRole("heading", {
        name: "Add another GitHub account",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Fine-grained personal access token")
      .fill(token + "DUPLICATE");
    await page
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("already connected");
    await expect(
      page.getByLabel("Fine-grained personal access token"),
    ).toHaveValue("");
    const duplicate = await worker.evaluate(
      async () =>
        await chrome.storage.local.get([
          "mylimits:state:v2",
          "mylimits:tokens:v1",
        ]),
    );
    expect((duplicate["mylimits:state:v2"] as Store).accounts).toEqual(
      before.accounts,
    );
    expect(Object.keys(duplicate["mylimits:tokens:v1"] as object)).toHaveLength(
      1,
    );
    expect(JSON.stringify(duplicate)).not.toContain(token);
    await page
      .getByLabel("Fine-grained personal access token")
      .fill(token + "SECOND");
    await page
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    await expect(page.locator(".account-row")).toHaveCount(2);
    const after = await worker.evaluate(
      async () =>
        (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store,
    );
    const a = after.connections.find(
      (c) => c.id === before.connections.find((c) => c.kind === "copilot")!.id,
    )!;
    expect(a.accountId).toBe(before.accounts[0]!.id);
    expect(after.accounts.find((x) => x.id === a.accountId)!.meters).toEqual(
      before.accounts[0]!.meters,
    );
    expect(
      new Set(
        after.connections
          .filter((c) => c.kind === "copilot")
          .map((c) => c.accountId),
      ).size,
    ).toBe(2);
    await page.emulateMedia({ colorScheme: "dark" });
    for (const theme of ["light", "dark", "system"]) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await expect(page.locator('img[src$="/copilot.svg"]').first()).toHaveCSS(
        "filter",
        "none",
      );
      await expect(page.locator(".provider-mark").first()).toHaveCSS(
        "background-color",
        "rgb(247, 248, 247)",
      );
    }
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await page.screenshot({
      path: "artifacts/copilot-multiple-accounts-dark.png",
      fullPage: true,
    });
    const side = await context.newPage(),
      fromSide = context.waitForEvent("page");
    await side.goto(
      `chrome-extension://${extensionId}/sidepanel.html#add-copilot`,
    );
    const sideSetup = await fromSide;
    await expect(sideSetup).toHaveURL(/dashboard\.html#add-copilot$/);
    await expect(
      sideSetup.getByLabel("Fine-grained personal access token"),
    ).toBeVisible();
    await sideSetup.close();
    await side.close();
    await page
      .getByRole("button", { name: "Details for GitHub Copilot · alice" })
      .click();
    await page
      .locator(".account-detail")
      .getByRole("button", { name: "Add another GitHub account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Add another GitHub account",
        exact: true,
      }),
    ).toBeVisible();
  });
});

test("U5 one toolbar choice replaces the previous limit, persists, and privacy hides tooltip names", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = {
    ...emptyStore("u5-badge-fixture"),
    accounts: demoState().accounts,
  };
  const first = fixture.accounts[0]!;
  first.order = 99;
  first.pinnedMeterIds = ["extra"];
  first.meters.push({
    ...first.meters[0]!,
    id: "extra",
    label: "Legacy pinned extra",
    usedPercent: 20,
  });
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const row = page.locator(".account-row").filter({
    has: page.getByRole("button", {
      name: "Details for Claude Work",
      exact: true,
    }),
  });
  await expect(row.locator(".row-meters")).toContainText("Weekly");
  await expect(row.locator(".row-meters")).not.toContainText(
    "Legacy pinned extra",
  );
  await page
    .getByRole("button", { name: "Details for Claude Work", exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: "Pin meter" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /Move .* (up|down)$/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Your order" })).toHaveCount(0);
  const weekly = row.getByRole("button", {
    name: "Show Weekly · all models on toolbar",
    exact: true,
  });
  await weekly.click();
  await expect(weekly).toHaveText("On toolbar");
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getBadgeText({})))
    .toBe("39%");
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getTitle({})))
    .toBe("MyLimits · Claude Work · Weekly · all models: 39% remaining");
  await page
    .getByRole("button", { name: "Details for GPT Work", exact: true })
    .click();
  const codex = page.getByRole("button", {
    name: "Show Work / Codex · 5 hours on toolbar",
    exact: true,
  });
  await codex.click();
  await expect(codex).toHaveText("On toolbar");
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getBadgeText({})))
    .toBe("14%");
  await page
    .getByRole("button", { name: "Details for Claude Work", exact: true })
    .click();
  await expect(weekly).toHaveText("Show on toolbar");
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const s = (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store;
        return s.settings.badge;
      }),
    )
    .toEqual({ mode: "meter", accountId: "demo-gpt-work", meterId: "session" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Toolbar badge", { exact: true })).toHaveValue(
    "meter",
  );
  await expect(
    page.getByText("GPT Work · Work / Codex · 5 hours", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Display", { exact: true }).selectOption("used");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getBadgeText({})))
    .toBe("86%");
  await page.getByLabel("Toolbar badge", { exact: true }).selectOption("off");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getBadgeText({})))
    .toBe("");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Toolbar badge", { exact: true })).toHaveValue(
    "off",
  );
  await page.getByLabel("Toolbar badge", { exact: true }).selectOption("meter");
  await page.getByLabel("Privacy mode").selectOption("on");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getTitle({})))
    .toBe("MyLimits · Limit: 86% used");
  await page.getByLabel("Privacy mode").selectOption("off");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Details for GPT Work", exact: true })
    .click();
  await codex.click(); // Toggle the chosen meter off: automatic selection resumes.
  await expect(codex).toHaveText("Show on toolbar");
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const s = (await chrome.storage.local.get("mylimits:state:v2"))[
          "mylimits:state:v2"
        ] as Store;
        return s.settings.badge;
      }),
    )
    .toEqual({ mode: "auto" });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const quick = popup
    .locator(".quick-account")
    .filter({ hasText: "Claude Work" });
  await expect(quick).toContainText("Weekly");
  await expect(quick).not.toContainText("Legacy pinned extra");
  const saved = await worker.evaluate(async () => {
    const s = (await chrome.storage.local.get("mylimits:state:v2"))[
      "mylimits:state:v2"
    ] as Store;
    return { order: s.accounts[0]!.order, pins: s.accounts[0]!.pinnedMeterIds };
  });
  expect(saved).toEqual({ order: 99, pins: ["extra"] });
});

test("U5 chosen limit preference without a selection explains where to choose", async ({
  context,
  worker,
  extensionId,
}) => {
  const fixture = emptyStore("u5-no-choice");
  await worker.evaluate(
    async (s) => chrome.storage.local.set({ "mylimits:state:v2": s }),
    fixture,
  );
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Toolbar badge", { exact: true }).selectOption("meter");
  await expect(
    page.getByText("Choose a limit in Accounts", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(() => worker.evaluate(async () => chrome.action.getBadgeText({})))
    .toBe("");
});

test.describe("current Copilot quota access (simulated, not live evidence)", () => {
  test.use({ grantedProviderOrigin: "https://api.github.com/*" });
  test("opt-in reads Free credits and suggestions, preserves separate accounts, refreshes usage and rejects denied access without billing fallback", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      const g = globalThis as typeof globalThis & {
        quotaUsed?: number;
        quotaDenied?: boolean;
        billingCalls?: number;
      };
      g.quotaUsed = 12;
      g.billingCalls = 0;
      globalThis.fetch = async (input, opts) => {
        const url = new URL(String(input));
        if (
          url.origin !== "https://api.github.com" ||
          opts?.credentials !== "omit"
        )
          throw Error("Unexpected request");
        const second = new Headers(opts.headers)
            .get("Authorization")
            ?.endsWith("SECOND"),
          id = second ? 2 : 1,
          login = second ? "bob" : "alice";
        if (url.pathname === "/user")
          return new Response(JSON.stringify({ id, login }));
        if (url.pathname !== "/copilot_internal/user") {
          g.billingCalls!++;
          throw Error("No billing fallback allowed");
        }
        if (g.quotaDenied) return new Response("{}", { status: 403 });
        return new Response(
          JSON.stringify({
            id,
            login,
            copilot_plan: second ? "pro" : "free",
            token_based_billing: true,
            quota_reset_date_utc: new Date(
              Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth() + 1,
                1,
              ),
            ).toISOString(),
            quota_snapshots: {
              chat: {
                entitlement: second ? 1000 : 100,
                credits_used: second ? 450 : g.quotaUsed,
                percent_remaining: second ? 55 : 100 - g.quotaUsed!,
                unlimited: false,
              },
              completions: second
                ? { unlimited: true, entitlement: 0 }
                : {
                    entitlement: 2000,
                    quota_remaining: 2000,
                    percent_remaining: 100,
                    unlimited: false,
                  },
            },
          }),
        );
      };
    });
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/dashboard.html#add-copilot`,
    );
    await page
      .getByLabel("Read account quotas (experimental)", { exact: true })
      .check();
    await page
      .getByLabel("Fine-grained personal access token")
      .fill("github_pat_FICTIONAL_QUOTA_ACCOUNT_A");
    await page
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    const alice = page
      .locator(".account-row")
      .filter({ hasText: "GitHub Copilot · alice" });
    await expect(alice.locator(".row-meters")).toContainText("Credits");
    await expect(alice.locator(".row-meters")).toContainText(
      "Inline suggestions",
    );
    await expect(alice.locator(".row-meters")).toContainText("88%");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Display", { exact: true }).selectOption("used");
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(alice.locator(".row-meters")).toContainText("12%");
    await expect(alice.locator(".row-meters")).toContainText("0%");
    await page
      .getByRole("button", { name: "Add another GitHub account", exact: true })
      .click();
    await page
      .getByLabel("Read account quotas (experimental)", { exact: true })
      .check();
    await page
      .getByLabel("Fine-grained personal access token")
      .fill("github_pat_FICTIONAL_QUOTA_ACCOUNT_SECOND");
    await page
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    const bob = page
      .locator(".account-row")
      .filter({ hasText: "GitHub Copilot · bob" });
    await expect(bob.locator(".row-meters")).toContainText("45%");
    await expect(bob.locator(".row-meters")).toContainText("Unlimited");
    await expect(alice.locator(".row-meters")).toContainText("12%");
    await worker.evaluate(async () => {
      const g = globalThis as typeof globalThis & { quotaUsed?: number };
      g.quotaUsed = 25;
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      for (const c of s.connections.filter((c) => c.kind === "copilot"))
        c.lastAttemptAt = Date.now() - 16 * 60000;
      await chrome.storage.local.set({ "mylimits:state:v2": s });
    });
    await page
      .getByRole("button", { name: "Refresh all limits", exact: true })
      .click();
    await expect(alice.locator(".row-meters")).toContainText("25%");
    await expect(bob.locator(".row-meters")).toContainText("45%");
    const before = await worker.evaluate(async () => {
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      return s.connections
        .filter((c) => c.kind === "copilot")
        .map((c) => c.lastSuccessAt);
    });
    await worker.evaluate(async () => {
      (
        globalThis as typeof globalThis & { quotaDenied?: boolean }
      ).quotaDenied = true;
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      for (const c of s.connections.filter((c) => c.kind === "copilot"))
        c.lastAttemptAt = Date.now() - 16 * 60000;
      await chrome.storage.local.set({ "mylimits:state:v2": s });
    });
    await page
      .getByRole("button", { name: "Refresh all limits", exact: true })
      .click();
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const s = (await chrome.storage.local.get("mylimits:state:v2"))[
            "mylimits:state:v2"
          ] as Store;
          return s.connections
            .filter((c) => c.kind === "copilot")
            .every((c) => c.status === "unavailable");
        }),
      )
      .toBe(true);
    const after = await worker.evaluate(async () => {
      const s = (await chrome.storage.local.get("mylimits:state:v2"))[
        "mylimits:state:v2"
      ] as Store;
      return {
        times: s.connections
          .filter((c) => c.kind === "copilot")
          .map((c) => c.lastSuccessAt),
        billing: (globalThis as typeof globalThis & { billingCalls?: number })
          .billingCalls,
      };
    });
    expect(after.times).toEqual(before);
    expect(after.billing).toBe(0);
    await expect(alice.locator(".row-meters")).toContainText("25%");
    await expect(alice.locator(".row-meters")).toContainText("Last");
  });
  test("empty documented billing data displays unavailable instead of zero Free-plan usage", async ({
    context,
    worker,
    extensionId,
  }) => {
    await worker.evaluate(() => {
      globalThis.fetch = async (input) =>
        new Response(
          JSON.stringify(
            new URL(String(input)).pathname === "/user"
              ? { id: 1, login: "alice" }
              : {
                  user: "alice",
                  timePeriod: {
                    year: new Date().getUTCFullYear(),
                    month: new Date().getUTCMonth() + 1,
                  },
                  usageItems: [],
                },
          ),
        );
    });
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/dashboard.html#add-copilot`,
    );
    await page
      .getByLabel("Fine-grained personal access token")
      .fill("github_pat_FICTIONAL_EMPTY_BILLING");
    await page
      .getByRole("button", { name: "Connect GitHub Copilot", exact: true })
      .click();
    const row = page
      .locator(".account-row")
      .filter({ hasText: "GitHub Copilot · alice" });
    await expect(row.locator(".row-meters")).toContainText(
      "Quota unavailable through billing API",
    );
    await expect(row.locator(".row-meters")).not.toContainText("0 used");
    await expect(row.locator(".row-meters")).not.toContainText("0%");
    await page
      .getByRole("button", {
        name: "Details for GitHub Copilot · alice",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Read account quotas (experimental)", { exact: true })
      .check();
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const s = (await chrome.storage.local.get("mylimits:state:v2"))[
            "mylimits:state:v2"
          ] as Store;
          return s.connections.find((c) => c.kind === "copilot")!
            .copilotQuotaAccess;
        }),
      )
      .toBe(true);
    await expect(row).toContainText("Waiting for the next eligible refresh");
  });
});
