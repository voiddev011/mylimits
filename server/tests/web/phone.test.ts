import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../src/app';
import { migrate,hash } from '../../src/db';
import { ApiError,ownerId } from '../../src/auth';

test('phone dashboard renders dated real-DB snapshots, approves pairing and signs out',async()=>{
 const url=process.env.MYLIMITS_TEST_DATABASE_URL;if(!url)throw new Error('Set MYLIMITS_TEST_DATABASE_URL.');
 const schema=`phone_${randomUUID().replaceAll('-','')}`,admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`});await migrate(pool);
 const origin='http://127.0.0.1:8788',app=createApp({config:{environment:'test',databaseUrl:url,origin,allowedOrigins:[],host:'127.0.0.1',port:8788},pool,testVerifier:async t=>{if(t!=='fixture-alice')throw new ApiError(401,'invalid_authentication');return {issuer:'https://fixture.invalid',subject:'alice'}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  const device=(await app.inject({method:'POST',url:'/v1/devices',headers:{authorization:'Bearer fixture-alice'},payload:{name:'Fictional laptop'}})).json();const observedAt=Date.now()-3600000;
  const uploaded=await app.inject({method:'POST',url:'/v1/snapshots/batch',headers:{authorization:`Bearer ${device.token}`},payload:{deviceId:device.id,items:[{account:{name:'Writing account with a long but readable label',plan:'Fixture'},snapshot:{schemaVersion:2,snapshotId:'phone-sample',providerId:'claude',accountId:'fictional-source',connectionId:'website:claude',workspaceId:null,observedAt,receivedAt:observedAt,connectorVersion:'fixture',meters:[{id:'session',label:'Session',scope:'subscription',evidence:'reported',unit:'percent',used:null,total:null,usedPercent:85,resetsAt:Date.now()+3600000,source:'Fictional fixture'}]}}]}});assert.equal(uploaded.statusCode,200,uploaded.body);
  const session=randomUUID();await pool.query("INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(session),ownerId('https://fixture.invalid','alice')]);
  const pairing=(await app.inject({method:'POST',url:'/pairing/start',payload:{name:'Fictional second browser'}})).json();await app.listen({host:'127.0.0.1',port:8788});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addCookies([{name:'mylimits_session',value:session,url:origin,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();await page.goto(`${origin}/?pair=${pairing.code}`);
  await page.getByRole('heading',{name:'Writing account with a long but readable label'}).waitFor();await page.getByText('15% left',{exact:true}).waitFor();await page.getByText(/Snapshot only · Last reading/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.getByRole('button',{name:'Review device',exact:true}).click();await page.getByRole('button',{name:'Approve this device',exact:true}).click();await page.getByRole('status').filter({hasText:'Device approved'}).waitFor();
  const approved=(await app.inject({method:'POST',url:'/pairing/poll',payload:{id:pairing.id,secret:pairing.secret}})).json();assert.equal(approved.status,'connected');
  const persisted=(await pool.query('SELECT observed_at FROM snapshots')).rows[0];assert.equal(Number(persisted.observed_at),observedAt);
  const dir=new URL('../../../artifacts/',import.meta.url);await mkdir(dir,{recursive:true});await page.screenshot({path:fileURLToPath(new URL('phase-2-phone.png',dir)),fullPage:true});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Optional MyLimits sync'}).waitFor();
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,0);
 }finally{await browser?.close();await app.close();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
});
