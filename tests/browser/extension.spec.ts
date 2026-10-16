import { test as base, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtemp, rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyStore, type Store, type Account } from '../../src/core/model';
import { demoState } from '../../src/ui/demo';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

const extensionPath = path.resolve('.output/chrome-mv3');
const test = base.extend<{ context: BrowserContext; worker: Worker; extensionId: string; profilePath: string;grantedProviderOrigin:string|null }>({
  grantedProviderOrigin:[null,{option:true}],
  profilePath: async ({}, use) => { const dir=await mkdtemp(path.join(tmpdir(),'mylimits-browser-')); try { await use(dir); } finally { await rm(dir,{recursive:true,force:true}); } },
  context: async ({ profilePath,grantedProviderOrigin }, use) => {
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) throw new Error('Run npm run build before browser tests.');
    let loadedExtensionPath=extensionPath;
    if(grantedProviderOrigin){loadedExtensionPath=path.join(profilePath,'fixture-extension');await cp(extensionPath,loadedExtensionPath,{recursive:true});const file=path.join(loadedExtensionPath,'manifest.json');const manifest=JSON.parse(await readFile(file,'utf8'));manifest.host_permissions=[grantedProviderOrigin];await writeFile(file,JSON.stringify(manifest));}
    const userData = profilePath;
    const configured = process.env.CHROMIUM_PATH;
    const executablePath = configured; // Prefer Playwright's extension-capable Chromium.
    const context = await chromium.launchPersistentContext(userData, {
      ignoreDefaultArgs: ['--disable-extensions'],
      executablePath, channel: executablePath ? undefined : 'chromium', headless: true,
      args: [`--disable-extensions-except=${loadedExtensionPath}`, `--load-extension=${loadedExtensionPath}`, '--no-sandbox', '--disable-background-networking'],
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
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
  await page.getByRole('button', { name: /Claude · Claude Code/ }).click();
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  await page.getByRole('button', { name: 'Detect current account', exact: true }).click();
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

test('quick popup shows six accounts without dashboard clutter or scrolling', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 560 });
  await page.goto(`chrome-extension://${extensionId}/popup.html#demo`);
  await expect(page.locator('.meter-chip')).toHaveCount(7);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Settings',exact:true})).toHaveCount(0);
  expect(await page.locator('.quick-main').evaluate(e => e.scrollHeight <= e.clientHeight)).toBe(true);
  await page.getByRole('button', {name:'Low only',exact:true}).click();
  await expect(page.locator('.quick-account')).toHaveCount(1);
  await expect(page.getByRole('button', {name:'View GPT Work in full dashboard'})).toBeVisible();
  await page.getByRole('button', {name:'Low only',exact:true}).click();
  await expect(page.locator('.quick-account')).toHaveCount(5);
  await mkdir('artifacts', {recursive:true});
  await page.screenshot({path:'artifacts/compact-popup-preview.png'});
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
  await expect(page.getByText('Your limits at a glance.')).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.getBoundingClientRect().width,
    body: document.body.getBoundingClientRect().width,
    app: document.querySelector('.app')!.getBoundingClientRect().width,
  }));
  expect(widths).toEqual({ document: 440, body: 440, app: 440 });
  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  expect(await page.locator('.app').evaluate(element => element.getBoundingClientRect().width)).toBe(440);
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

test('popup honors dashboard pins without changing account nicknames', async ({context,worker,extensionId})=>{
 const fixture={...emptyStore('six-fixture'),accounts:demoState().accounts};
 fixture.accounts.push({...fixture.accounts[0]!,id:'sixth',alias:'Claude Research',connection:'inactive'});
 await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
 await page.getByRole('button',{name:'Details for GPT Projects',exact:true}).click();
 await page.getByRole('button',{name:'Pin account',exact:true}).click();
 await page.setViewportSize({width:440,height:560});await page.goto(`chrome-extension://${extensionId}/popup.html`);
 await expect(page.locator('.quick-account')).toHaveCount(6);
 await expect(page.locator('.quick-account').first()).toContainText('GPT Projects');
 await page.reload();await expect(page.locator('.quick-account').first()).toContainText('GPT Projects');
 expect(await page.locator('.quick-main').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
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
 for(const [surface,width] of [['dashboard',1120],['sidepanel',360],['popup',440]] as const){
  await page.setViewportSize({width,height:600});await page.goto(`chrome-extension://${extensionId}/${surface}.html`);
  if(surface==='popup'){
   await expect(page.getByRole('button',{name:`View ${fixture.accounts[0]!.alias} in full dashboard`,exact:true})).toBeVisible();
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   continue;
  }
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
 expect((await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).some(s=>s.id==='mylimits-observer-perplexity')).toBe(false);
 const account=result.data.accounts.find((a:Account)=>a.provider==='perplexity');expect(account.meters[0].usedPercent).toBeNull();expect(account.meters[0].total).toBeNull();
 await page.getByRole('button',{name:'Details for Perplexity',exact:true}).click();await page.getByRole('button',{name:'Rename Perplexity',exact:true}).click();await page.getByLabel('Account nickname').fill('Personal search');await page.getByRole('button',{name:'Save nickname',exact:true}).click();
 await page.getByRole('button',{name:'Accounts',exact:true}).click();await page.getByLabel('Reading source for Perplexity').selectOption('activity');
 await expect.poll(async()=>worker.evaluate(async()=>{const s=(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store;return s.accounts.find(a=>a.kind==='browser'&&a.provider==='perplexity')?.connection})).toBe('active');
 const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);expect(saved.accounts.find(a=>a.id===account.id)!.alias).toBe('Personal search');expect(saved.accounts.find(a=>a.id===account.id)!.connection).toBe('inactive');expect(saved.providers.perplexity.readingMode).toBe('activity');
 expect((await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).some(s=>s.id==='mylimits-observer-perplexity')).toBe(true);await page.getByLabel('Reading source for Perplexity').selectOption('quota');await expect.poll(async()=>worker.evaluate(async()=>(await chrome.scripting.getRegisteredContentScripts()).some(s=>s.id==='mylimits-observer-perplexity'))).toBe(false);
});

test('history insights separate windows, show cautious pacing and persist 90-day retention',async({context,worker,extensionId})=>{
 const now=Date.now(),fixture=emptyStore('history-insights-fixture');fixture.accounts=[{...demoState(now).accounts[0]!,connection:'active'}];const id=fixture.accounts[0]!.id;
 fixture.connections[0]={...fixture.connections[0]!,enabled:true,status:'active',accountId:id,lastAttemptAt:now,lastSuccessAt:now};fixture.providers.claude={...fixture.providers.claude,enabled:true,status:'active',activeAccountId:id,checkedAt:now};await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 await worker.evaluate(async({id,now})=>{await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('mylimits-history',2);req.onsuccess=()=>{const db=req.result,tx=db.transaction('readings','readwrite');for(let i=0;i<5;i++)tx.objectStore('readings').add({accountId:id,time:now-(4-i)*600000,connectionId:'website:claude',meters:[{id:'session',label:'Session',scope:'subscription',evidence:'reported',unit:'percent',usedPercent:10+i*5,resetsAt:now+7200000}]});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})}, {id,now});
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html`);await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.getByText(/At a similar pace:/)).toBeVisible();await expect(page.getByRole('img',{name:/separate observed segments/})).toBeVisible();await page.getByText('Reported reset timeline',{exact:true}).click();await expect(page.getByText(/a new reading must confirm/)).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('History retention').selectOption('90');await page.getByRole('button',{name:'Save preferences'}).click();await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.getByText(/90-day local retention/)).toBeVisible();
});

test('Guide is removed and its legacy link lands on Overview without prompt tools',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('removed-guide'),accounts:demoState().accounts};await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html#guide`);
 await expect(page.getByRole('button',{name:'Guide',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByLabel('Prompt to review')).toHaveCount(0);
});

test.describe('Website widget fixture',()=>{
test.use({grantedProviderOrigin:'https://claude.ai/*'});
test('widget opt-in isolates page CSS, rejects page actions and removes on disable',async({context,worker,extensionId})=>{
 const fixture=emptyStore('widget-private-salt');await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const dashboard=await context.newPage();await dashboard.goto(`chrome-extension://${extensionId}/dashboard.html`);
 // Isolated fixture build grants only this synthetic website; headless Chrome cannot approve permission UI.
 expect(await worker.evaluate(()=>chrome.permissions.contains({origins:['https://claude.ai/*']}))).toBe(true);
 await context.route('https://claude.ai/**',r=>r.fulfill({contentType:'text/html',body:'<html><head><style>section,button,strong,p{display:none!important}body{background:white;color:black}</style></head><body><textarea id="composer">DO NOT READ</textarea></body></html>'}));
 const website=await context.newPage();await website.goto('https://claude.ai/new');await expect(website.locator('#mylimits-usage-widget')).toHaveCount(0);
 await dashboard.getByRole('button',{name:'Settings',exact:true}).click();await dashboard.getByLabel('Preview on Claude',{exact:true}).check();
 const launcher=website.getByRole('button',{name:'MyLimits preview',exact:true});await expect(launcher).toBeVisible();
 await launcher.evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));await expect(website.getByText('Coming soon',{exact:true})).toHaveCount(0);
 await launcher.click();await expect(website.getByText('Coming soon',{exact:true})).toBeVisible();
 expect(await website.locator('#composer').inputValue()).toBe('DO NOT READ');
 await website.screenshot({path:'artifacts/v3-floating-preview.png'});
 await website.keyboard.press('Escape');await expect(launcher).toHaveAttribute('aria-expanded','false');await expect(launcher).toBeFocused();
 await launcher.click();await website.locator('#composer').click();await expect(launcher).toHaveAttribute('aria-expanded','false');
 await launcher.click();await website.getByLabel('Preview position').focus();await website.keyboard.press('End');await website.keyboard.press('Tab');
 await expect.poll(()=>website.locator('#mylimits-usage-widget').evaluate(e=>getComputedStyle(e).left)).toBe('16px');
 const second=await context.newPage();await second.goto('https://claude.ai/new');await expect(second.locator('#mylimits-usage-widget')).toBeVisible();
 await website.evaluate(()=>{history.pushState({},'', '/chat/fixture');document.getElementById('mylimits-usage-widget')?.remove()});await expect(website.locator('#mylimits-usage-widget')).toHaveCount(1);
 const tabId=await worker.evaluate(async()=> (await chrome.tabs.query({url:'https://claude.ai/*'}))[0]!.id!);const message=await worker.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:async()=>{const denied=await chrome.runtime.sendMessage({type:'state'}),reading=await chrome.runtime.sendMessage({type:'widget-state',provider:'claude'});return {denied,reading}}}))[0]!.result,tabId);expect(message!.denied.ok).toBe(false);expect(message!.reading.ok).toBe(true);expect(JSON.stringify(message!.reading)).not.toContain('widget-private-salt');expect(message!.reading.data).toEqual({enabled:true,position:'top-left'});
 const scripts=await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts());expect(scripts.find(s=>s.id==='mylimits-widget-claude')!.matches).toEqual(['https://claude.ai/*']);
 await dashboard.getByLabel('Preview on Claude',{exact:true}).uncheck();await expect(website.locator('#mylimits-usage-widget')).toHaveCount(0);await expect(second.locator('#mylimits-usage-widget')).toHaveCount(0);
 const failed=await dashboard.evaluate(()=>chrome.runtime.sendMessage({type:'widget-state',provider:'claude'}));expect(failed.ok).toBe(false);
 await dashboard.getByLabel('Preview on Claude',{exact:true}).check();await expect(launcher).toBeVisible();await launcher.click();await website.getByRole('button',{name:'Hide on this site',exact:true}).click();await expect(website.locator('#mylimits-usage-widget')).toHaveCount(0);await expect(second.locator('#mylimits-usage-widget')).toHaveCount(0);await expect(dashboard.getByLabel('Preview on Claude',{exact:true})).not.toBeChecked();
 await website.reload();await expect(website.locator('#mylimits-usage-widget')).toHaveCount(0);
});

});

// Account setup is deliberately exercised through real extension messages and storage.
test('manual second-account setup survives popup closure and protects the first nickname', async ({context, worker, extensionId}) => {
  await worker.evaluate(() => {
    const scope=globalThis as typeof globalThis & {fixtureIdentity:string}; scope.fixtureIdentity='account-a';
    const contains=chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains=async p=>p.origins?.includes('https://claude.ai/*')?true:contains(p);
    globalThis.fetch=async input=>{
      const path=new URL(String(input)).pathname;
      const data=path==='/api/account'?{uuid:scope.fixtureIdentity}:path==='/api/organizations'?[{uuid:'fixture-org-'+scope.fixtureIdentity,name:'Personal space',capabilities:['chat']}]:{five_hour:{utilization:25,resets_at:new Date(Date.now()+3600000).toISOString()}};
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    };
  });
  const page=await context.newPage(); await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
  await page.evaluate(()=>{chrome.permissions.request=async()=>true});
   await page.getByRole('button',{name:/Claude · Claude Code/}).click();
  await page.getByLabel('New account nickname').fill('Personal');
  await page.getByRole('button',{name:'Detect current account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save detected account',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save detected account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Details for Personal',exact:true})).toBeVisible();
  await page.locator('.app-footer').getByRole('button',{name:'Add account',exact:true}).click();
  await page.getByRole('button',{name:/Claude · Claude Code/}).click();
  await page.getByLabel('New account nickname').fill('Work');
  await page.getByRole('button',{name:'Save another website account',exact:true}).click();
  await expect(page.getByText('Still seeing the original account.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save detected account'})).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'Continue setup',exact:true}).click();
  await expect(page.getByText('Sign in to your other account',{exact:true})).toBeVisible();
  await worker.evaluate(async()=>{
    (globalThis as typeof globalThis & {fixtureIdentity:string}).fixtureIdentity='account-b';
    const store=(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store;
    store.connections.find(c=>c.id==='website:claude')!.lastAttemptAt=null;
    await chrome.storage.local.set({'mylimits:state:v2':store});
  });
  await page.getByRole('button',{name:'Check account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save detected account',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save detected account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Details for Work',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Details for Personal',exact:true})).toBeVisible();
  const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);
  expect(saved.accounts).toHaveLength(2); expect(saved.accountSetup).toBeNull();
  expect(saved.accounts.find(a=>a.alias==='Personal')!.connection).toBe('inactive');
  expect(saved.accounts.find(a=>a.alias==='Work')!.connection).toBe('active');
  expect(JSON.stringify(saved.accounts)).not.toContain('fixture-org'); // private workspace ids are absent from account records
});

test('popup opens the selected account in the full dashboard and keeps six rows visible',async({context,worker,extensionId})=>{
  const fixture={...emptyStore('compact-six'),accounts:demoState().accounts};
  fixture.accounts.push({...fixture.accounts[0]!,id:'sixth',alias:'Sixth account'});
  await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
  const page=await context.newPage();await page.setViewportSize({width:440,height:560});
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.quick-account')).toHaveCount(6);
  const bounds=await page.locator('.quick-popup').boundingBox();expect(bounds!.width).toBe(440);expect(bounds!.height).toBeLessThanOrEqual(560);
  expect(await page.locator('.quick-main').evaluate(e=>e.scrollHeight<=e.clientHeight)).toBe(true);
  const opened=context.waitForEvent('page');
  await page.getByRole('button',{name:'View GPT Work in full dashboard',exact:true}).click();
  const dashboard=await opened;
  await expect(dashboard.getByRole('button',{name:'Details for GPT Work',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(dashboard.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  await expect(dashboard.getByRole('button',{name:'History',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/compact-popup-six-accounts.png'});
});

test('provider picker lists the supported services and labels Gemini as activity only',async({context,worker,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
  for(const name of ['OpenAI · ChatGPT / Codex','Claude · Claude Code','Cursor','Gemini','Grok','Perplexity'])await expect(page.getByRole('button',{name:new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))})).toBeVisible();
  expect(await page.locator('.connect-provider img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.getByRole('button',{name:/Gemini/}).click();
  await expect(page.getByRole('button',{name:'Enable browser activity',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save another website account',exact:true})).toHaveCount(0);
  const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);
  expect(saved.accounts).toHaveLength(0);
});

test('independent OpenAI setup gives only the new native profile its requested nickname',async({context,worker,extensionId})=>{
 const originalProfile='1f30feba-2b2a-4c19-8ebc-cd35bc96ff71',addedProfile='6c7b581a-333d-4016-955e-98e84dcf22aa';
 await worker.evaluate(({originalProfile,addedProfile})=>{
  const contains=chrome.permissions.contains.bind(chrome.permissions);chrome.permissions.contains=async p=>p.permissions?.includes('nativeMessaging')?true:contains(p);
  const profiles=[{id:originalProfile,status:'active',plan:'plus',updatedAt:Date.now(),meters:[]}];
  Object.defineProperty(chrome.runtime,'connectNative',{configurable:true,value:()=>{
   let deliver:(value:unknown)=>void=()=>{};
   return {onMessage:{addListener:(f:(value:unknown)=>void)=>{deliver=f}},onDisconnect:{addListener:()=>{}},disconnect:()=>{},postMessage:(request:{id:string;method:string})=>{
    let data:unknown={type:'snapshot',profiles};
    if(request.method==='add'){profiles.push({id:addedProfile,status:'signed-out',plan:'plus',updatedAt:0,meters:[]});data={profile:addedProfile,browserOpened:true}}
    setTimeout(()=>deliver({id:request.id,ok:true,data}),0);
   }};
  }});
 },{originalProfile,addedProfile});
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/dashboard.html#add`);
 await page.evaluate(()=>{chrome.permissions.request=async()=>true});
 await page.getByRole('button',{name:/OpenAI · ChatGPT/}).click();
 await page.getByLabel('New account nickname').fill('Independent work');
 await page.getByRole('button',{name:'Independent OpenAI connection',exact:true}).click();
 const before=context.pages().length;
 await page.getByRole('button',{name:'Connect OpenAI',exact:true}).click();
 expect(context.pages().length).toBe(before); // Updated helper owns the isolated sign-in window.
 await expect.poll(async()=>worker.evaluate(async()=>((await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store).accounts.find(a=>a.companionProfile==='6c7b581a-333d-4016-955e-98e84dcf22aa')?.alias)).toBe('Independent work');
 const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);
 expect(saved.accounts.find(a=>a.companionProfile===originalProfile)!.alias).toBe('');
 expect(saved.accounts.find(a=>a.companionProfile===addedProfile)!.connection).toBe('signed-out');
 expect(JSON.stringify(saved)).not.toContain('auth.openai.com');
});

test('larger account collections scroll inside the popup and search stays available',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('many-accounts'),accounts:demoState().accounts};
 for(let i=0;i<5;i++)fixture.accounts.push({...fixture.accounts[0]!,id:`extra-${i}`,alias:`Extra ${i}`});
 await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.setViewportSize({width:440,height:560});await page.goto(`chrome-extension://${extensionId}/popup.html`);
 await expect(page.locator('.quick-account')).toHaveCount(10);
 expect(await page.locator('.quick-main').evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 expect((await page.locator('.quick-footer').boundingBox())!.y).toBeLessThan(560);
 await page.getByLabel('Search accounts').fill('Extra 3');await expect(page.locator('.quick-account')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'View Extra 3 in full dashboard',exact:true})).toBeVisible();
});

test('popup plus opens dashboard setup and local genuine logos load without external requests',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('v3-icons'),accounts:demoState().accounts};await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/popup.html`);
 await expect(page.locator('.provider-mark img')).toHaveCount(5);
 expect(await page.locator('.provider-mark img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 expect(await page.locator('.quick-copy strong').first().evaluate(e=>getComputedStyle(e).fontSize)).toBe('14px');
 const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Add account',exact:true}).click();const dashboard=await opened;
 await expect(dashboard.getByRole('region',{name:'Add an account'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Add an account'})).toHaveCount(0);
});

test('large text persists, privacy masks every surface, and 200 percent enlargement retains controls',async({context,worker,extensionId})=>{
 const fixture={...emptyStore('v3-layout-private'),accounts:demoState().accounts};
 fixture.accounts[0]!.alias='Private writing workspace with a very long account name';
 await worker.evaluate(async s=>chrome.storage.local.set({'mylimits:state:v2':s}),fixture);
 const page=await context.newPage();await page.setViewportSize({width:1120,height:920});await page.goto(`chrome-extension://${extensionId}/dashboard.html#settings`);
 await page.getByLabel('Text size',{exact:true}).selectOption('large');await page.getByLabel('Privacy mode',{exact:true}).selectOption('on');await page.getByRole('button',{name:'Save preferences'}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-text-size','large');await expect(page.getByLabel('Privacy mode',{exact:true})).toHaveValue('on');
 for(const tab of ['Overview','Accounts','History']){await page.getByRole('button',{name:tab,exact:true}).click();for(const a of fixture.accounts)await expect(page.getByText(a.alias,{exact:false})).toHaveCount(0);}
 await expect(page.getByRole('button',{name:'Export JSON',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Details for Account 1',exact:true}).click();await expect(page.getByRole('button',{name:'Rename Account 1',exact:true})).toBeDisabled();
 await page.setViewportSize({width:560,height:920});await page.evaluate(()=>{document.documentElement.style.fontSize='32px'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const saved=await worker.evaluate(async()=>(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as Store);expect(saved.accounts[0]!.alias).toBe(fixture.accounts[0]!.alias);
 const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);await expect(popup.getByRole('button',{name:'View Account 1 in full dashboard',exact:true})).toBeVisible();await expect(popup.getByText(fixture.accounts[0]!.alias)).toHaveCount(0);
});
