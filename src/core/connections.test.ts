import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore, type Account, type UsageSnapshot } from './model';
import { acceptSnapshot, changeConnection } from './connections';
import { toPublicState } from './public';
import { MeterSchema, UsageSnapshotSchema } from './schema';
const now=1800000000000;
function fixture() {
 const s=emptyStore('private-salt');
 const a:Account={id:'a',provider:'claude',kind:'account',alias:'Work',defaultName:'Account',plan:null,connection:'active',meters:[],createdAt:now,updatedAt:now,alertRemaining:30,alertsMuted:false};
 s.accounts=[a,{...a,id:'b',alias:'Work'}];
 s.connections[0]={...s.connections[0]!,enabled:true,status:'active',accountId:'a'};
 return s;
}
function reading(accountId='a', observedAt=now):UsageSnapshot {return {schemaVersion:2,snapshotId:`r:${observedAt}`,providerId:'claude',accountId,connectionId:'website:claude',workspaceId:'workspace',observedAt,receivedAt:now+1,connectorVersion:'test',meters:[{id:'session',label:'Session',scope:'subscription',evidence:'reported',unit:'percent',used:null,total:null,usedPercent:0,resetsAt:now+3600000,source:'Fixture'}]};}
test('V2 rebind keeps aliases and remembers previous account with its dated reading',()=>{
 let s=acceptSnapshot(fixture(),reading(),0,now).store;
 s=acceptSnapshot(s,reading('b',now+1000),0,now+1000).store;
 assert.equal(s.accounts[0]!.alias,'Work');assert.equal(s.accounts[0]!.connection,'inactive');
 assert.equal(s.accounts[0]!.updatedAt,now);assert.equal(s.accounts[1]!.connection,'active');
 assert.equal(s.connections[0]!.generation,1);
});
test('V2 rejects stale observations, invalid generations and future readings',()=>{
 const s=acceptSnapshot(fixture(),reading(),0,now).store;
 assert.equal(acceptSnapshot(s,reading('a',now-1),0,now).accepted,false);
 assert.equal(acceptSnapshot(s,reading(),9,now).accepted,false);
 assert.equal(acceptSnapshot(s,reading('a',now+61000),0,now).accepted,false);
 const off=changeConnection(s,'website:claude',{enabled:false,status:'disabled'},true);
 assert.equal(acceptSnapshot(off,reading('a',now+1000),0,now+1000).accepted,false);
});
test('V2 preserves reported zero, rejects NaN and missing monetary currency',()=>{
 const m=reading().meters[0]!;
 assert.equal(MeterSchema.parse(m).usedPercent,0);
 assert.equal(MeterSchema.safeParse({...m,usedPercent:NaN}).success,false);
 assert.equal(MeterSchema.safeParse({...m,used:-1}).success,false);
 assert.equal(MeterSchema.safeParse({...m,unit:'currency'}).success,false);
 assert.equal(UsageSnapshotSchema.safeParse({...reading(),observedAt:Infinity}).success,false);
});
test('V2 public projection excludes transient identity, remote workspace IDs and injected secrets',()=>{
 const s=fixture();s.workspaces=[{id:'hashed',provider:'claude',remoteId:'private-org-id',name:'Team'}];
 Object.assign(s.accounts[0]!,{accessToken:'private-token'});
 const result=JSON.stringify(toPublicState(s));
 assert.ok(!result.includes('private-salt'));assert.ok(!result.includes('private-token'));assert.ok(!result.includes('private-org-id'));
 assert.ok(!result.includes('generation'));assert.ok(result.includes('Team'));
});
