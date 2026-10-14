import { test as base, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyStore } from '../../src/core/model';
import { demoState } from '../../src/ui/demo';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

const extensionPath = path.resolve('.output/chrome-mv3');
const test = base.extend<{ context: BrowserContext; worker: Worker; extensionId: string }>({
  context: async ({}, use) => {
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) throw new Error('Run npm run build before browser tests.');
    const userData = await mkdtemp(path.join(tmpdir(), 'mylimits-browser-'));
    const configured = process.env.CHROMIUM_PATH;
    const executablePath = configured ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    const context = await chromium.launchPersistentContext(userData, {
      executablePath, channel: executablePath ? undefined : 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox', '--disable-background-networking'],
    });
    // These tests use fixtures only; never contact real AI accounts.
    await context.route(/^https?:\/\//, route => route.abort());
    try { await use(context); } finally { await context.close(); await rm(userData, { recursive: true, force: true }); }
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await use(worker);
  },
  extensionId: async ({ worker }, use) => use(new URL(worker.url()).host),
});

test('new install starts empty and sample preview does not write fake accounts to storage', async ({ context, worker, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.getByText('A clear view starts here.')).toBeVisible();
  await page.getByRole('button', { name: 'Preview with sample data' }).click();
  await expect(page.getByText('Preview · sample accounts and readings')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details for Claude Work', exact: true })).toBeVisible();
  const count = await worker.evaluate(async () => (await chrome.storage.local.get('mylimits:state:v1'))['mylimits:state:v1'].accounts.length);
  expect(count).toBe(0);
  await page.getByRole('button', { name: 'Exit sample preview' }).click();
  await expect(page.getByText('A clear view starts here.')).toBeVisible();
});

test('two Claude and three ChatGPT records can be renamed independently and persist on reload', async ({ context, worker, extensionId }) => {
  const fixture = { ...emptyStore('fictional-browser-test-salt'), accounts: demoState().accounts };
  await worker.evaluate(async store => chrome.storage.local.set({ 'mylimits:state:v1': store }), fixture);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole('button', { name: 'Details for Claude Personal', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Claude Personal', exact: true }).click();
  await page.getByLabel('Account nickname').fill('Writing account');
  await page.getByRole('button', { name: 'Save nickname', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Details for Writing account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details for Claude Work', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details for GPT Work', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Details for Writing account', exact: true })).toBeVisible();
  const saved = await worker.evaluate(async () => (await chrome.storage.local.get('mylimits:state:v1'))['mylimits:state:v1']);
  expect(saved.accounts).toHaveLength(5);
  expect(saved.accounts.find((account: { id: string }) => account.id === 'demo-claude-personal').alias).toBe('Writing account');
  expect(saved.accounts.find((account: { id: string }) => account.id === 'demo-gpt-personal').alias).toBe('GPT Personal');
});

test('preferences persist and account warnings remain separately configurable', async ({ context, worker, extensionId }) => {
  const fixture = { ...emptyStore('fictional-browser-test-salt'), accounts: demoState().accounts };
  await worker.evaluate(async store => chrome.storage.local.set({ 'mylimits:state:v1': store }), fixture);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Early warning').fill('30');
  await page.getByLabel('Critical warning').fill('10');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Alert preferences saved.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.getByLabel('Early warning')).toHaveValue('30');
  await expect(page.getByLabel('Critical warning')).toHaveValue('10');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Details for Claude Work', exact: true }).click();
  await page.getByRole('button', { name: 'Settings for Claude Work', exact: true }).click();
  await page.getByLabel('Alert threshold for Claude Work').selectOption('15');
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('mylimits:state:v1'))['mylimits:state:v1'].accounts.find((account: { id: string }) => account.id === 'demo-claude-work').alertRemaining)).toBe(15);
});

test('denying website permission creates no account and popup fits its viewport', async ({ context, worker, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('button', { name: 'Websites', exact: true }).click();
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  await page.getByRole('switch', { name: 'Track Claude', exact: true }).click();
  await expect(page.getByText('Chrome site access was not granted. Nothing was connected.')).toBeVisible();
  const store = await worker.evaluate(async () => (await chrome.storage.local.get('mylimits:state:v1'))['mylimits:state:v1']);
  expect(store.accounts).toHaveLength(0);
  expect(store.providers.claude.enabled).toBe(false);
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});

test('capture dashboard preview and reject invalid or foreign UI messages', async ({ context, worker, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1120, height: 920 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#demo`);
  await expect(page.getByRole('button', { name: 'Details for Claude Work' })).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/dashboard-preview.png', fullPage: true });
  const result = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'rename', accountId: 'x', alias: 'a'.repeat(200) }));
  expect(result.ok).toBe(false);
  const before = await worker.evaluate(async () => (await chrome.storage.local.get('mylimits:state:v1'))['mylimits:state:v1'].accounts.length);
  expect(before).toBe(0);
});

 test('compact popup shows every sample limit before details, with search and low filtering', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 520, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html#demo`);
  await expect(page.locator('.compact-meter')).toHaveCount(7);
  const limitsFit = await page.locator('.compact-accounts').evaluate(element => element.getBoundingClientRect().bottom <= 600);
  expect(limitsFit).toBe(true);
  await expect(page.locator('.account-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Low only', exact: true }).click();
  await expect(page.locator('.compact-account')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Details for GPT Work' })).toBeVisible();
  await page.getByRole('button', { name: 'Low only', exact: true }).click();
  await page.getByLabel('Search accounts and limits').fill('Personal');
  await expect(page.locator('.compact-account')).toHaveCount(2);
});
