import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotSync,SyncError,type SyncPrivate,type SyncPort } from './sync';
import { emptyStore } from './model';
import { applySnapshot } from './engine';
import { applySyncedSettings, type SyncItem } from './sync-contracts';
import { validateSyncOrigin } from './sync-origin';
const deviceId='10000000-0000-4000-8000-000000000001',remoteId='20000000-0000-4000-8000-000000000002',connectionId='30000000-0000-4000-8000-000000000003';
function fixture(){
 let saved:SyncPrivate|undefined,store=applySnapshot(emptyStore('PRIVATE-INSTALL-SALT'),'claude','local-a',{kind:'account',displayName:'Personal',plan:null,meters:[]},Date.now()-3600000);
 const calls:{path:string;body:unknown}[]=[];let offline=false,conflict=false;
 const port:SyncPort={read:async()=>saved,write:async s=>{saved=structuredClone(s)},store:async()=>store,request:async(path,options)=>{
  calls.push({path,body:structuredClone(options.body)});
  if(path==='/pairing/start')return {id:deviceId,secret:'private-pairing-secret-that-is-not-public',code:'123456ABCDEF',expiresAt:Date.now()+600000};
  if(path==='/pairing/poll')return {status:'connected',deviceId,token:'ml_device_PRIVATE-DEVICE-CREDENTIAL-ONLY'};
  if(path==='/v1/snapshots/batch'){if(offline)throw new SyncError(503);const b=options.body as {items:SyncItem[]};return {accepted:b.items.map(i=>({snapshotId:i.snapshot.snapshotId,accountId:remoteId,connectionId,duplicate:false}))}}
  if(path==='/v1/preferences'){if(options.method==='PATCH'){if(conflict)throw new SyncError(409);return {revision:4}}return {revision:3,data:{names:{[remoteId]:'Cloud name'},settings:store.settings}}}
  return {deleted:true};
 }};
 const sync=new SnapshotSync('https://sync.example',port);
 return {sync,port,calls,get saved(){return saved!},get store(){return store},setStore(v:typeof store){store=v},setOffline(v:boolean){offline=v},setConflict(v:boolean){conflict=v},connect:async()=>{await sync.start();await sync.poll();calls.length=0}};
}
test('local-only sync and preview-equivalent paths make no network requests',async()=>{
 const f=fixture();await f.sync.run();await new SnapshotSync('',f.port).run();assert.equal(f.calls.length,0);assert.equal((await f.sync.status()).connected,false);
});
test('pairing/public status and upload contain no private credentials or installation salt',async()=>{
 const f=fixture();await f.sync.start();assert.ok(!JSON.stringify(await f.sync.status()).includes('private-pairing-secret'));await f.sync.poll();const status=JSON.stringify(await f.sync.status());assert.ok(!status.includes('PRIVATE-DEVICE'));await f.sync.run();
 assert.ok(!JSON.stringify(f.calls.map(c=>c.body)).includes('PRIVATE-INSTALL-SALT'));assert.ok(!JSON.stringify(f.calls.map(c=>c.body)).includes('PRIVATE-DEVICE'));
 const batch=f.calls.find(c=>c.path==='/v1/snapshots/batch')!.body as {items:SyncItem[]};assert.equal(batch.items[0]!.snapshot.observedAt,f.store.snapshots[0]!.observedAt);
});
test('acknowledgements survive restart and a retry does not relabel old observations as fresh',async()=>{
 const f=fixture();await f.connect();await f.sync.run(true,Date.now());const count=f.calls.length,observedAt=f.store.snapshots[0]!.observedAt;await new SnapshotSync('https://sync.example',f.port).run(true,Date.now()+120000);assert.equal(f.calls.length,count);assert.equal(f.store.snapshots[0]!.observedAt,observedAt);assert.equal(f.saved.acknowledged.length,1);
});
test('offline upload backs off durably then resumes without losing the pending reading',async()=>{
 const f=fixture();await f.connect();f.setOffline(true);const now=Date.now();await f.sync.run(true,now);assert.equal(f.saved.acknowledged.length,0);const count=f.calls.length;
 await new SnapshotSync('https://sync.example',f.port).run(true,now+20000);assert.equal(f.calls.length,count);f.setOffline(false);await f.sync.run(true,now+120000);assert.equal(f.saved.acknowledged.length,1);
});
test('forget queues deletion by source even when an upload acknowledgement was lost',async()=>{
 const f=fixture();await f.connect();f.setOffline(true);const now=Date.now();await f.sync.run(true,now);await f.sync.forget('local-a');assert.deepEqual(f.saved.pendingDeletes,['local-a']);
 f.setOffline(false);f.calls.length=0;await new SnapshotSync('https://sync.example',f.port).run(true,now+120000);assert.equal(f.calls[0]!.path,'/v1/source-data');assert.deepEqual(f.calls[0]!.body,{sourceAccountId:'local-a'});assert.equal(f.calls.filter(c=>c.path==='/v1/snapshots/batch').length,0);assert.equal(f.saved.pendingDeletes.length,0);
});
test('changed server origin cannot receive an existing device credential',async()=>{
 const f=fixture();await f.connect();const changed=new SnapshotSync('https://different.example',f.port);await changed.run(true);assert.equal(f.calls.length,0);assert.match((await changed.status()).error!,/server changed/);assert.throws(()=>validateSyncOrigin('https://user:password@sync.example'));assert.throws(()=>validateSyncOrigin('http://public.example'));assert.equal(validateSyncOrigin('http://127.0.0.1:8787'),'http://127.0.0.1:8787');
});
test('preference conflicts are explicit and cloud aliases map only to this device’s known accounts',async()=>{
 const f=fixture();await f.connect();await f.sync.run(true);f.setConflict(true);await assert.rejects(f.sync.pushPreferences(),/changed/);const old=f.store.accounts[0]!.alias,remote=await f.sync.pullPreferences();assert.deepEqual(remote.names,{'local-a':'Cloud name'});assert.equal(f.store.accounts[0]!.alias,old);f.setConflict(false);await f.sync.pushPreferences();assert.equal(f.saved.preferenceRevision,4);
});
test('background-tab recovery remains local on both preference upload and download',async()=>{
 const f=fixture();f.store.settings.autoRecoverTab=false;await f.connect();await f.sync.pushPreferences();
 const patch=f.calls.find(c=>c.path==='/v1/preferences')!.body as {data:{settings:Record<string,unknown>}};
 assert.equal('autoRecoverTab' in patch.data.settings,false);
 const remote=await f.sync.pullPreferences();assert.equal('autoRecoverTab' in remote.settings!,false);
 assert.equal(applySyncedSettings(f.store.settings,remote.settings).autoRecoverTab,false);
 assert.equal(applySyncedSettings({...f.store.settings,autoRecoverTab:true},remote.settings).autoRecoverTab,true);
});
test('pause stops uploads and disconnect revokes the device without discarding local accounts',async()=>{
 const f=fixture();await f.connect();await f.sync.enable(false);await f.sync.run(true);assert.equal(f.calls.length,0);await f.sync.disconnect();assert.equal(f.calls[0]!.path,`/v1/devices/${deviceId}`);assert.equal((await f.sync.status()).connected,false);assert.equal(f.store.accounts.length,1);
});
test('expired backlog remains local and cannot block newer sync with permanent server time errors',async()=>{
 const f=fixture(),now=Date.now();const old=structuredClone(f.store.snapshots[0]!);old.snapshotId='older-than-service-retention';old.observedAt=now-91*86400000;old.receivedAt=old.observedAt;f.setStore({...f.store,snapshots:[old,...f.store.snapshots]});await f.connect();const status=await f.sync.run(true,now);assert.equal(f.saved.acknowledged.length,1);assert.ok(status.error?.includes('90 days'));assert.equal(f.store.snapshots.length,2);const payload=f.calls.find(c=>c.path==='/v1/snapshots/batch')!.body as {items:SyncItem[]};assert.equal(payload.items.length,1);assert.notEqual(payload.items[0]!.snapshot.snapshotId,old.snapshotId);
});
test('hosted-only pairing does not enable snapshot uploads and private hosted API cannot target arbitrary paths',async()=>{
 const f=fixture();await f.sync.start();await f.sync.poll(false);f.calls.length=0;await f.sync.run();assert.equal(f.calls.length,0);assert.equal((await f.sync.status()).connected,true);assert.equal((await f.sync.status()).enabled,false);
 await f.sync.hostedRequest('/v1/hosted/connections');assert.equal(f.calls[0]!.path,'/v1/hosted/connections');
 await assert.rejects(f.sync.hostedRequest('https://evil.invalid/steal'),/Invalid hosted/);
 await assert.rejects(f.sync.hostedRequest('/v1/accounts'),/Invalid hosted/);
});
test('hosted readings are never uploaded back as website snapshot imports',async()=>{
 const f=fixture();await f.connect();const hosted={...f.store.snapshots[0]!,accountId:'hosted:fixture',snapshotId:'hosted-reading'};f.setStore({...f.store,snapshots:[...f.store.snapshots,hosted]});await f.sync.run(true);
 const b=f.calls.find(c=>c.path==='/v1/snapshots/batch')!.body as {items:SyncItem[]};assert.ok(b.items.every(i=>!i.snapshot.accountId.startsWith('hosted:')));
});
test('expired hosted device authorization clears the revoked link and preserves local data',async()=>{
 const f=fixture();await f.connect();const request=f.port.request;f.port.request=async(path,o)=>{if(path.startsWith('/v1/hosted/'))throw new SyncError(401);return request(path,o);};
 await assert.rejects(f.sync.hostedRequest('/v1/hosted/connections'));assert.equal((await f.sync.status()).connected,false);assert.equal(f.store.accounts.length,1);assert.equal(f.saved.token,null);
});
