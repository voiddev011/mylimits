import { test as base,expect,chromium,type BrowserContext,type Page } from '@playwright/test';
import { build } from 'vite';
import { mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import path from 'node:path';
import type { browser } from 'wxt/browser';declare const chrome:typeof browser;
declare const VaultKeys:typeof import('../fixtures/vault-api');
// Bundle the actual adapter into memory for CDP injection in this test only.
// No extra extension entrypoint, exposed runtime method or shipped test helper.
let source:Promise<string>|undefined;
function bundle(){return source??=(async()=>{
 const built=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:path.resolve('tests/fixtures/vault-api.ts'),name:'VaultKeys',formats:['iife']}}});
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
