import { test as base,expect,chromium,type BrowserContext,type Page } from '@playwright/test';
import { build } from 'vite';
import { mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import path from 'node:path';
import type { browser } from 'wxt/browser';declare const chrome:typeof browser;
declare const VaultKeys:typeof import('../fixtures/vault-api');
declare global {var SavedUI:Awaited<ReturnType<typeof VaultKeys.mountPrivateUI>>;}
// Bundle the actual adapter into memory for CDP injection in this test only.
// No extra extension entrypoint, exposed runtime method or shipped test helper.
let source:Promise<string>|undefined;
function bundle(){return source??=(async()=>{
 const built=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production')},esbuild:{jsx:'automatic'},build:{write:false,minify:false,lib:{entry:path.resolve('tests/fixtures/vault-api.ts'),name:'VaultKeys',formats:['iife']}}});
 const results=Array.isArray(built)?built:[built],result=results[0];
 if(results.length!==1||!result||!('output' in result))throw Error('Expected one fixture bundle');
 const chunk=result.output.find(c=>c.type==='chunk');if(!chunk||chunk.type!=='chunk')throw Error('Missing fixture bundle');return chunk.code;
})();}
const test=base.extend<{context:BrowserContext;extensionId:string}>({
 context:async({},use)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'mylimits-vault-keys-')),extension=path.resolve('.output/chrome-mv3');
  const context=await chromium.launchPersistentContext(dir,{channel:'chromium',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--disable-background-networking']});
  await context.route(/^https?:\/\//,r=>r.abort());
  try{await use(context);}finally{await context.close();await rm(dir,{recursive:true,force:true});}
 },
 extensionId:async({context},use)=>{const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');await use(new URL(worker.url()).host);},
});
async function open(context:BrowserContext,id:string):Promise<Page>{const page=await context.newPage();await page.goto(`chrome-extension://${id}/dashboard.html`);await page.evaluate(await bundle());return page;}
test('actual IndexedDB persists a non-extractable key across page reload without exporting it',async({context,extensionId})=>{
 const page=await open(context,extensionId);
 const encrypted=await page.evaluate(async()=>{
  const keys=VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}),key=await keys.create(),iv=crypto.getRandomValues(new Uint8Array(12));
  let refused=false;try{await crypto.subtle.exportKey('raw',key);}catch{refused=true;}
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('fictional-key-check'));
  return {iv:[...iv],bytes:[...new Uint8Array(bytes)],refused,extractable:key.extractable};
 });expect(encrypted.refused).toBe(true);expect(encrypted.extractable).toBe(false);
 await page.reload();await page.evaluate(await bundle());
 expect(await page.evaluate(async({iv,bytes})=>{
  const key=await VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}).load();if(!key)return false;
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(iv)},key,new Uint8Array(bytes)))==='fictional-key-check';
 },encrypted)).toBe(true);
});
test('concurrent extension contexts create one usable key instead of overwriting each other',async({context,extensionId})=>{
 const [a,b]=await Promise.all([open(context,extensionId),open(context,extensionId)]);
 const make=()=>{
  return a.evaluate(async()=>{const key=await VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}).create(),iv=crypto.getRandomValues(new Uint8Array(12));return {iv:[...iv],bytes:[...new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('shared-winner')))]};});
 };
 const [cipher]=await Promise.all([make(),b.evaluate(async()=>{await VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}).create();})]);
 expect(await b.evaluate(async({iv,bytes})=>{const key=await VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}).load();return !!key&&new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(iv)},key,new Uint8Array(bytes)))==='shared-winner';},cipher)).toBe(true);
});
test('a corrupt stored key fails closed and is never silently replaced',async({context,extensionId})=>{
 const page=await open(context,extensionId);
 expect(await page.evaluate(async()=>{
  const keys=VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto});await keys.create();
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('mylimits-vault-key',1);r.onerror=()=>reject();r.onsuccess=()=>{const db=r.result,tx=db.transaction('keys','readwrite');tx.objectStore('keys').put({type:'secret',extractable:false,algorithm:{name:'AES-GCM',length:256}},'primary');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject();};});
  try{await keys.create();return false;}catch(e){return e instanceof Error&&e.message==='Saved sign-in key-unavailable.';}
 })).toBe(true);
});
test('actual extension vault storage survives reload and never enters public state or history exports',async({context,extensionId})=>{
 const page=await open(context,extensionId);
 const result=await page.evaluate(async()=>{
  const vault=VaultKeys.createVault({local:chrome.storage.local,crypto,keys:VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}),now:()=>Date.now(),
   enabled:()=>true,allowlist:()=>['fictional'],lock:async run=>await navigator.locks.request('mylimits:vault:v1',run)});
  const slot='10000000-0000-4000-8000-000000000001';
  await vault.putVault(slot,'chatgpt',{v:1,origin:'https://chatgpt.com',cookies:[{name:'fictional',value:'FICTIONAL_VAULT_SECRET'}]});
  const stored=await chrome.storage.local.get('mylimits:vault:v1'),metadata=await vault.listVault();
  const publicState=await chrome.runtime.sendMessage({type:'state'}),exported=await chrome.runtime.sendMessage({type:'export-history',format:'json'});
  return {encrypted:!JSON.stringify(stored).includes('FICTIONAL_VAULT_SECRET'),publicOk:publicState.ok,exportOk:exported.ok,metadata:JSON.stringify(metadata),publicState:JSON.stringify(publicState),exported:JSON.stringify(exported)};
 });expect(result.encrypted).toBe(true);
 expect(result.publicOk).toBe(true);expect(result.exportOk).toBe(true);
 for(const output of [result.metadata,result.publicState,result.exported])for(const secret of ['FICTIONAL_VAULT_SECRET','ciphertext','nonce'])expect(output).not.toContain(secret);
 await page.reload();await page.evaluate(await bundle());
 expect(await page.evaluate(async()=>{
  const vault=VaultKeys.createVault({local:chrome.storage.local,crypto,keys:VaultKeys.createIndexedDBVaultKeys({indexedDB,crypto}),now:()=>Date.now(),
   enabled:()=>true,allowlist:()=>['fictional'],lock:async run=>await navigator.locks.request('mylimits:vault:v1',run)});
  return (await vault.getVault('10000000-0000-4000-8000-000000000001','chatgpt'))?.payload.cookies[0]?.value==='FICTIONAL_VAULT_SECRET';
 })).toBe(true);
});
test('simulated private-provider runtime verifies two accounts, saves only on consent and refreshes from encrypted slots',async({context,extensionId})=>{
 const page=await open(context,extensionId),result=await page.evaluate(async()=>await VaultKeys.privateFlow(chrome));
 expect(result.accountCount).toBe(3);expect(result.aliases).toEqual(['Keep work','Personal B','Personal C']);expect(result.keptAlias).toBe('Keep work');
 expect(result.slots).toBe(2);expect(result.retainedSlots).toBe(2);expect(result.encrypted).toBe(true);expect(result.secretFree).toBe(true);
 expect(result.identities).toEqual(['B:acc-B','C:acc-C']);expect(result.quotas).toEqual([65,65]);expect(result.scopes).toEqual(['work-codex','work-codex']);
 expect(result.ambientReads).toBe(0);expect(result.normalUnchanged).toBe(true);expect(result.removed).toBe(3);expect(result.requests).toBeGreaterThanOrEqual(12);
 expect(result.cleanRules).toBe(true);expect(result.duplicate).toBe(true);expect(result.journalGone).toBe(true);
 expect(result.rejection).toBe('saved-http-401');expect(result.challenge).toBe(true);
});
test('production private commands remain disabled and validate consent and exact dashboard sender',async({context,extensionId})=>{
 const page=await open(context,extensionId);
 const result=await page.evaluate(async()=>{
  const start={type:'vault-signin-start',provider:'chatgpt',method:'private',nickname:'Personal'};
  const denied=await chrome.runtime.sendMessage(start),invalid=await chrome.runtime.sendMessage({...start,cookie:'FICTIONAL_REJECTED'}),consent=await chrome.runtime.sendMessage({type:'vault-signin-save',setupId:'10000000-0000-4000-8000-000000000001',accountId:'fictional',consent:false});
  return {denied,invalid,consent,state:await chrome.runtime.sendMessage({type:'state'}),storage:JSON.stringify(await chrome.storage.local.get(null))};
 });expect(result.denied.ok).toBe(false);expect(result.denied.error).toContain('disabled');expect(result.denied.code).toBe('disabled');expect(result.invalid.ok).toBe(false);expect(result.consent.ok).toBe(false);
 expect(result.state.data.accountSetup??null).toBeNull();expect(result.storage).not.toContain('FICTIONAL_REJECTED');
 const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);
 const denied=await popup.evaluate(async()=>await chrome.runtime.sendMessage({type:'vault-signin-start',provider:'chatgpt',method:'private',nickname:''}));
 expect(denied.ok).toBe(false);expect(denied.error).toContain('normal MyLimits dashboard');
});
test('simulated first-account sign-in UI requires explicit consent and saves an encrypted dated account',async({context,extensionId})=>{
 const page=await open(context,extensionId);await page.evaluate(async()=>{globalThis.SavedUI=await VaultKeys.mountPrivateUI(chrome,{empty:true})});
 await expect(page.getByRole('radio',{name:'Private sign-in (recommended)'})).toBeChecked();await page.getByRole('button',{name:'Start private sign-in',exact:true}).click();
 await expect(page.getByText('Identity checked',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save account',exact:true})).toBeDisabled();
 await page.screenshot({path:'test-results/c11-consent.png',fullPage:true});
 await page.getByLabel('Saved account nickname').fill('Personal');await page.getByRole('checkbox',{name:/I agree to save/}).check();await page.getByRole('button',{name:'Save account',exact:true}).click();await expect(page.getByText('Saved 1 account',{exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>({state:await SavedUI.read(),slots:await SavedUI.slots(),metrics:SavedUI.metrics(),stored:JSON.stringify(await chrome.storage.local.get('mylimits:vault:v1'))}));
 expect(result.state.accounts).toHaveLength(1);expect(result.state.accounts[0]!.alias).toBe('Personal');expect(result.slots).toHaveLength(1);expect(result.metrics.ambientReads).toBe(0);expect(result.metrics.normalUnchanged).toBe(true);expect(result.stored).not.toContain('FICTIONAL_PRIVATE_');
 expect(result.state.connections.find(c=>c.kind==='vault')!.savedSignIn).toEqual({method:'private',notAfter:1800000020000+3*86400000});
});
test('simulated sign-in UI connects B and C beside normal A and removes only one encrypted connection',async({context,extensionId})=>{
 const page=await open(context,extensionId);await page.evaluate(async()=>{globalThis.SavedUI=await VaultKeys.mountPrivateUI(chrome)});
 for(const [id,name] of [['B','Personal'],['C','Other']] as const){
  await page.evaluate(id=>SavedUI.identity(id),id);await page.getByRole('button',{name:'Start private sign-in',exact:true}).click();await expect(page.getByText('Identity checked',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save account',exact:true})).toBeDisabled();await page.getByLabel('Saved account nickname').fill(name);await page.getByRole('checkbox',{name:/I agree to save/}).check();await page.getByRole('button',{name:'Save account',exact:true}).click();await expect(page.getByText(`Saved ${id==='B'?1:2} account`,{exact:true})).toBeVisible();
 }
 const before=await page.evaluate(()=>SavedUI.read());expect(before.accounts.map(a=>a.alias)).toEqual(['Keep work','Personal','Other']);
 const target=before.connections.find(c=>c.accountId===before.accounts[1]!.id)!;
 await page.evaluate(async state=>{await chrome.storage.local.set({'mylimits:state:v2':state})},before);
 expect((await page.evaluate(id=>chrome.runtime.sendMessage({type:'disconnect',connectionId:id}),target.id)).ok).toBe(true);
 const after=await page.evaluate(async()=>({state:(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as import('../../src/core/model').Store,slots:await SavedUI.slots(),metrics:SavedUI.metrics(),envelope:(await chrome.storage.local.get('mylimits:vault:v1'))['mylimits:vault:v1'] as {entries:Record<string,unknown>}}));
 expect(after.slots).toHaveLength(1);expect(after.envelope.entries[target.profileId!]).toBeUndefined();expect(after.state.connections.some(c=>c.id===target.id)).toBe(false);expect(after.state.accounts[1]!.connection).toBe('inactive');expect(after.state.accounts[2]).toEqual(before.accounts[2]);expect(after.state.accounts[0]).toEqual(before.accounts[0]);expect(after.metrics.ambientReads).toBe(0);expect(after.metrics.normalUnchanged).toBe(true);
 expect((await page.evaluate(accountId=>chrome.runtime.sendMessage({type:'forget',accountId}),before.accounts[2]!.id)).ok).toBe(true);
 const forgotten=await page.evaluate(async()=>({slots:await SavedUI.slots(),state:(await chrome.storage.local.get('mylimits:state:v2'))['mylimits:state:v2'] as import('../../src/core/model').Store}));
 expect(forgotten.slots).toHaveLength(0);expect(forgotten.state.accounts.map(a=>a.alias)).toEqual(['Keep work','Personal']);expect(forgotten.state.connections.some(c=>c.kind==='vault')).toBe(false);
});
test('simulated incognito denial offers explicit current-login fallback; privacy blocks identity confirmation',async({context,extensionId})=>{
 const page=await open(context,extensionId);await page.evaluate(async()=>{globalThis.SavedUI=await VaultKeys.mountPrivateUI(chrome,{incognito:false})});
 await page.getByRole('button',{name:'Start private sign-in',exact:true}).click();await expect(page.getByText('Allow in Incognito',{exact:true})).toBeVisible();
 expect((await page.evaluate(()=>SavedUI.metrics())).requests).toBe(0);
 await page.getByRole('radio',{name:'Save current login',exact:true}).check();await page.getByRole('button',{name:'Save current login',exact:true}).click();await expect(page.getByText('Identity checked',{exact:true})).toBeVisible();await expect(page.getByText('Signing out of the website will probably end this connection.',{exact:true})).toBeVisible();
 await page.evaluate(()=>SavedUI.privacy(true));await expect(page.getByLabel('Saved account nickname')).toBeDisabled();await expect(page.getByRole('checkbox',{name:/I agree to save/})).toBeDisabled();await expect(page.getByRole('button',{name:'Save account',exact:true})).toBeDisabled();await expect(page.getByText('Turn off Privacy mode to confirm this account.',{exact:true})).toBeVisible();
 await page.evaluate(()=>SavedUI.privacy(false));await page.getByRole('checkbox',{name:/I agree to save/}).check();await page.getByRole('button',{name:'Save account',exact:true}).click();await expect(page.getByText('Saved 1 account',{exact:true})).toBeVisible();
 const state=await page.evaluate(()=>SavedUI.read());expect(state.accounts).toHaveLength(1);expect(state.accounts[0]!.alias).toBe('Keep work');expect(state.connections.find(c=>c.kind==='website'&&c.provider==='chatgpt')!.enabled).toBe(false);expect(state.connections.find(c=>c.kind==='vault')!.savedSignIn!.method).toBe('current');
});
test('simulated sign-in UI cancellation leaves no credential; permission denial cannot open login',async({context,extensionId})=>{
 const page=await open(context,extensionId);await page.evaluate(async()=>{globalThis.SavedUI=await VaultKeys.mountPrivateUI(chrome)});await page.getByRole('button',{name:'Start private sign-in',exact:true}).click();await expect(page.getByText('Identity checked',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel saved sign-in',exact:true}).click();await expect(page.getByRole('button',{name:'Start private sign-in',exact:true})).toBeVisible();expect(await page.evaluate(()=>SavedUI.slots())).toHaveLength(0);expect((await page.evaluate(()=>SavedUI.read())).accountSetup).toBeNull();
 await page.evaluate(()=>SavedUI.permission(false));const before=await page.evaluate(()=>SavedUI.metrics());await page.getByRole('button',{name:'Start private sign-in',exact:true}).click();await expect(page.getByText('Saved-sign-in access was not granted. Nothing was connected.',{exact:true})).toBeVisible();expect(await page.evaluate(()=>SavedUI.metrics())).toEqual(before);
});
