import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate,hash } from '../src/db';
import { CredentialStore,type Kms,type Binding,type Envelope } from '../src/credentials';
import { JobRunner,CollectorError,type Collector,type Lease,productionCollectors } from '../src/jobs';
const url=process.env.MYLIMITS_TEST_DATABASE_URL;if(!url)throw new Error('Set MYLIMITS_TEST_DATABASE_URL to an isolated PostgreSQL test database.');
const admin=new pg.Pool({connectionString:url}),schema=`jobs_${randomUUID().replaceAll('-','')}`;
const pool=new pg.Pool({connectionString:url,options:`-c search_path=${schema}`,max:8});
class TestKms implements Kms {
 records=new Map<string,{key:Uint8Array;binding:string}>();
 async wrapKey(key:Uint8Array,b:Binding){const id=randomUUID();this.records.set(id,{key:Buffer.from(key),binding:JSON.stringify(b)});return {keyId:'fixture-only',wrappedKey:id}}
 async unwrapKey(_id:string,wrapped:string,b:Binding){const r=this.records.get(wrapped);if(!r||r.binding!==JSON.stringify(b))throw new Error('binding rejected');return Buffer.from(r.key)}
}
const result=(ctx:Parameters<Collector['collect']>[0])=>({identityHash:'fixture-verified',snapshot:{schemaVersion:2 as const,snapshotId:randomUUID(),providerId:'claude' as const,accountId:ctx.accountId,connectionId:ctx.connectionId,workspaceId:ctx.workspaceId,observedAt:Date.now(),receivedAt:Date.now(),connectorVersion:'fixture',meters:[]}});
const collector:Collector={requiresCredential:false,collect:async c=>result(c)};
function runner(c:Collector=collector,maxPerMinute=30,kms=new TestKms()){const credentials=new CredentialStore(pool,kms);return new JobRunner({pool,credentials,environment:'test',testCollectors:new Map([['claude',c]]),maxPerMinute})}
async function fixture(){
 const owner=hash(randomUUID()),device=randomUUID(),accountId=randomUUID(),connectionId=randomUUID();
 await pool.query('INSERT INTO owners(id) VALUES($1)',[owner]);await pool.query('INSERT INTO devices(id,owner_id,name,token_hash) VALUES($1,$2,$3,$4)',[device,owner,'Fixture',hash(randomUUID())]);
 await pool.query("INSERT INTO accounts(id,owner_id,device_id,source_id,provider,name) VALUES($1,$2,$3,'source','claude','Fixture')",[accountId,owner,device]);
 await pool.query("INSERT INTO connections(id,owner_id,account_id,device_id,source_id,kind,status,verified_identity_hash) VALUES($1,$2,$3,$4,'source','cloud','active','fixture-verified')",[connectionId,owner,accountId,device]);
 return {owner,connectionId,accountId,generation:0};
}
const context=(l:Lease)=>({...l,credential:null,signal:AbortSignal.timeout(1000)});
before(async()=>{await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool)});
beforeEach(async()=>{await pool.query('TRUNCATE owners,provider_budgets CASCADE')});
after(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()});
test('production gate has no collectors and fixture injection is forbidden outside tests',async()=>{
 assert.equal(productionCollectors.size,0);assert.throws(()=>new JobRunner({pool,credentials:new CredentialStore(pool),environment:'production',testCollectors:new Map()}),/forbidden/);
 const f=await fixture(),q=new JobRunner({pool,credentials:new CredentialStore(pool),environment:'production'});await assert.rejects(q.enqueue(f.owner,f.connectionId),/independent_collection_unavailable/);
});
test('concurrent refresh and renewal enqueue coalesce and only one worker gets the lease',async()=>{
 const f=await fixture(),q=runner();const ids=await Promise.all([q.enqueue(f.owner,f.connectionId),q.enqueue(f.owner,f.connectionId,'renewal')]);assert.equal(ids[0]!.id,ids[1]!.id);
 const leases=await Promise.all([q.lease(),q.lease()]);assert.equal(leases.filter(Boolean).length,1);
});
test('expired lease is reclaimed and the crashed worker cannot commit after the replacement',async()=>{
 const f=await fixture(),q=runner(),now=Date.now();await q.enqueue(f.owner,f.connectionId,'refresh',now);const old=(await q.lease(now))!,next=(await q.lease(now+30001))!;assert.notEqual(old.token,next.token);assert.equal(next.attempts,2);
 assert.equal(await q.finish(old,result(context(old)),null,now+30002),false);assert.equal(await q.finish(next,result(context(next)),null,now+30002),true);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,1);
});
test('provider budget survives another runner and resets only after the minute window',async()=>{
 const a=await fixture(),b=await fixture(),q=runner(collector,1),now=Date.now();await q.enqueue(a.owner,a.connectionId,'refresh',now);await q.enqueue(b.owner,b.connectionId,'refresh',now);
 const l=(await q.lease(now))!;await q.finish(l,result(context(l)),null,now+1);assert.equal(await runner(collector,1).lease(now+10000),null);assert.ok(await q.lease(now+60001));
});
test('throttling persists retry time and never changes an old reading into a successful sample',async()=>{
 const f=await fixture(),q=runner(),now=Date.now();await q.enqueue(f.owner,f.connectionId,'refresh',now);const l=(await q.lease(now))!;await q.fail(l,new CollectorError('rate-limit',now+900000),now);
 assert.equal(await q.lease(now+60000),null);assert.ok(await q.lease(now+900001));assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,0);
});
test('revoked authorization pauses collection and upstream error text is never stored',async()=>{
 const f=await fixture(),q=runner({requiresCredential:false,collect:async()=>{throw new CollectorError('auth')}});await q.enqueue(f.owner,f.connectionId);await q.runOne();
 assert.equal((await pool.query('SELECT status FROM connections')).rows[0].status,'needs-auth');await assert.rejects(q.enqueue(f.owner,f.connectionId),/reconnect_required/);
 const q2=runner({requiresCredential:false,collect:async()=>{throw new Error('PRIVATE-UPSTREAM-SECRET')}});const f2=await fixture();await q2.enqueue(f2.owner,f2.connectionId);await q2.runOne();assert.ok(!JSON.stringify((await pool.query('SELECT * FROM jobs')).rows).includes('PRIVATE-UPSTREAM-SECRET'));
});
test('disconnect during collection advances generation and prevents snapshot resurrection',async()=>{
 let release!:()=>void,start!:()=>void;const started=new Promise<void>(r=>start=r),blocked=new Promise<void>(r=>release=r);
 const f=await fixture(),q=runner({requiresCredential:false,collect:async c=>{start();await blocked;return result(c)}});await q.enqueue(f.owner,f.connectionId);const work=q.runOne();await started;await q.disconnect(f.owner,f.connectionId);release();await work;
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,0);assert.equal((await pool.query('SELECT enabled FROM connections')).rows[0].enabled,false);
});
test('credential envelopes bind owner/connection/generation and rotation uses a revision guard',async()=>{
 const f=await fixture(),q=runner(),binding={owner:f.owner,connectionId:f.connectionId,generation:0};await q.credentials.put(binding,'VERY-PRIVATE-ACCESS-REFRESH');
 const row=(await pool.query('SELECT * FROM encrypted_credentials')).rows[0];assert.ok(!JSON.stringify(row).includes('VERY-PRIVATE'));assert.equal((await q.credentials.read(binding)).value,'VERY-PRIVATE-ACCESS-REFRESH');
 await assert.rejects(q.credentials.open({...binding,owner:'wrong-owner'},row.envelope));
 const rotated=await Promise.allSettled([q.credentials.put(binding,'new-one',1),q.credentials.put(binding,'new-two',1)]);assert.equal(rotated.filter(x=>x.status==='fulfilled').length,1);assert.equal((await q.credentials.read(binding)).revision,2);
 await assert.rejects(new CredentialStore(pool).put(binding,'anything'),/unconfigured/);
});
test('stale credential rotation and mismatched provider identity cannot persist a sample',async()=>{
 const f=await fixture(),q=runner(),now=Date.now(),binding={owner:f.owner,connectionId:f.connectionId,generation:0};await q.credentials.put(binding,'initial');await q.enqueue(f.owner,f.connectionId,'refresh',now);const lease=(await q.lease(now))!;
 await q.credentials.put(binding,'newer',1);await assert.rejects(q.finish(lease,{...result(context(lease)),rotatedCredential:'stale'},1),/credential_revision_conflict/);
 assert.equal((await q.credentials.read(binding)).value,'newer');await assert.rejects(q.finish(lease,{...result(context(lease)),identityHash:'other-user'},null),/invalid-response/);assert.equal((await pool.query('SELECT count(*)::int AS n FROM snapshots')).rows[0].n,0);
});
test('failed provider revocation remains unconfirmed and cleanup retries are bounded',async()=>{
 let attempts=0;const f=await fixture(),q=runner({...collector,requiresCredential:true,revoke:async()=>{if(++attempts<3)throw new Error('secret failure')}}),now=Date.now();await q.credentials.put({owner:f.owner,connectionId:f.connectionId,generation:0},'PRIVATE-TOKEN');await q.disconnect(f.owner,f.connectionId,now);
 await q.cleanup(now);assert.match((await pool.query('SELECT message FROM connections')).rows[0].message,/unconfirmed/);assert.equal((await pool.query('SELECT count(*)::int AS n FROM encrypted_credentials')).rows[0].n,1);
 await q.cleanup(now+60001);await q.cleanup(now+180002);assert.equal(attempts,3);assert.equal((await pool.query('SELECT count(*)::int AS n FROM encrypted_credentials')).rows[0].n,0);assert.match((await pool.query('SELECT message FROM connections')).rows[0].message,/confirmed/);
});
test('a stale revocation cleanup cannot delete a replacement credential generation',async()=>{
 const f=await fixture(),q=runner(),now=Date.now();await q.credentials.put({owner:f.owner,connectionId:f.connectionId,generation:0},'old');await q.disconnect(f.owner,f.connectionId,now);
 const binding={owner:f.owner,connectionId:f.connectionId,generation:2},envelope=await q.credentials.seal(binding,'replacement');
 await pool.query('UPDATE connections SET generation=2,enabled=true WHERE id=$1',[f.connectionId]);await pool.query('UPDATE encrypted_credentials SET generation=2,envelope=$2 WHERE connection_id=$1',[f.connectionId,JSON.stringify(envelope)]);
 await q.cleanup(now);assert.equal((await q.credentials.read(binding)).value,'replacement');assert.equal((await pool.query('SELECT count(*)::int AS n FROM connection_cleanup')).rows[0].n,0);
});
