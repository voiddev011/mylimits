import { test as base,expect,chromium,type BrowserContext,type Worker } from '@playwright/test';
import { mkdtemp,cp,readFile,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';import { tmpdir } from 'node:os';
import type { browser } from 'wxt/browser';declare const chrome:typeof browser;
const test=base.extend<{context:BrowserContext;worker:Worker;extensionId:string}>({
 context:async({},use)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'mylimits-spike-')),extension=path.join(dir,'extension');
  await cp(path.resolve('.output-spike/chrome-mv3'),extension,{recursive:true});
  const file=path.join(extension,'manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));
  manifest.host_permissions=['https://claude.ai/*','https://chatgpt.com/*']; // Fictional headless permission grant only.
  await writeFile(file,JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(path.join(dir,'profile'),{channel:'chromium',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--disable-background-networking']});
  await context.route(/^https?:\/\//,r=>r.abort());
  try{await use(context);}finally{await context.close();await rm(dir,{recursive:true,force:true});}
 },
 worker:async({context},use)=>{const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');await use(worker);},
 extensionId:async({worker},use)=>use(new URL(worker.url()).host),
});
test('spike loads without automatic tracking, lists real cookie flags and keeps captures/results/storage credential-free',async({context,worker,extensionId})=>{
 await context.addCookies([{name:'sessionKey',value:'FIXTURE_COOKIE_SECRET',url:'https://claude.ai',httpOnly:true,secure:true,expires:Math.floor(Date.now()/1000)+3600}]);
 await worker.evaluate(()=>{
  const scope=globalThis as typeof globalThis & {spikeFixtureReads:number};scope.spikeFixtureReads=0;
  globalThis.fetch=async input=>{scope.spikeFixtureReads++;const p=new URL(String(input)).pathname;const data=p==='/api/account'?{uuid:'ACCOUNT_SECRET'}:p==='/api/organizations'?[{uuid:'WORKSPACE_SECRET',name:'Personal',capabilities:['chat']}]:{five_hour:{utilization:15}};return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});};
 });
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/spike.html`);
 await expect(page.getByRole('status')).toContainText('Ready.');
 await expect(page.getByRole('heading',{name:'MyLimits evidence spike',exact:true})).toBeVisible();
 expect(await worker.evaluate(()=>(globalThis as typeof globalThis & {spikeFixtureReads:number}).spikeFixtureReads)).toBe(0);
 expect(await worker.evaluate(()=>chrome.storage.local.get(null))).toEqual({});
 await page.getByRole('button',{name:'List cookie metadata',exact:true}).click();
 await expect(page.locator('#cookies-table input')).toHaveCount(1);
 await page.locator('#cookies-table input').check();await page.locator('#consent').check();
 await page.getByRole('button',{name:'Capture selected names in memory',exact:true}).click();await expect(page.locator('#results')).toContainText('Capture metadata');
 await page.getByRole('button',{name:'Compare three transports',exact:true}).click();
 await expect(page.locator('#results')).toContainText('reader-validated');
 await expect.poll(()=>worker.evaluate(()=>(globalThis as typeof globalThis & {spikeFixtureReads:number}).spikeFixtureReads)).toBe(12);
 const text=await page.locator('body').innerText();for(const secret of ['FIXTURE_COOKIE_SECRET','ACCOUNT_SECRET','WORKSPACE_SECRET'])expect(text).not.toContain(secret);
 const storage=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
 expect(JSON.stringify(storage)).not.toContain('FIXTURE_COOKIE_SECRET');expect(storage.local).toEqual({});
 expect(await worker.evaluate(()=>chrome.declarativeNetRequest.getSessionRules())).toEqual([]);
 await page.getByRole('button',{name:'Clear captured state and results',exact:true}).click();await expect(page.locator('#results')).toBeEmpty();
});
test('C decodes only expiry and F returns only status with credentials omitted and no installed rule',async({context,worker,extensionId})=>{
 await worker.evaluate(()=>{
  const scope=globalThis as typeof globalThis & {spikeRequestFlags:{path:string;credentials:string|undefined;authorization:boolean}[]};scope.spikeRequestFlags=[];
  const token=`e30.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,secret:'TOKEN_BODY_SECRET'}))}.TOKEN_SECRET`;
  globalThis.fetch=async(input,init)=>{const p=new URL(String(input)).pathname;scope.spikeRequestFlags.push({path:p,credentials:init?.credentials,authorization:new Headers(init?.headers).has('Authorization')});return new Response(JSON.stringify(p==='/api/auth/session'?{accessToken:token}:{rate_limit:{primary_window:{used_percent:20}}}),{headers:{'content-type':'application/json'}});};
 });
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/spike.html`);await expect(page.getByRole('status')).toContainText('Ready.');
 await page.getByRole('button',{name:'Inspect expiry and test Bearer',exact:true}).click();await expect(page.locator('#results')).toContainText('signatureVerified');
 expect(await page.locator('body').innerText()).not.toContain('TOKEN_SECRET');expect(await page.locator('body').innerText()).not.toContain('TOKEN_BODY_SECRET');
 // Fixture-only clock setup: no real provider requests occur in this suite.
 await worker.evaluate(()=>{const clock=Date.now;Date.now=()=>clock()+16000;});
 await page.getByRole('button',{name:'Test Bearer-only status',exact:true}).click();await expect(page.locator('#results article').first()).toContainText('200');
 const flags=await worker.evaluate(()=>(globalThis as typeof globalThis & {spikeRequestFlags:unknown[]}).spikeRequestFlags);
 expect(flags).toEqual([{path:'/api/auth/session',credentials:'include',authorization:false},{path:'/backend-api/wham/usage',credentials:'omit',authorization:true},{path:'/backend-api/wham/usage',credentials:'omit',authorization:true}]);
 expect(await worker.evaluate(()=>chrome.declarativeNetRequest.getSessionRules())).toEqual([]);
});
test('spike transport rejects provider-page ports and malformed or credential-bearing messages',async({context,worker,extensionId})=>{
 const warm=await context.newPage();await warm.goto(`chrome-extension://${extensionId}/spike.html`);await expect(warm.getByRole('status')).toContainText('Ready.');await warm.close();
 await context.route('https://claude.ai/**',r=>r.fulfill({body:'<p>Fictional provider</p>',contentType:'text/html'}));
 const website=await context.newPage();await website.goto('https://claude.ai/');
 const denied=await worker.evaluate(async()=>{
  const tab=(await chrome.tabs.query({url:'https://claude.ai/*'}))[0]!;
  return (await chrome.scripting.executeScript({target:{tabId:tab.id!},func:()=>new Promise<boolean>(resolve=>{const p=chrome.runtime.connect({name:'mylimits-spike-v1'});p.onDisconnect.addListener(()=>{void chrome.runtime.lastError;resolve(true);});})}))[0]!.result;
 });expect(denied).toBe(true);
 const page=await context.newPage();await page.addInitScript(()=>{
  const connect=chrome.runtime.connect.bind(chrome.runtime);
  Object.defineProperty(chrome.runtime,'connect',{configurable:true,value:(options:{name:string})=>{const port=connect(options);(window as typeof window & {fixtureSpikePort:typeof port}).fixtureSpikePort=port;return port;}});
 });await page.goto(`chrome-extension://${extensionId}/spike.html`);await expect(page.getByRole('status')).toContainText('Ready.');
 const malformed=await page.evaluate(()=>new Promise<unknown>(resolve=>{
  const port=(window as typeof window & {fixtureSpikePort:ReturnType<typeof chrome.runtime.connect>}).fixtureSpikePort;
  port.onMessage.addListener(packet=>{if(packet.id===999)resolve(packet);});
  port.postMessage({id:999,command:{type:'compare',provider:'claude',token:'FIXTURE_SECRET'}});
 }));expect(malformed).toEqual({id:999,ok:false,code:'invalid-request'});
 // Closing the first client permits a new validated diagnostic port.
 await page.close();
 const second=await context.newPage();await second.goto(`chrome-extension://${extensionId}/spike.html`);await expect(second.getByRole('status')).toContainText('Ready.');
 expect(await worker.evaluate(()=>chrome.storage.local.get(null))).toEqual({});
});
test('a popup-context fixture promotes diagnostics to a persistent tab before creating a client',async({context,extensionId})=>{
 const popup=await context.newPage();
 await popup.addInitScript(()=>{chrome.tabs.getCurrent=async()=>undefined;});
 const opened=context.waitForEvent('page');
 await popup.goto(`chrome-extension://${extensionId}/spike.html`).catch(()=>{});
 const full=await opened;await expect(full.getByRole('status')).toContainText('Ready.');
 expect(full.url()).toBe(`chrome-extension://${extensionId}/spike.html`);
});
