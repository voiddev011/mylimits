import test from 'node:test';import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';import pg from 'pg';import { randomUUID } from 'node:crypto';import { cp,readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import path from 'node:path';
import { createApp } from '../../src/app';import { migrate,hash } from '../../src/db';import { ownerId } from '../../src/auth';import { emptyStore } from '../../../src/core/model';import { applySnapshot } from '../../../src/core/engine';import type { browser } from 'wxt/browser';declare const chrome:typeof browser;
test('built extension pairs over HTTP, uploads original dated snapshots and deletes by source',async()=>{
 const url=process.env.MYLIMITS_TEST_DATABASE_URL;if(!url)throw Error('Set MYLIMITS_TEST_DATABASE_URL.');const origin='http://127.0.0.1:8789',source=path.resolve('../.output/chrome-mv3');
 assert.ok((await readFile(path.join(source,'manifest.json'),'utf8')).includes('http://127.0.0.1/*'),'Build extension with MYLIMITS_SYNC_ORIGIN=http://127.0.0.1:8789 first.');
 const directory=await mkdtemp(path.join(tmpdir(),'mylimits-transport-')),extension=path.join(directory,'extension');await cp(source,extension,{recursive:true});const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['http://127.0.0.1/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest)); // Fixture-only grant: headless Chrome cannot approve permission prompts.
 const schema=`transport_${randomUUID().replaceAll('-','')}`,admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);const pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`});await migrate(pool);
 const context=await chromium.launchPersistentContext(path.join(directory,'profile'),{executablePath:process.env.CHROMIUM_PATH,channel:process.env.CHROMIUM_PATH?undefined:'chromium',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--disable-background-networking']});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;const app=createApp({config:{environment:'test',databaseUrl:url,origin,allowedOrigins:[`chrome-extension://${id}`],host:'127.0.0.1',port:8789},pool});
 try{
  await app.listen({host:'127.0.0.1',port:8789});await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const owner=ownerId('https://fixture.invalid','transport-alice'),session=randomUUID();await pool.query('INSERT INTO owners(id) VALUES($1)',[owner]);await pool.query("INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(session),owner]);await context.addCookies([{name:'mylimits_session',value:session,url:origin,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();await page.goto(`chrome-extension://${id}/dashboard.html`);await page.getByText('A clear view starts here.',{exact:true}).waitFor(); // Wait for durable schema/history initialization before fixture writes.
  const observed=Date.now()-3600000;const state=applySnapshot(emptyStore('TRANSPORT_PRIVATE_INSTALL_SALT'),'claude','transport-source',{kind:'account',displayName:'Transport fixture',plan:null,meters:[{id:'session',label:'Session',scope:'subscription',evidence:'reported',unit:'percent',usedPercent:40,used:null,total:null,resetsAt:null,source:'Fixture'}]},observed);
  state.connections=state.connections.map(c=>({...c,enabled:false,status:'disabled'}));state.providers.claude={...state.providers.claude,enabled:false,status:'disabled',activeAccountId:null};state.accounts=state.accounts.map(a=>({...a,connection:'inactive'})); // Test cached sync independently of website refresh.
  await worker.evaluate(async state=>{await chrome.storage.local.set({'mylimits:state:v2':state})},state);await page.getByRole('button',{name:'Details for Transport fixture',exact:true}).waitFor();await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByText('Snapshot sync · advanced',{exact:true}).click();
  const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Connect snapshot sync',exact:true}).click();const web=await opened;await web.waitForLoadState();await web.getByRole('button',{name:'Review device',exact:true}).click();await web.getByRole('button',{name:'Approve this device',exact:true}).click();await page.getByRole('button',{name:'Sync now',exact:true}).waitFor({timeout:15000});await page.getByRole('button',{name:'Sync now',exact:true}).click();
  let rows:{observed_at:string;payload:unknown}[]=[];for(let i=0;i<50;i++){rows=(await pool.query('SELECT observed_at,payload FROM snapshots')).rows;if(rows.length)break;await new Promise(r=>setTimeout(r,100))}const diagnostic=await page.evaluate(()=>chrome.runtime.sendMessage({type:'sync',action:'status'}));assert.equal(rows.length,1,`Snapshot upload missing. Public sync status: ${JSON.stringify(diagnostic)}`);assert.equal(Number(rows[0]!.observed_at),observed);assert.ok(!JSON.stringify(rows).includes('TRANSPORT_PRIVATE_INSTALL_SALT'));
  const status=await page.evaluate(()=>chrome.runtime.sendMessage({type:'sync',action:'status'}));assert.equal(status.data.connected,true);assert.ok(!JSON.stringify(status).includes('ml_device_'));
  const forgotten=await page.evaluate(()=>chrome.runtime.sendMessage({type:'forget',accountId:'transport-source'}));assert.equal(forgotten.ok,true);
  await worker.evaluate(async()=>{const key='mylimits:sync:private:v1',state=(await chrome.storage.local.get(key))[key] as Record<string,unknown>;await chrome.storage.local.set({[key]:{...state,lastAttemptAt:null,nextAttemptAt:null}})});await page.evaluate(()=>chrome.runtime.sendMessage({type:'sync',action:'run'}));assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,0);assert.equal((await pool.query('SELECT count(*)::int AS n FROM source_tombstones')).rows[0].n,1);
 }finally{await context.close();await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();await rm(directory,{recursive:true,force:true})}
});

test('hosted fictional provider crosses real extension/API/PostgreSQL transport without local helper',async()=>{
 const url=process.env.MYLIMITS_TEST_DATABASE_URL;if(!url)throw new Error('Set isolated PostgreSQL URL.');const source=path.resolve('../.output/chrome-mv3'),origin='http://127.0.0.1:8789';
 const {HostedService}=await import('../../src/hosted');const {HostedJobs}=await import('../../src/hosted-jobs');const {CredentialStore}=await import('../../src/credentials');const {registerDevice}=await import('../../src/service');
 const {transaction}=await import('../../src/db');
 const directory=await mkdtemp(path.join(tmpdir(),'mylimits-hosted-transport-')),schema=`hosted_transport_${randomUUID().replaceAll('-','')}`;
 const extension=path.join(directory,'extension');await cp(source,extension,{recursive:true});const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['http://127.0.0.1/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 const admin=new pg.Pool({connectionString:url}),pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`});await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);
 const keys=new Map<string,Uint8Array>(),attempts=new Map<string,{owner:string;proof:string}>();
 const kms={async wrapKey(key:Uint8Array){const id=randomUUID();keys.set(id,Buffer.from(key));return {keyId:'fixture',wrappedKey:id};},async unwrapKey(_id:string,id:string){return Buffer.from(keys.get(id)!);}};
 const driver:import('../../src/hosted').HostedDriver={method:'official-popup',scopes:['work-codex'],minRefreshMs:120000,async begin(c){attempts.set(c.attemptId,c);return {authorizationUrl:`https://auth.openai.com/oauth/authorize?state=${c.proof}`};},async cancel(){},async collect(c){return {subject:c.subject,workspace:c.workspace,providerObservedAt:null,meters:[{id:'five-hour',label:'5 hours',scope:'work-codex',unit:'percent',evidence:'reported',usedPercent:42,used:null,total:null,resetsAt:null,source:'Fictional hosted transport'}]};}};
 const drivers=new Map([['openai' as const,driver]]),hosted=new HostedService(pool,new CredentialStore(pool,kms),'test',drivers);
 const context=await chromium.launchPersistentContext(directory,{executablePath:process.env.CHROMIUM_PATH,channel:process.env.CHROMIUM_PATH?undefined:'chromium',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--disable-background-networking']});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const app=createApp({config:{environment:'test',databaseUrl:url,origin,allowedOrigins:[`chrome-extension://${id}`],host:'127.0.0.1',port:8789},pool,kms,testHostedDrivers:drivers});
 try{
  await app.listen({host:'127.0.0.1',port:8789});
  await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===origin?r.continue():new URL(r.request().url()).hostname==='auth.openai.com'?r.fulfill({status:200,body:'Fictional authorization page — no provider contacted'}):r.abort());
  const owner=ownerId('https://fixture.invalid','hosted-transport');await pool.query('INSERT INTO owners(id) VALUES($1)',[owner]);
  const device=await transaction(pool,db=>registerDevice(db,{owner,kind:'web'},'Fictional laptop'));
  const page=await context.newPage();await page.goto(`chrome-extension://${id}/dashboard.html`);await page.getByText('A clear view starts here.',{exact:true}).waitFor();
  const state=applySnapshot(emptyStore('FICTIONAL-HOSTED-SALT'),'chatgpt','website-A',{kind:'account',displayName:'Website Work',plan:null,meters:[]},Date.now()-1000);
  state.providers.chatgpt.enabled=false;state.connections=state.connections.map(c=>({...c,enabled:false,status:'disabled'}));
  await worker.evaluate(async({state,origin,device})=>{await chrome.storage.local.set({'mylimits:state:v2':state,'mylimits:sync:private:v1':{version:1,origin,enabled:false,deviceId:device.id,token:device.token,pair:null,acknowledged:[],excluded:[],pendingDeletes:[],mappings:{},failures:0,nextAttemptAt:null,lastAttemptAt:null,lastSyncedAt:null,preferenceRevision:0,error:null}});},{state,origin,device});
  // Hosted transport remains a legacy regression, not the default Desktop + UI.
  // Exercise its actual extension command/HTTP boundary without restoring an
  // unimplemented public hosted provider flow to the account picker.
  const opening=context.waitForEvent('page');
  const started=await page.evaluate(()=>chrome.runtime.sendMessage({type:'hosted-start',provider:'openai'}));assert.equal(started.ok,true);
  const auth=await opening;await auth.waitForLoadState();assert.equal(new URL(auth.url()).hostname,'auth.openai.com');
  const [attemptId,proof]=[...attempts.entries()][0]!;const completed=await hosted.complete(owner,attemptId,proof.proof,{subject:'fictional-personal-B',workspace:null,credential:'FICTIONAL-PROVIDER-SECRET'});
  const jobs=new HostedJobs(hosted);await jobs.enqueue(owner,completed.connectionId!);await jobs.runOne();
  const checked=await page.evaluate(id=>chrome.runtime.sendMessage({type:'hosted-attempt',id}),attemptId);assert.equal(checked.ok,true);assert.equal(checked.data.state,'connected');
  const renamed=await page.evaluate(id=>chrome.runtime.sendMessage({type:'hosted-action',id,action:'rename',alias:'Hosted Personal'}),completed.connectionId!);assert.equal(renamed.ok,true);
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Details for Hosted Personal',exact:true}).waitFor();await page.getByRole('button',{name:'Details for Website Work',exact:true}).waitFor();
  const publicData=await page.evaluate(()=>chrome.runtime.sendMessage({type:'state'}));assert.ok(!JSON.stringify(publicData).includes('FICTIONAL-PROVIDER-SECRET'));assert.equal(publicData.data.accounts.length,2);
  const privateData=await worker.evaluate(async()=> (await chrome.storage.local.get('mylimits:sync:private:v1'))['mylimits:sync:private:v1'] as {enabled:boolean});assert.equal(privateData.enabled,false);
  await page.getByRole('button',{name:'Details for Hosted Personal',exact:true}).click();await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  // Account presentation can briefly be inactive during a concurrent source
  // refresh. Wait for the authoritative connection mutation as well, rather
  // than treating that transient presentation as completed disconnect.
  await page.waitForFunction(async id=>{const r=await chrome.runtime.sendMessage({type:'state'});const c=r.data.connections.find((c:{id:string})=>c.id===`hosted:${id}`);return c?.status==='disabled'&&c.enabled===false&&r.data.accounts.find((a:{alias:string})=>a.alias==='Hosted Personal')?.connection==='inactive';},completed.connectionId);
  const disconnected=(await pool.query('SELECT state,generation FROM hosted_connections WHERE id=$1',[completed.connectionId])).rows[0];assert.equal(disconnected.state,'disconnected');assert.ok(disconnected.generation>0);
  const after=await page.evaluate(()=>chrome.runtime.sendMessage({type:'state'}));assert.equal(after.data.accounts.find((a:{id:string})=>a.id==='website-A').defaultName,'Website Work');assert.equal(after.data.accounts.find((a:{alias:string})=>a.alias==='Hosted Personal').connection,'inactive');
 }finally{await context.close();await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();await rm(directory,{recursive:true,force:true});}
});
