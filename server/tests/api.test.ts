import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { migrate,hash } from '../src/db';
import { ApiError,ownerId } from '../src/auth';
import type { Config } from '../src/config';
import type { SyncItem } from '../../src/core/sync-contracts';
const url=process.env.MYLIMITS_TEST_DATABASE_URL;
if(!url)throw new Error('Set MYLIMITS_TEST_DATABASE_URL to an isolated PostgreSQL test database.');
const admin=new pg.Pool({connectionString:url});
const schema=`test_${randomUUID().replaceAll('-','')}`;
const pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`,max:8});
const config:Config={environment:'test',databaseUrl:url,origin:'http://127.0.0.1:8787',allowedOrigins:['chrome-extension://fixture'],host:'127.0.0.1',port:8787};
const headers=(token='alice')=>({authorization:`Bearer ${token}`});
const fixtureVerifier=async(token:string)=>{if(!['alice','bob'].includes(token))throw new ApiError(401,'invalid_authentication');return {issuer:'https://fixture.invalid',subject:token}};
function app(t:test.TestContext){const a=createApp({config,pool,testVerifier:fixtureVerifier});t.after(()=>a.close());return a;}
function item(index=0,at=Date.now()):SyncItem{return {account:{name:'Personal',plan:'Fixture'},snapshot:{schemaVersion:2,snapshotId:`s-${index}`,providerId:'claude',accountId:'local-source-account',connectionId:'website:claude',workspaceId:null,observedAt:at,receivedAt:at,connectorVersion:'fixture-1',meters:[{id:'session',label:'Session',scope:'subscription',unit:'percent',evidence:'reported',usedPercent:25,used:null,total:null,resetsAt:at+3600000,source:'Fixture'}]}}}
async function device(a:ReturnType<typeof app>,who='alice'){const r=await a.inject({method:'POST',url:'/v1/devices',headers:headers(who),payload:{name:'Test laptop'}});assert.equal(r.statusCode,200,r.body);return r.json() as {id:string;token:string};}
async function send(a:ReturnType<typeof app>,d:{id:string;token:string},items=[item()]){return a.inject({method:'POST',url:'/v1/snapshots/batch',headers:headers(d.token),payload:{deviceId:d.id,items}})}
before(async()=>{await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);await migrate(pool)});
beforeEach(async()=>{await pool.query('TRUNCATE owners CASCADE')});
after(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()});
test('authentication fails closed and injected fixture auth cannot run outside tests',async t=>{
 const a=createApp({config,pool});t.after(()=>a.close());
 assert.equal((await a.inject({url:'/v1/accounts'})).statusCode,401);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).statusCode,503);
 assert.throws(()=>createApp({config:{...config,environment:'production',origin:'https://sync.example'},pool,testVerifier:fixtureVerifier}),/forbidden/);
});
test('two owners cannot read, alter or delete each other’s sources',async t=>{
 const a=app(t),da=await device(a),db=await device(a,'bob');
 const uploaded=await send(a,da);assert.equal(uploaded.statusCode,200,uploaded.body);const account=uploaded.json().accepted[0].accountId;
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers('bob')})).json().accounts.length,0);
 assert.equal((await a.inject({url:`/v1/snapshots?accountId=${account}`,headers:headers('bob')})).json().points.length,0);
 assert.equal((await a.inject({method:'DELETE',url:`/v1/accounts/${account}`,headers:headers('bob')})).statusCode,404);
 assert.equal((await a.inject({method:'POST',url:'/v1/snapshots/batch',headers:headers(db.token),payload:{deviceId:da.id,items:[item()]}})).statusCode,403);
 const patch=await a.inject({method:'PATCH',url:'/v1/preferences',headers:headers('bob'),payload:{expectedRevision:0,data:{names:{[account]:'Stolen'}}}});assert.equal(patch.statusCode,404);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).json().accounts[0].name,'Personal');
});
test('uploads are device-scoped, idempotent and do not merge equal browser hashes',async t=>{
 const a=app(t),one=await device(a),two=await device(a),sample=item();
 const r=await send(a,one,[sample]);assert.equal(r.statusCode,200,r.body);
 const repeated=await send(a,one,[sample]);assert.equal(repeated.statusCode,200,repeated.body);assert.equal(repeated.json().accepted[0].duplicate,true);
 const other=await send(a,two,[sample]);assert.notEqual(other.json().accepted[0].accountId,r.json().accepted[0].accountId);
 const conflict=await send(a,one,[{...sample,snapshot:{...sample.snapshot,observedAt:sample.snapshot.observedAt-100}}]);assert.equal(conflict.statusCode,409);
});
test('old observations retain age and pagination never skips tied timestamps',async t=>{
 const a=app(t),d=await device(a),at=Date.now()-3600000;
 const r=await send(a,d,Array.from({length:5},(_,i)=>item(i,at)));assert.equal(r.statusCode,200,r.body);const id=r.json().accepted[0].accountId;
 const p1=(await a.inject({url:`/v1/snapshots?accountId=${id}&limit=2`,headers:headers()})).json();
 const p2=(await a.inject({url:`/v1/snapshots?accountId=${id}&limit=2&cursor=${p1.cursor}`,headers:headers()})).json();
 const p3=(await a.inject({url:`/v1/snapshots?accountId=${id}&limit=2&cursor=${p2.cursor}`,headers:headers()})).json();
 assert.deepEqual([p1.points.length,p2.points.length,p3.points.length],[2,2,1]);assert.equal(new Set([...p1.points,...p2.points,...p3.points].map(p=>p.id)).size,5);
 assert.equal(p1.points[0].observedAt,at);assert.ok(p1.points[0].serverReceivedAt>at);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).json().accounts[0].status,'snapshot-only');
});
test('validation rejects forged owner fields, future times, bad cursors and oversized input',async t=>{
 const a=app(t),d=await device(a);
 const body={deviceId:d.id,items:[item()],owner:'bob'};assert.equal((await a.inject({method:'POST',url:'/v1/snapshots/batch',headers:headers(d.token),payload:body})).statusCode,400);
 assert.equal((await send(a,d,[item(1,Date.now()+120000)])).statusCode,400);
 assert.equal((await a.inject({url:`/v1/snapshots?accountId=${randomUUID()}&cursor=bad`,headers:headers()})).statusCode,400);
 assert.equal((await a.inject({method:'POST',url:'/v1/snapshots/batch',headers:{...headers(d.token),'content-type':'application/json'},payload:JSON.stringify({x:'x'.repeat(600000)})})).statusCode,413);
});
test('preference writes require matching revision and cannot silently erase another edit',async t=>{
 const a=app(t);await device(a);
 const first=await a.inject({method:'PATCH',url:'/v1/preferences',headers:headers(),payload:{expectedRevision:0,data:{names:{}}}});assert.equal(first.json().revision,1);
 const second=await a.inject({method:'PATCH',url:'/v1/preferences',headers:headers(),payload:{expectedRevision:0,data:{names:{}}}});assert.equal(second.statusCode,409);
});
test('deletion tombstones prevent replay while another owner remains intact',async t=>{
 const a=app(t),d=await device(a),b=await device(a,'bob'),sample=item();
 const result=await send(a,d,[sample]);const id=result.json().accepted[0].accountId;await send(a,b,[sample]);
 assert.equal((await a.inject({method:'DELETE',url:`/v1/accounts/${id}`,headers:headers(d.token)})).statusCode,200);
 assert.equal((await send(a,d,[sample])).statusCode,410);assert.equal((await send(a,d,[item(5)])).statusCode,410);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).json().accounts.length,0);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers('bob')})).json().accounts.length,1);
});
test('device revocation and account-data removal invalidate old upload credentials',async t=>{
 const a=app(t),d=await device(a);await send(a,d);
 assert.equal((await a.inject({method:'DELETE',url:`/v1/devices/${d.id}`,headers:headers()})).statusCode,200);
 assert.equal((await send(a,d,[item(3)])).statusCode,401);
 const fresh=await device(a);await send(a,fresh,[item(4)]);
 assert.equal((await a.inject({method:'DELETE',url:'/v1/account-data',headers:headers(),payload:{confirmation:'delete-all'}})).statusCode,200);
 assert.equal((await send(a,fresh,[item(6)])).statusCode,401);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).json().accounts.length,0);
});
test('disconnect cannot be undone by an old or new upload from that source',async t=>{
 const a=app(t),d=await device(a);const up=await send(a,d),connection=up.json().accepted[0].connectionId;
 const disabled=await a.inject({method:'DELETE',url:`/v1/connections/${connection}`,headers:headers(d.token)});assert.equal(disabled.statusCode,200);
 assert.equal((await send(a,d,[item(8)])).statusCode,410);
});
test('unconfigured OAuth callbacks reject binding errors without accepting another user',async t=>{
 const a=app(t);assert.equal((await a.inject({url:'/auth/callback?state=forged&code=secret'})).statusCode,503);
 const configured={...config,oidc:{issuer:'https://issuer.invalid',audience:'api',jwksUri:'https://issuer.invalid/keys',authorizationEndpoint:'https://issuer.invalid/authorize',tokenEndpoint:'https://issuer.invalid/token',clientId:'app'}};
 const b=createApp({config:configured,pool,testVerifier:fixtureVerifier});t.after(()=>b.close());
 const login=await b.inject({url:'/auth/login'});assert.equal(login.statusCode,302);const state=new URL(login.headers.location!).searchParams.get('state');
 const callback=await b.inject({url:`/auth/callback?state=${state}&code=secret`,headers:{cookie:'mylimits_auth=wrong-browser'}});assert.equal(callback.statusCode,400);
 assert.ok(!callback.body.includes('secret'));
});
test('origin checks reject hostile browser writes and API budgets are bounded',async t=>{
 const a=app(t);await device(a);
 assert.equal((await a.inject({url:'/v1/accounts',headers:{...headers(),origin:'https://hostile.invalid'}})).statusCode,403);
 let last;for(let i=0;i<121;i++)last=await a.inject({url:'/v1/accounts',headers:headers()});assert.equal(last!.statusCode,429);
});
test('pairing requires explicit owner approval, a bound secret and one-time exchange',async t=>{
 const a=app(t);const start=await a.inject({method:'POST',url:'/pairing/start',payload:{name:'My laptop'}});assert.equal(start.statusCode,200);const request=start.json();
 const poll=()=>a.inject({method:'POST',url:'/pairing/poll',payload:{id:request.id,secret:request.secret}});
 assert.equal((await poll()).json().status,'pending');
 assert.equal((await a.inject({method:'POST',url:'/v1/pairings/approve',payload:{code:request.code}})).statusCode,403);
 assert.equal((await a.inject({url:`/v1/pairings/${request.code}`,headers:headers()})).json().name,'My laptop');
 assert.equal((await a.inject({method:'POST',url:'/v1/pairings/approve',headers:headers(),payload:{code:request.code}})).statusCode,200);
 assert.equal((await a.inject({method:'POST',url:'/v1/pairings/approve',headers:headers('bob'),payload:{code:request.code}})).statusCode,409);
 const wrong=await a.inject({method:'POST',url:'/pairing/poll',payload:{id:request.id,secret:'incorrect-secret-of-at-least-thirty-two-characters'}});assert.equal(wrong.statusCode,410);
 const paired=await poll();assert.equal(paired.json().status,'connected');const {deviceId,token}=paired.json();assert.equal((await poll()).statusCode,410);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers(token)})).statusCode,200);
 const devices=(await a.inject({url:'/v1/devices',headers:headers()})).json().devices;assert.equal(devices[0].id,deviceId);
 assert.ok(!JSON.stringify(devices).includes(token));
});
test('expired pairing cannot issue credentials and device self-revoke does not revoke peers',async t=>{
 const a=app(t),expired=(await a.inject({method:'POST',url:'/pairing/start',payload:{name:'Expired'}})).json();await pool.query('UPDATE pair_requests SET expires_at=0 WHERE id=$1',[expired.id]);
 assert.equal((await a.inject({method:'POST',url:'/pairing/poll',payload:{id:expired.id,secret:expired.secret}})).statusCode,410);
 const one=await device(a),two=await device(a);
 assert.equal((await a.inject({method:'DELETE',url:`/v1/devices/${two.id}`,headers:headers(one.token)})).statusCode,403);
 assert.equal((await a.inject({method:'DELETE',url:`/v1/devices/${one.id}`,headers:headers(one.token)})).statusCode,200);
 assert.equal((await a.inject({url:'/v1/accounts',headers:headers(two.token)})).statusCode,200);
});
test('source tombstones cover lost acknowledgements and deletion before first upload',async t=>{
 const a=app(t),d=await device(a),sample=item();await send(a,d,[sample]);
 const deletion=await a.inject({method:'DELETE',url:'/v1/source-data',headers:headers(d.token),payload:{sourceAccountId:sample.snapshot.accountId}});assert.equal(deletion.statusCode,200);
 assert.equal((await send(a,d,[item(15)])).statusCode,410);assert.equal((await a.inject({url:'/v1/accounts',headers:headers()})).json().accounts.length,0);
 const unseen='not-yet-uploaded';assert.equal((await a.inject({method:'DELETE',url:'/v1/source-data',headers:headers(d.token),payload:{sourceAccountId:unseen}})).statusCode,200);
 assert.equal((await send(a,d,[{...item(16),snapshot:{...item(16).snapshot,accountId:unseen}}])).statusCode,410);
});

test('snapshot history retention is 30/90 days with a protected last-known source reading',async t=>{
 const a=app(t),d=await device(a),at=Date.now();
 const old=await send(a,d,[item(1,at-40*86400000)]);assert.equal(old.statusCode,200,old.body);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,1);
 await send(a,d,[item(2,at)]);assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,1);
 const {emptyStore}=await import('../../src/core/model');
 await a.inject({method:'PATCH',url:'/v1/preferences',headers:headers(),payload:{expectedRevision:0,data:{settings:{...emptyStore('test').settings,historyRetentionDays:90}}}});
 await send(a,d,[item(3,at-40*86400000)]);assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,2);
});
