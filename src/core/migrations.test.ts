import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore } from './model';
import { initializeV2, migrateV1, STATE_V1, STATE_V2, ACTIVE_SCHEMA, BACKUP_V1 } from './migrations';
function legacy(){const s=emptyStore('keep-salt');const {cursor:_,...providers}=s.providers;return {...s,providers,version:1,accounts:[{id:'old-hash',provider:'claude',kind:'account',alias:'Work',defaultName:'Account',plan:null,connection:'inactive',meters:[],createdAt:1,updatedAt:2,alertRemaining:30,alertsMuted:true}]};}
class Memory {values:Record<string,unknown>={};writes=0;fail=0;async get(keys:string|string[]){return Object.fromEntries((typeof keys==='string'?[keys]:keys).map(k=>[k,structuredClone(this.values[k])]))}async set(items:Record<string,unknown>){if(++this.writes===this.fail)throw new Error('quota exceeded');Object.assign(this.values,structuredClone(items));}}
test('migration preserves old account identity, salt, aliases and preferences without inventing workspace',()=>{
 const s=migrateV1(legacy());assert.equal(s.version,2);assert.equal(s.installSalt,'keep-salt');assert.equal(s.accounts[0]!.id,'old-hash');assert.equal(s.accounts[0]!.alias,'Work');assert.equal(s.accounts[0]!.alertRemaining,30);assert.equal(s.accounts[0]!.alertsMuted,true);assert.equal(s.accounts[0]!.workspaceId,null);
});
test('migration resumes after every interrupted storage write without duplicate snapshots or lost V1',async()=>{
 for(let fail=1;fail<=5;fail++){const m=new Memory();m.values[STATE_V1]=legacy();m.fail=fail;await assert.rejects(initializeV2(m,async()=>{},()=> 'new'));assert.notEqual(m.values[ACTIVE_SCHEMA],2);m.fail=0;await initializeV2(m,async()=>{},()=> 'wrong');const s=m.values[STATE_V2] as ReturnType<typeof emptyStore>;assert.equal(s.accounts[0]!.alias,'Work');assert.equal(s.snapshots.length,1);assert.deepEqual(m.values[BACKUP_V1],legacy());await initializeV2(m,async()=>{},()=> 'wrong');assert.equal((m.values[STATE_V2] as typeof s).snapshots.length,1);}
});
test('history upgrade interruption leaves pointer uncommitted and can resume',async()=>{
 const m=new Memory();m.values[STATE_V1]=legacy();await assert.rejects(initializeV2(m,async()=>{throw new Error('database unavailable')},()=> 'new'));assert.equal(m.values[ACTIVE_SCHEMA],undefined);await initializeV2(m,async()=>{},()=> 'new');assert.equal(m.values[ACTIVE_SCHEMA],2);
});
test('malformed, missing active state and unknown future versions fail without reset',async()=>{
 const m=new Memory();m.values[STATE_V1]={version:1,installSalt:'keep'};await assert.rejects(initializeV2(m,async()=>{},()=> 'x'));assert.equal(m.writes,0);
 const n=new Memory();n.values[ACTIVE_SCHEMA]=3;await assert.rejects(initializeV2(n,async()=>{},()=> 'x'));assert.equal(n.writes,0);
 const a=new Memory();a.values[ACTIVE_SCHEMA]=2;await assert.rejects(initializeV2(a,async()=>{},()=> 'x'));assert.equal(a.writes,0);
});
