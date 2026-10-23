interface Waiter {grant():void;}
interface Lock {held:boolean;queue:Waiter[];}
const cancelled=()=>new DOMException('Request was cancelled.','AbortError');
/** One shared lock per exact host, across ambient/page/temporary/future saved transports. */
export function createHostLock(ready:()=>Promise<void>=()=>Promise.resolve(),blocked:(host:string)=>boolean=()=>false){
 const locks=new Map<string,Lock>();
 function acquire(host:string,signal?:AbortSignal):Promise<()=>void>{
  if(!/^[a-z0-9.-]+$/i.test(host)||host.includes('..'))return Promise.reject(new Error('Invalid request host.'));
  if(signal?.aborted)return Promise.reject(cancelled());
  const key=host.toLowerCase();const lock=locks.get(key)??{held:false,queue:[]};locks.set(key,lock);
  return new Promise((resolve,reject)=>{
   const abort=()=>{const i=lock.queue.indexOf(waiter);if(i<0)return;lock.queue.splice(i,1);signal?.removeEventListener('abort',abort);reject(cancelled());};
   const waiter:Waiter={grant:()=>{
    signal?.removeEventListener('abort',abort);lock.held=true;let released=false;
    resolve(()=>{if(released)return;released=true;lock.held=false;const next=lock.queue.shift();if(next)next.grant();else locks.delete(key);});
   }};
   if(!lock.held)waiter.grant();
   else {lock.queue.push(waiter);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();}
  });
 }
 return async function withHostLock<T>(host:string,run:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  await ready();
  if(blocked(host.toLowerCase()))throw new Error('Request isolation needs recovery.');
  const release=await acquire(host,signal);
  try{if(blocked(host.toLowerCase()))throw new Error('Request isolation needs recovery.');if(signal?.aborted)throw cancelled();const result=await run();if(signal?.aborted)throw cancelled();return result;}
  // Never unlock a still-running request merely because its caller aborted.
  // Transports abort their own I/O; settlement/cleanup must precede the next grant.
  finally{release();}
 };
}
let startup:Promise<void>=Promise.resolve();
/** Install synchronously before registering controller events; failure blocks HTTP. */
export function setHostLockStartup(ready:Promise<void>){startup=ready;void ready.catch(()=>{});}
export function hostLockStartup(){return startup;}
const blockedHosts=new Set<string>();
export function blockHost(host:string){blockedHosts.add(host.toLowerCase());}
export const withHostLock=createHostLock(()=>startup,host=>blockedHosts.has(host));
