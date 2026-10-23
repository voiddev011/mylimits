import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostLock } from './host-lock';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
const settle=()=>new Promise<void>(r=>setImmediate(r));
test('host lock is FIFO per host while unrelated hosts progress independently',async()=>{
 const lock=createHostLock(),gate=deferred(),events:string[]=[];
 const a=lock('claude.ai',async()=>{events.push('A');await gate.promise;events.push('A done');});
 const b=lock('CLAUDE.AI',async()=>{events.push('B');});
 const c=lock('claude.ai',async()=>{events.push('C');});
 await lock('chatgpt.com',async()=>{events.push('other');});assert.deepEqual(events,['A','other']);
 gate.resolve();await Promise.all([a,b,c]);assert.deepEqual(events,['A','other','A done','B','C']);
});
test('queued cancellation never runs its request; throw and abort release only after cleanup',async()=>{
 const lock=createHostLock(),gate=deferred(),abort=new AbortController(),running=new AbortController();let called=false;
 const a=lock('claude.ai',async()=>{await gate.promise;},running.signal);const aRejected=assert.rejects(a,{name:'AbortError'});
 const b=lock('claude.ai',async()=>{called=true;},abort.signal);const bRejected=assert.rejects(b,{name:'AbortError'});abort.abort();await bRejected;
 running.abort();const c=lock('claude.ai',async()=>{called=true;});await settle();assert.equal(called,false);
 gate.resolve();await aRejected;await c;assert.equal(called,true);
 await assert.rejects(lock('claude.ai',async()=>{throw Error('fixture failure');}),/fixture failure/);
 assert.equal(await lock('claude.ai',async()=>42),42);
 await assert.rejects(lock('https://claude.ai/path',async()=>1),/Invalid request host/);
});
test('all transports wait for startup cleanup and a rejected barrier never runs HTTP',async()=>{
 const gate=deferred();let called=0;
 const lock=createHostLock(()=>gate.promise);
 const a=lock('chatgpt.com',async()=>{called++;}),b=lock('claude.ai',async()=>{called++;});
 await settle();assert.equal(called,0);gate.resolve();await Promise.all([a,b]);assert.equal(called,2);
 const failed=createHostLock(()=>Promise.reject(Error('Startup cleanup failed')));
 await assert.rejects(failed('chatgpt.com',async()=>{called++;}));assert.equal(called,2);
});
test('a failed rule cleanup blocks queued ambient work before it acquires the host',async()=>{
 const blocked=new Set<string>(),gate=deferred();let ambient=false;
 const lock=createHostLock(undefined,host=>blocked.has(host));
 const vault=lock('chatgpt.com',async()=>{await gate.promise;blocked.add('chatgpt.com');});
 await settle();const next=lock('chatgpt.com',async()=>{ambient=true;});const rejected=assert.rejects(next,/needs recovery/);
 gate.resolve();await vault;await rejected;assert.equal(ambient,false);
 assert.equal(await lock('claude.ai',async()=>42),42);
});
