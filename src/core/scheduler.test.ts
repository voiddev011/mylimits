import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteConnection } from './model';
import { RefreshCoordinator, shouldRefresh, nextRetry, type RefreshReason } from './scheduler';
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
test('refresh policy persists throttling, suppresses open storms and waits for sign-in when no auth retry is scheduled',()=>{
 const c={...websiteConnection('claude'),enabled:true,status:'active' as const,lastAttemptAt:now,lastSuccessAt:now};
 assert.equal(shouldRefresh(c,'open',now+16000,5),false);assert.equal(shouldRefresh(c,'scheduled',now+300000,5),true);
 assert.equal(shouldRefresh({...c,status:'needs-auth'},'scheduled',now+900000,5),false);
 assert.equal(shouldRefresh({...c,status:'needs-auth'},'tab',now+16000,5),true);
 const retry=nextRetry(now,1,5,now+1800000);assert.equal(retry,now+1800000);assert.equal(shouldRefresh({...c,nextRetryAt:retry},'scheduled',now+600000,5),false);
 for(const reason of ['manual','startup','tab'] as const)assert.equal(shouldRefresh({...c,status:'error',nextRetryAt:retry},reason,now+600000,5),false);
 assert.equal(shouldRefresh({...c,status:'needs-auth',nextRetryAt:retry},'manual',now+600000,5),true);
});

test('authentication failures retry automatically only when their persisted backoff expires',()=>{
 const retryAt=now+600000;
 const c={...websiteConnection('claude'),enabled:true,status:'needs-auth' as const,lastAttemptAt:now,nextRetryAt:retryAt};
 for(const reason of ['scheduled','open','startup','idle'] as const){
  assert.equal(shouldRefresh(c,reason,retryAt-1,5),false,`${reason}: before retry deadline`);
  assert.equal(shouldRefresh(c,reason,retryAt,5),true,`${reason}: at retry deadline`);
  assert.equal(shouldRefresh(c,reason,retryAt+1,5),true,`${reason}: past retry deadline`);
 }
 const restarted=JSON.parse(JSON.stringify(c));
 assert.equal(shouldRefresh(restarted,'startup',now+12*3600000,5),true);
});

test('authentication with no retry deadline waits for an explicit manual, tab or cookie signal',()=>{
 const c={...websiteConnection('chatgpt'),enabled:true,status:'needs-auth' as const,lastAttemptAt:now,nextRetryAt:null};
 for(const reason of ['manual','tab','cookie'] as const)assert.equal(shouldRefresh(c,reason,now+16000,5),true,reason);
 for(const reason of ['scheduled','open','startup','idle'] as const)assert.equal(shouldRefresh(c,reason,now+12*3600000,5),false,reason);
 const waiting={...c,nextRetryAt:now+3600000};
 for(const reason of ['manual','tab','cookie'] as const)assert.equal(shouldRefresh(waiting,reason,now+16000,5),true,reason);
});

test('authentication retries obey the 15-second click cooldown, including when already due',()=>{
 const c={...websiteConnection('chatgpt'),enabled:true,status:'needs-auth' as const,lastAttemptAt:now};
 const reasons:RefreshReason[]=['manual','tab','cookie','scheduled','open','startup','idle'];
 for(const nextRetryAt of [null,now-60000,now+60000])for(const reason of reasons)
  assert.equal(shouldRefresh({...c,nextRetryAt},reason,now+14999,5),false,`${reason}: ${nextRetryAt}`);
 assert.equal(shouldRefresh(c,'manual',now+15000,5),true);
 assert.equal(shouldRefresh({...c,nextRetryAt:now-60000},'scheduled',now+15000,5),true);
});

test('no refresh reason can bypass a non-auth source cooldown or revive disabled tracking',()=>{
 const c={...websiteConnection('claude'),enabled:true,lastAttemptAt:now,nextRetryAt:now+1800000};
 const reasons:RefreshReason[]=['manual','tab','cookie','scheduled','open','startup','idle'];
 for(const status of ['active','checking','needs-tab','unavailable','offline','error'] as const)for(const reason of reasons)
  assert.equal(shouldRefresh({...c,status},reason,now+600000,5),false,`${status}: ${reason}`);
 for(const reason of reasons)assert.equal(shouldRefresh({...c,enabled:false,status:'needs-auth',nextRetryAt:now-60000},reason,now+600000,5),false);
});

test('idle is scheduled work and exponential backoff remains capped independently of provider waits',()=>{
 const c={...websiteConnection('claude'),enabled:true,status:'active' as const,lastAttemptAt:now,lastSuccessAt:now};
 assert.equal(shouldRefresh(c,'idle',now+16000,5),false);
 assert.equal(shouldRefresh(c,'idle',now+300000,5),true);
 for(const failures of [0,1,5,20]){
  const retry=nextRetry(now,failures,5,null);
  assert.equal(retry,now+Math.min(60,5*2**Math.min(failures,5))*60000);
 }
 assert.equal(nextRetry(now,20,5,now+2*3600000),now+2*3600000);
 assert.equal(nextRetry(now,20,5,now+48*3600000),now+24*3600000);
});
test('vault authentication cooldown and terminal re-sign-in state cannot be bypassed by ambient signals',()=>{
 const c={...websiteConnection('chatgpt'),kind:'vault' as const,enabled:true,status:'needs-auth' as const,lastAttemptAt:now};
 for(const reason of ['manual','tab','cookie','scheduled','open','startup','idle'] as const){
  assert.equal(shouldRefresh({...c,nextRetryAt:now+60000},reason,now+59999,5),false);
  assert.equal(shouldRefresh({...c,nextRetryAt:now+60000},reason,now+60000,5),true);
  assert.equal(shouldRefresh({...c,nextRetryAt:null},reason,now+86400000,5),false);
 }
});
