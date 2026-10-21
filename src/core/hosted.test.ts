import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore } from './model';
import { mergeHosted,hostedUnavailable } from './hosted';
import type { HostedConnection } from './hosted-contracts';
const fixture=(subject='A'):HostedConnection=>({id:crypto.randomUUID(),provider:'openai',alias:subject,identity:{subject,workspace:null},method:'official-popup',capabilities:['work-codex'],state:'active',generation:0,meters:[],fetchedAt:100,providerObservedAt:null,nextEligibleAt:1000,staleReason:null,error:null});
test('hosted projection preserves website data, two identities, local preferences and immutable history',()=>{
 const baseline=emptyStore('fixture'),a=fixture(),b=fixture('B');const list={version:1,connections:[a,b]};
 const s=mergeHosted(baseline,list,200);assert.equal(s.accounts.length,2);assert.equal(s.connections.filter(c=>c.kind==='website').length,6);
 s.accounts[0]!.alertsMuted=true;const next=mergeHosted(s,list,300);assert.equal(next.snapshots.length,2);assert.equal(next.accounts[0]!.alertsMuted,true);assert.equal(next.accounts[0]!.updatedAt,100);
 const offline=hostedUnavailable(next);assert.equal(offline.accounts[0]!.updatedAt,100);assert.equal(offline.accounts[0]!.connection,'offline');
 const missing=mergeHosted(next,{version:1,connections:[b]},400);assert.equal(missing.accounts.find(c=>c.alias==='A')!.connection,'inactive');assert.equal(missing.snapshots.length,2);
});
test('hosted error and null provider observation never manufacture a fresh timestamp',()=>{
 const c=fixture(),s=mergeHosted(emptyStore('fixture'),{version:1,connections:[c]},200);
 const failed=mergeHosted(s,{version:1,connections:[{...c,state:'error',error:'network',staleReason:'fetch-failed'}]},500);
 assert.equal(failed.accounts[0]!.connection,'error');assert.equal(failed.accounts[0]!.updatedAt,100);assert.equal(failed.snapshots.length,1);
 const late=mergeHosted(s,{version:1,connections:[{...c,fetchedAt:50}]},500);assert.equal(late.accounts[0]!.updatedAt,100);
});
