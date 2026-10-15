import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteConnection } from './model';
import { RefreshCoordinator, shouldRefresh, nextRetry } from './scheduler';
const now=1800000000000;
test('scheduler coalesces popup/alarm overlap and bounds provider concurrency',async()=>{
 const q=new RefreshCoordinator(2);let active=0,max=0,calls=0;const release:(()=>void)[]=[];
 const task=async()=>{calls++;active++;max=Math.max(max,active);await new Promise<void>(r=>release.push(r));active--;};
 const a=q.run('a',task),again=q.run('a',task),b=q.run('b',task),c=q.run('c',task);
 assert.equal(calls,2);release.shift()!();await new Promise(r=>setTimeout(r,0));assert.equal(calls,3);release.splice(0).forEach(r=>r());await Promise.all([a,again,b,c]);assert.equal(max,2);
});
test('scheduler cancellation prevents queued work and permits explicit retry',async()=>{
 const q=new RefreshCoordinator(1);let release!:()=>void;let calls=0;
 const a=q.run('a',async()=>new Promise<void>(r=>{release=r}));const b=q.run('b',async()=>{calls++});q.cancel('b');release();await Promise.all([a,b]);assert.equal(calls,0);await q.run('b',async()=>{calls++});assert.equal(calls,1);
});
test('refresh policy persists throttling, suppresses open storms and pauses authentication retries',()=>{
 const c={...websiteConnection('claude'),enabled:true,status:'active' as const,lastAttemptAt:now,lastSuccessAt:now};
 assert.equal(shouldRefresh(c,'open',now+16000,5),false);assert.equal(shouldRefresh(c,'scheduled',now+300000,5),true);
 assert.equal(shouldRefresh({...c,status:'needs-auth'},'scheduled',now+900000,5),false);
 assert.equal(shouldRefresh({...c,status:'needs-auth'},'tab',now+16000,5),true);
 const retry=nextRetry(now,1,5,now+1800000);assert.equal(retry,now+1800000);assert.equal(shouldRefresh({...c,nextRetryAt:retry},'scheduled',now+600000,5),false);
 for(const reason of ['manual','startup','tab'] as const)assert.equal(shouldRefresh({...c,status:'error',nextRetryAt:retry},reason,now+600000,5),false);
 assert.equal(shouldRefresh({...c,status:'needs-auth',nextRetryAt:retry},'manual',now+600000,5),true);
});
