import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../src/db';
import { CredentialStore,type Kms } from '../src/credentials';
import { HostedService,type HostedDriver } from '../src/hosted';
import { createApp } from '../src/app';
const url=process.env.MYLIMITS_TEST_DATABASE_URL;if(!url)throw new Error('Set MYLIMITS_TEST_DATABASE_URL to isolated PostgreSQL.');
const admin=new pg.Pool({connectionString:url}),schema=`hosted_${randomUUID().replaceAll('-','')}`;
const pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`,max:8});
// Fictional provider and wrapping service, never evidence of real account behavior.
const keys=new Map<string,Uint8Array>();
const kms:Kms={async wrapKey(key){const id=randomUUID();keys.set(id,Buffer.from(key));return {keyId:'fixture',wrappedKey:id};},async unwrapKey(_id,key){return Buffer.from(keys.get(key)!);}};
const pending=new Map<string,{owner:string;proof:string}>();
const driver:HostedDriver={method:'official-popup',scopes:['fixture-work-codex'],minRefreshMs:120000,async begin(c){pending.set(c.attemptId,c);return {authorizationUrl:`https://auth.openai.com/oauth/authorize?state=${c.proof}`};},async cancel(){},async collect(){throw new Error('fixture not set');}};
const service=()=>new HostedService(pool,new CredentialStore(pool,kms),'test',new Map([['openai',driver]]));
const start=(s:HostedService,owner='alice',reconnectId?:string)=>s.start(owner,{provider:'openai',requestId:randomUUID(),...(reconnectId?{reconnectId}:{})});
async function complete(s:HostedService,id:string,subject='subject-a'){const a=pending.get(id)!;return s.complete(a.owner,id,a.proof,{subject,workspace:null,credential:'FICTIONAL-PRIVATE-SECRET'});}
before(async()=>{await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);await migrate(pool);});
beforeEach(async()=>{await pool.query('TRUNCATE owners CASCADE');await pool.query("INSERT INTO owners(id) VALUES('alice'),('bob')");pending.clear();keys.clear();});
after(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
test('hosted fixture injection cannot activate production and unavailable start persists nothing',async()=>{
 assert.throws(()=>new HostedService(pool,new CredentialStore(pool),'production',new Map()),/forbidden/);
 await assert.rejects(new HostedService(pool,new CredentialStore(pool),'production').start('alice',{provider:'openai',requestId:randomUUID()}),/unavailable/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM hosted_attempts')).rows[0].n,0);
});
test('A/B isolated and deduplicated by verified subject, aliases never become identity',async()=>{
 const s=service(),a=await start(s),b=await start(s);const ca=await complete(s,a.id),cb=await complete(s,b.id,'subject-b');assert.notEqual(ca.connectionId,cb.connectionId);
 await s.rename('alice',ca.connectionId!,{alias:'Same alias'});await s.rename('alice',cb.connectionId!,{alias:'Same alias'});
 const c=await start(s),duplicate=await complete(s,c.id);assert.equal(duplicate.state,'duplicate');assert.equal(duplicate.connectionId,ca.connectionId);
 assert.equal((await s.list('alice')).connections.length,2);assert.equal((await s.list('bob')).connections.length,0);
 assert.ok(!JSON.stringify(await s.list('alice')).includes('PRIVATE-SECRET'));
});
test('idempotent start does not run twice and conflicting request replay is rejected',async()=>{
 const s=service(),b={provider:'openai',requestId:randomUUID()};const [a,c]=await Promise.all([s.start('alice',b),s.start('alice',b)]);assert.equal(a.id,c.id);assert.equal(pending.size,1);
 const connection=await complete(s,a.id);
 await assert.rejects(s.start('alice',{...b,reconnectId:connection.connectionId}),/request_id_conflict/);
});
test('proof replay, expiry, cancellation and wrong owner cannot create credentials',async()=>{
 const s=service(),a=await start(s);await assert.rejects(s.complete('bob',a.id,pending.get(a.id)!.proof,{subject:'a',workspace:null,credential:'secret'}),/not_active/);
 await assert.rejects(s.complete('alice',a.id,'wrong',{subject:'a',workspace:null,credential:'secret'}),/not_active/);
 await s.cancel('alice',a.id);await assert.rejects(complete(s,a.id),/not_active/);
 const b=await start(s);await pool.query('UPDATE hosted_attempts SET expires_at=0 WHERE id=$1',[b.id]);await assert.rejects(complete(s,b.id),/not_active/);assert.equal((await s.attempt('alice',b.id)).state,'expired');
 assert.equal((await pool.query('SELECT count(*)::int n FROM hosted_credentials')).rows[0].n,0);
});
test('reconnect is same identity only and disconnect fences late completion without touching B',async()=>{
 const s=service(),a=await complete(s,(await start(s)).id),b=await complete(s,(await start(s)).id,'subject-b');
 const r=await start(s,'alice',a.connectionId!);await assert.rejects(complete(s,r.id,'subject-wrong'),/wrong_account/);
 await s.disconnect('alice',a.connectionId!);await assert.rejects(complete(s,r.id),/not_active/);
 assert.equal((await s.list('alice')).connections.find(c=>c.id===b.connectionId)!.state,'active');
 assert.equal((await pool.query('SELECT count(*)::int n FROM hosted_credentials')).rows[0].n,1);
 await assert.rejects(s.rename('bob',b.connectionId!,{alias:'steal'}),/not_found/);
});
test('cancellation during authorization start cannot return a live login URL',async()=>{
 let release!:()=>void,started!:()=>void;const begun=new Promise<void>(r=>started=r),blocked=new Promise<void>(r=>release=r);
 const delayed={...driver,async begin(c:Parameters<HostedDriver['begin']>[0]){pending.set(c.attemptId,c);started();await blocked;return {authorizationUrl:`https://auth.openai.com/oauth/authorize?state=${c.proof}`};}};
 const s=new HostedService(pool,new CredentialStore(pool,kms),'test',new Map([['openai',delayed]]));
 const operation=start(s);await begun;const id=[...pending.keys()][0]!;await s.cancel('alice',id);release();const result=await operation;assert.equal(result.state,'cancelled');assert.equal(result.authorizationUrl,null);
});
test('API requires auth, scopes IDs to owner, rejects token uploads and reports unavailable',async t=>{
 const app=createApp({config:{environment:'test',databaseUrl:url,origin:'http://127.0.0.1:8787',allowedOrigins:[],host:'127.0.0.1',port:8787},pool,testVerifier:async token=>({issuer:'https://fixture.invalid',subject:token})});t.after(()=>app.close());
 assert.equal((await app.inject({url:'/v1/hosted/connections'})).statusCode,401);
 const h={authorization:'Bearer fixture'};
 assert.equal((await app.inject({method:'POST',url:'/v1/hosted/attempts',headers:h,payload:{provider:'openai',requestId:randomUUID(),token:'DO-NOT-ACCEPT'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/v1/hosted/attempts',headers:h,payload:{provider:'openai',requestId:randomUUID()}})).statusCode,409);
 const capabilities=(await app.inject({url:'/hosted/capabilities'})).json();assert.ok(capabilities.providers.every((p:any)=>!p.available));
 assert.equal((await app.inject({url:'/v1/hosted/attempts/'+randomUUID(),headers:h})).statusCode,404);
});

test('hosted refresh coalesces, respects cooldown and preserves last success on throttle',async()=>{
 const {HostedJobs}=await import('../src/hosted-jobs');const {CollectorError}=await import('../src/jobs');
 const s=service(),id=(await complete(s,(await start(s)).id)).connectionId!,jobs=new HostedJobs(s),now=Date.now();
 const queued=await Promise.all([jobs.enqueue('alice',id,now),jobs.enqueue('alice',id,now)]);assert.equal(queued.filter(q=>q.queued).length,1);
 const l=(await jobs.lease(now))!;assert.ok(l);await jobs.finish(l,{subject:'subject-a',workspace:null,meters:[],providerObservedAt:null},now+1);
 assert.equal((await jobs.enqueue('alice',id,now+2)).queued,false);
 await jobs.enqueue('alice',id,now+120002);const next=(await jobs.lease(now+120002))!;
 await jobs.fail(next,new CollectorError('rate-limit',now+900000),now+120003);
 const c=(await s.list('alice')).connections[0]!;assert.equal(c.fetchedAt,now+1);assert.equal(c.providerObservedAt,null);assert.equal(c.nextEligibleAt,now+900000);assert.equal(c.staleReason,'fetch-failed');
 assert.equal((await jobs.enqueue('alice',id,now+899999)).queued,false);
});
test('crashed hosted lease, wrong identity and disconnected late reads cannot write history',async()=>{
 const {HostedJobs}=await import('../src/hosted-jobs');const s=service(),id=(await complete(s,(await start(s)).id)).connectionId!,jobs=new HostedJobs(s),now=Date.now();
 await jobs.enqueue('alice',id,now);const old=(await jobs.lease(now))!,replacement=(await jobs.lease(now+30001))!;assert.notEqual(old.token,replacement.token);
 assert.equal(await jobs.finish(old,{subject:'subject-a',workspace:null,meters:[],providerObservedAt:null},now+30002),false);
 await assert.rejects(jobs.finish(replacement,{subject:'wrong',workspace:null,meters:[],providerObservedAt:null},now+30002),/invalid-response/);
 await s.disconnect('alice',id);assert.equal(await jobs.finish(replacement,{subject:'subject-a',workspace:null,meters:[],providerObservedAt:null},now+30002),false);
 assert.equal((await pool.query('SELECT count(*)::int n FROM hosted_readings')).rows[0].n,0);
});
test('hosted owner concurrency is bounded and one owner cannot refresh another connection',async()=>{
 const {HostedJobs}=await import('../src/hosted-jobs');const s=service(),jobs=new HostedJobs(s),now=Date.now();
 const ids=[];for(let i=0;i<3;i++)ids.push((await complete(s,(await start(s)).id,'fixture-'+i)).connectionId!);
 for(const id of ids)await jobs.enqueue('alice',id,now);
 const results=await Promise.all([jobs.lease(now),jobs.lease(now),jobs.lease(now)]);assert.equal(results.filter(Boolean).length,2);
 await assert.rejects(jobs.enqueue('bob',ids[0]!),/not_found/);
});
test('hosted auth expiry pauses collection without leaking upstream text',async()=>{
 const {HostedJobs}=await import('../src/hosted-jobs');const {CollectorError}=await import('../src/jobs');const s=service(),jobs=new HostedJobs(s),now=Date.now();
 const id=(await complete(s,(await start(s)).id)).connectionId!;await jobs.enqueue('alice',id,now);const l=(await jobs.lease(now))!;await jobs.fail(l,new CollectorError('auth'),now+1);
 await assert.rejects(jobs.enqueue('alice',id,now+999999),/reconnect_required/);assert.equal((await s.list('alice')).connections[0]!.fetchedAt,null);
});
