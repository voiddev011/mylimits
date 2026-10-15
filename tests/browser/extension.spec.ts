import { test as base, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyStore, type Store, type Account } from '../../src/core/model';
import { demoState } from '../../src/ui/demo';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

const extensionPath = path.resolve('.output/chrome-mv3');
const test = base.extend<{ context: BrowserContext; worker: Worker; extensionId: string; profilePath: string }>({
  profilePath: async ({}, use) => { const dir=await mkdtemp(path.join(tmpdir(),'mylimits-browser-')); try { await use(dir); } finally { await rm(dir,{recursive:true,force:true}); } },
  context: async ({ profilePath }, use) => {
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) throw new Error('Run npm run build before browser tests.');
    const userData = profilePath;
    const configured = process.env.CHROMIUM_PATH;
    const executablePath = configured; // Prefer Playwright's extension-capable Chromium.
    const context = await chromium.launchPersistentContext(userData, {
      ignoreDefaultArgs: ['--disable-extensions'],
      executablePath, channel: executablePath ? undefined : 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox', '--disable-background-networking'],
    });
    // These tests use fixtures only; never contact real AI accounts.
    await context.route(/^https?:\/\//, route => route.abort());
    try { await use(context); } finally { await context.close(); await rm(userData, { recursive: true, force: true }); }
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 });
    await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('mylimits:active-schema'))['mylimits:active-schema'])).toBe(2);
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
  const count = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store).accounts.length);
  expect(count).toBe(0);
  await page.getByRole('button', { name: 'Exit sample preview' }).click();
  await expect(page.getByText('A clear view starts here.')).toBeVisible();
});

test('two Claude and three ChatGPT records can be renamed independently and persist on reload', async ({ context, worker, extensionId }) => {
  const fixture = { ...emptyStore('fictional-browser-test-salt'), accounts: demoState().accounts };
  await worker.evaluate(async store => chrome.storage.local.set({ 'mylimits:state:v2': store }), fixture);
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
  const saved = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store));
  expect(saved.accounts).toHaveLength(5);
  expect(saved.accounts.find((account: { id: string }) => account.id === 'demo-claude-personal')!.alias).toBe('Writing account');
  expect(saved.accounts.find((account: { id: string }) => account.id === 'demo-gpt-personal')!.alias).toBe('GPT Personal');
});

test('preferences persist and account warnings remain separately configurable', async ({ context, worker, extensionId }) => {
  const fixture = { ...emptyStore('fictional-browser-test-salt'), accounts: demoState().accounts };
  await worker.evaluate(async store => chrome.storage.local.set({ 'mylimits:state:v2': store }), fixture);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Early warning').fill('30');
  await page.getByLabel('Critical warning').fill('10');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences saved.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Early warning')).toHaveValue('30');
  await expect(page.getByLabel('Critical warning')).toHaveValue('10');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Details for Claude Work', exact: true }).click();
  await page.getByLabel('Warning for Claude Work').fill('15');
  await page.getByRole('button', { name: 'Save threshold', exact: true }).click();
  await expect.poll(async () => worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store).accounts.find((account: { id: string }) => account.id === 'demo-claude-work')!.alertRemaining)).toBe(15);
});

test('denying website permission creates no account and popup fits its viewport', async ({ context, worker, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 520, height: 650 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  await page.getByRole('switch', { name: 'Track Claude', exact: true }).click();
  await expect(page.getByText('Site access was not granted. Nothing was connected.')).toBeVisible();
  const store = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store));
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
  const before = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store).accounts.length);
  expect(before).toBe(0);
});

 test('compact popup shows every sample limit before details, with search and low filtering', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 520, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html#demo`);
  await expect(page.locator('.meter-chip')).toHaveCount(7);
  const limitsFit = await page.locator('.account-list').evaluate(element => element.getBoundingClientRect().bottom <= 600);
  expect(limitsFit).toBe(true);
  await expect(page.locator('.account-detail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Low only', exact: true }).click();
  await expect(page.locator('.account-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Details for GPT Work' })).toBeVisible();
  await page.getByRole('button', { name: 'Low only', exact: true }).click();
  await page.getByLabel('Search accounts').fill('Personal');
  await expect(page.locator('.account-row')).toHaveCount(2);
});

test('denied companion permission creates no account', async ({ context, worker, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  await page.getByText('Advanced · optional OpenAI companion', { exact: true }).click();
  await page.getByRole('button', { name: 'Connect OpenAI', exact: true }).click();
  await expect(page.getByText('Companion access was not granted.')).toBeVisible();
  const saved = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store));
  expect(saved.accounts).toHaveLength(0);
});

test('native snapshots update independent accounts and disconnect without exposing credentials', async ({ context, worker, extensionId }) => {
  const profiles = [
    { id: '1f30feba-2b2a-4c19-8ebc-cd35bc96ff71', status: 'active', plan: 'plus', updatedAt: Date.now(), meters: demoState().accounts[1]!.meters },
    { id: '6c7b581a-333d-4016-955e-98e84dcf22aa', status: 'active', plan: 'pro', updatedAt: Date.now(), meters: demoState().accounts[4]!.meters },
  ];
  await worker.evaluate(input => {
    const originalContains = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = async options => options.permissions?.includes('nativeMessaging') ? true : originalContains(options);
    Object.defineProperty(chrome.runtime, 'connectNative', { configurable: true, value: () => {
      let deliver: (value: unknown) => void = () => {};
      return {
        onMessage: { addListener: (listener: (value: unknown) => void) => { deliver = listener; } },
        onDisconnect: { addListener: () => {} }, disconnect: () => {},
        postMessage: (request: { id: string; method: string; profile?: string }) => {
          if (request.method === 'remove') input = input.filter(profile => profile.id !== request.profile);
          setTimeout(() => deliver({ id: request.id, ok: true, data: request.method === 'remove' ? {} : { type: 'snapshot', profiles: input, accessToken: 'DO-NOT-PERSIST' } }), 0);
        },
      };
    } });
  }, profiles);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'companion-enable', enabled: true }));
  await expect(page.getByRole('button', { name: 'Details for OpenAI 1f30', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details for OpenAI 6c7b', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details for OpenAI 1f30', exact: true }).click();
  await page.getByRole('button', { name: 'Rename OpenAI 1f30', exact: true }).click();
  await page.getByLabel('Account nickname').fill('Independent work');
  await page.getByRole('button', { name: 'Save nickname', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh all limits' }).click();
  await expect(page.getByRole('button', { name: 'Details for Independent work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Details for Independent work', exact: true })).toBeVisible();
  await expect(page.locator('.account-row').filter({ has: page.getByRole('button', { name: 'Details for Independent work', exact: true }) })).toContainText('Remembered');
  const saved = await worker.evaluate(async () => ((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store));
  expect(saved.accounts.filter(account => account.companionProfile)).toHaveLength(2);
  expect(saved.accounts.filter(account => account.companionProfile && account.connection === 'active')).toHaveLength(1);
  expect(saved.accounts.find(account => account.companionProfile === profiles[1]!.id)?.connection).toBe('active');
  expect(JSON.stringify(saved)).not.toContain('DO-NOT-PERSIST');
});

 test('popup establishes its own width even when first laid out in a tiny viewport', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 40, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByText('A clear view starts here.')).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.getBoundingClientRect().width,
    body: document.body.getBoundingClientRect().width,
    app: document.querySelector('.app')!.getBoundingClientRect().width,
  }));
  expect(widths).toEqual({ document: 520, body: 520, app: 520 });
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  expect(await page.locator('.app').evaluate(element => element.getBoundingClientRect().width)).toBe(520);
});

test('unavailable native API shows reload guidance without a TypeError', async ({ context, worker, extensionId }) => {
  await worker.evaluate(() => {
    const original = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = async options => options.permissions?.includes('nativeMessaging') ? true : original(options);
    Object.defineProperty(chrome.runtime, 'connectNative', { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.evaluate(() => { chrome.permissions.request = async () => true; });
  await page.getByText('Advanced · optional OpenAI companion', { exact: true }).click();
  await page.getByRole('button', { name: 'Connect OpenAI', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Reload MyLimits');
  await expect(page.getByRole('alert')).not.toContainText('is not a function');
});

test('six account rows fit the popup and pins remain independent of nicknames', async ({context,worker,extensionId})=>{
 const fixture={...emptyStore('six-fixture'),accounts:demoState().accounts};
 fixture.accounts.push({...fixture.accounts[0]!,id:'sixth',alias:'Claude Research',connection:'inactive'});
 await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.setViewportSize({width:520,height:600});await page.goto(`chrome-extension://${extensionId}/popup.html`);
 await expect(page.locator('.account-row')).toHaveCount(6);
 expect(await page.locator('.main-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
 await page.getByRole('button',{name:'Details for GPT Projects',exact:true}).click();
 await page.getByRole('button',{name:'Pin account',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.locator('.account-row').first()).toContainText('GPT Projects');
 await page.reload();await expect(page.locator('.account-row').first()).toContainText('GPT Projects');
 await expect(page.getByRole('button',{name:'Details for Claude Work',exact:true})).toBeVisible();
});

test('real IndexedDB pagination, safe export and history deletion preserve account preferences',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('history-fixture'),accounts:demoState().accounts};fixture.accounts[0]!.alias='=SUM(A1:A2)';
 await worker.evaluate(async({fixture,now})=>{
  await chrome.storage.local.set({'mylimits:state:v2':fixture});
  await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('mylimits-history',2);req.onsuccess=()=>{const db=req.result,tx=db.transaction('readings','readwrite'),s=tx.objectStore('readings');for(let i=0;i<53;i++){const time=now-Math.floor(i/2)*60000;s.add({schemaVersion:2,accountId:fixture.accounts[0]!.id,time,observedAt:time,receivedAt:now,connectionId:'website:claude',snapshotKey:`fixture:${i}`,meters:[{id:'session',label:'Session',scope:'subscription',evidence:'reported',unit:'percent',used:null,total:null,usedPercent:i,resetsAt:now+3600000,source:'Fixture'}]})}s.add({accountId:fixture.accounts[1]!.id,time:now,meters:[],legacy:true});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};req.onerror=()=>reject(req.error)});
 },{fixture,now:Date.now()});
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
 const result=await page.evaluate(async id=>{
  const one=await chrome.runtime.sendMessage({type:'history-page',accountId:id,limit:20});
  const two=await chrome.runtime.sendMessage({type:'history-page',accountId:id,limit:20,before:one.data.cursor});
  const three=await chrome.runtime.sendMessage({type:'history-page',accountId:id,limit:20,before:two.data.cursor});
  const csv=await chrome.runtime.sendMessage({type:'export-history',accountId:id,format:'csv'});
  const json=await chrome.runtime.sendMessage({type:'export-history',accountId:id,format:'json'});
  return {pages:[one.data,two.data,three.data],csv:csv.data.text,json:json.data.text};
 },fixture.accounts[0]!.id);
 expect(result.pages.map(p=>p.points.length)).toEqual([20,20,13]);
 const ids=result.pages.flatMap(p=>p.points.map((r:{id:number})=>r.id));expect(new Set(ids).size).toBe(53);
 expect(result.csv).toContain("'=SUM(A1:A2)");expect(result.json).not.toContain('history-fixture');expect(JSON.parse(result.json).readings).toHaveLength(53);
 await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.getByText('Reading history')).toBeVisible();
 await expect(page.getByRole('button',{name:'Load older readings'})).toBeVisible();await page.getByRole('button',{name:'Clear history',exact:true}).click();await page.getByRole('button',{name:'Confirm clear history',exact:true}).click();
 await expect(page.getByText('No saved readings in this date range.')).toBeVisible();
 const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);
 expect(saved.accounts).toHaveLength(5);expect(saved.accounts[0]!.alias).toBe('=SUM(A1:A2)');
});

test('V1 state and IndexedDB history migrate on extension restart without losing nicknames',async({context,worker,extensionId,profilePath})=>{
 const {cursor:_newProvider,...legacyProviders}=emptyStore('legacy-keep-salt').providers;
 const legacy={...emptyStore('legacy-keep-salt'),providers:legacyProviders,version:1,accounts:demoState().accounts};legacy.accounts[0]!.alias='Old work nickname';
 await worker.evaluate(async legacy=>{
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('mylimits-history');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('History database still open'));});
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('mylimits-history',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('readings',{keyPath:'id',autoIncrement:true});s.createIndex('account','accountId');s.createIndex('time','time')};r.onsuccess=()=>{const db=r.result,tx=db.transaction('readings','readwrite');tx.objectStore('readings').add({accountId:legacy.accounts[0]!.id,time:Date.now()-3600000,meters:[{id:'legacy-meter',usedPercent:42}]});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};r.onerror=()=>reject(r.error)});
  await chrome.storage.local.clear();await chrome.storage.local.set({'mylimits:state:v1':legacy});
 },legacy);
 await context.close();
 const reopened=await chromium.launchPersistentContext(profilePath,{ignoreDefaultArgs:['--disable-extensions'],executablePath:process.env.CHROMIUM_PATH,channel:process.env.CHROMIUM_PATH?undefined:'chromium',headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`,'--no-sandbox','--disable-background-networking']});
 await reopened.route(/^https?:\/\//,route=>route.abort());
 try {
 const restarted=reopened.serviceWorkers()[0]??await reopened.waitForEvent('serviceworker');
 await expect.poll(async()=>restarted.evaluate(async()=> (await chrome.storage.local.get('mylimits:active-schema'))['mylimits:active-schema'])).toBe(2);
 const saved=await restarted.evaluate(async()=>chrome.storage.local.get(['mylimits:state:v2','mylimits:backup:v1']));
 const migrated=saved['mylimits:state:v2'] as Store;const backup=saved['mylimits:backup:v1'] as {version:number};
 expect(migrated.installSalt).toBe('legacy-keep-salt');expect(migrated.accounts[0]!.alias).toBe('Old work nickname');expect(backup.version).toBe(1);
 const page=await reopened.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
 const history=await page.evaluate(async id=>chrome.runtime.sendMessage({type:'history-page',accountId:id}),legacy.accounts[0]!.id);
 expect(history.ok).toBe(true);expect(history.data.points[0].legacy).toBe(true);expect(history.data.points[0].meters[0].usedPercent).toBe(42);
 const forgotten=await page.evaluate(async id=>chrome.runtime.sendMessage({type:'forget',accountId:id}),legacy.accounts[0]!.id);expect(forgotten.ok).toBe(true);
 const backups=await restarted.evaluate(async()=>chrome.storage.local.get(['mylimits:state:v1','mylimits:backup:v1','mylimits:state:v2']));expect(JSON.stringify(backups)).not.toContain('Old work nickname');
 } finally { await reopened.close(); }
});

test('permitted fixture provider updates real history and prunes expired observations',async({context,worker,extensionId})=>{
 await worker.evaluate(async()=>{
  const original=chrome.permissions.contains.bind(chrome.permissions);
  chrome.permissions.contains=async p=>p.origins?.includes('https://claude.ai/*')?true:original(p);
  globalThis.fetch=async input=>{const path=new URL(String(input)).pathname;const value=path==='/api/account'?{uuid:'fictional-user'}:path==='/api/organizations'?[{uuid:'fictional-org',name:'Test team',capabilities:['chat']}]:{five_hour:{utilization:25,resets_at:new Date(Date.now()+3600000).toISOString()}};return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})};
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('mylimits-history',2);r.onsuccess=()=>{const db=r.result,tx=db.transaction('readings','readwrite');tx.objectStore('readings').add({accountId:'expired',time:Date.now()-31*86400000,meters:[]});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};r.onerror=()=>reject(r.error)});
 });
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
 const enabled=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'enable',provider:'claude',enabled:true}));expect(enabled.ok).toBe(true);
 const account=enabled.data.accounts.find((a:Account)=>a.provider==='claude');expect(account).toBeTruthy();
 const history=await page.evaluate(async id=>chrome.runtime.sendMessage({type:'history-page',accountId:id}),account.id);
 expect(history.data.points, JSON.stringify({issue:enabled.data.historyIssue,connections:enabled.data.connections})).toHaveLength(1);expect(history.data.points[0].connectionId).toBe('website:claude');expect(history.data.points[0].meters[0].scope).toBe('subscription');
 const old=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'history-page',accountId:'expired'}));expect(old.data.points).toHaveLength(0);
 const wire=JSON.stringify(enabled.data);expect(wire).not.toContain('fictional-org');expect(wire).not.toContain('fictional-user');
 await worker.evaluate(async()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
  const state=(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store;
  state.connections.find(c=>c.id==='website:claude')!.lastAttemptAt=null;
  await chrome.storage.local.set({'mylimits:state:v2':state});
 });
 const offline=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'refresh',provider:'claude'}));
 expect(offline.data.connections.find((c:{id:string})=>c.id==='website:claude').status).toBe('offline');
 expect(offline.data.accounts[0].updatedAt).toBe(account.updatedAt);
 const after=await page.evaluate(async id=>chrome.runtime.sendMessage({type:'history-page',accountId:id}),account.id);
 expect(after.data.points).toHaveLength(1);
});

test('shared views preserve dark theme, long names and keyboard focus at narrow layouts',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('layout-fixture'),accounts:demoState().accounts};
 fixture.settings.theme='dark';fixture.accounts[0]!.alias='A long account nickname to verify narrow extension surfaces';
 await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();
 for(const [surface,width] of [['dashboard',1120],['sidepanel',360],['popup',520]] as const){
  await page.setViewportSize({width,height:600});await page.goto(`chrome-extension://${extensionId}/${surface}.html`);
  const details=page.getByRole('button',{name:`Details for ${fixture.accounts[0]!.alias}`,exact:true});
  await expect(details).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await details.focus();await page.keyboard.press('Enter');await expect(details).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(details).toHaveAttribute('aria-expanded','false');await expect(details).toBeFocused();
  // CSS zoom stresses layout only; this is not a Windows DPI certification.
  await page.evaluate(()=>{document.querySelector<HTMLElement>('.app')!.style.zoom='1.25'});
  await expect(page.getByRole('button',{name:'Accounts',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Accounts',exact:true}).click();
  await expect(page.getByRole('switch',{name:'Track Claude',exact:true})).toBeVisible();
 }
});

test('Perplexity count-only quotas and activity mode preserve names without guessed percentages',async({context,worker,extensionId})=>{
 await worker.evaluate(()=>{
  const original=chrome.permissions.contains.bind(chrome.permissions);chrome.permissions.contains=async p=>p.origins?.includes('https://www.perplexity.ai/*')?true:original(p);
  globalThis.fetch=async input=>new Response(JSON.stringify(new URL(String(input)).pathname==='/api/auth/session'?{user:{id:'fictional-search-user',email:'PRIVATE-SEARCH-EMAIL'}}:{remaining_pro:0,remaining_research:12}),{status:200,headers:{'content-type':'application/json'}});
 });
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
 const result=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'enable',provider:'perplexity',enabled:true}));expect(result.ok).toBe(true);expect(JSON.stringify(result.data)).not.toContain('PRIVATE-SEARCH-EMAIL');
 await expect(page.locator('.meter-chip strong').filter({hasText:'0 left'})).toBeVisible();await expect(page.locator('.meter-chip strong').filter({hasText:'12 left'})).toBeVisible();
 const account=result.data.accounts.find((a:Account)=>a.provider==='perplexity');expect(account.meters[0].usedPercent).toBeNull();expect(account.meters[0].total).toBeNull();
 await page.getByRole('button',{name:'Details for Perplexity',exact:true}).click();await page.getByRole('button',{name:'Rename Perplexity',exact:true}).click();await page.getByLabel('Account nickname').fill('Personal search');await page.getByRole('button',{name:'Save nickname',exact:true}).click();
 await page.getByRole('button',{name:'Accounts',exact:true}).click();await page.getByLabel('Reading source for Perplexity').selectOption('activity');
 await expect.poll(async()=>worker.evaluate(async()=>{const s=(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store;return s.accounts.find(a=>a.kind==='browser'&&a.provider==='perplexity')?.connection})).toBe('active');
 const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);expect(saved.accounts.find(a=>a.id===account.id)!.alias).toBe('Personal search');expect(saved.accounts.find(a=>a.id===account.id)!.connection).toBe('inactive');expect(saved.providers.perplexity.readingMode).toBe('activity');
});
