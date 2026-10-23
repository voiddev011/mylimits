import type { ConnectionRecord } from './model';
export type RefreshReason='scheduled'|'manual'|'open'|'startup'|'tab'|'cookie'|'idle';
const AUTH_SIGNALS:readonly RefreshReason[]=['manual','tab','cookie'];
export function shouldRefresh(c:ConnectionRecord,reason:RefreshReason,now:number,minutes:number):boolean {
 if(!c.enabled)return false;
 if(c.lastAttemptAt!==null&&now-c.lastAttemptAt<15000)return false;
 // An explicit sign-in signal may retry authentication, but never bypasses the click cooldown.
 if(c.status==='needs-auth'){
  if(c.kind==='vault')return c.nextRetryAt!==null&&now>=c.nextRetryAt;
  if(AUTH_SIGNALS.includes(reason))return true;
  return c.nextRetryAt!==null&&now>=c.nextRetryAt;
 }
 // A restart or repeated manual click must not bypass a persisted provider wait.
 if(c.nextRetryAt!==null&&now<c.nextRetryAt)return false;
 if(['manual','tab','startup'].includes(reason))return true;
 if(c.nextRetryAt!==null)return now>=c.nextRetryAt;
 if(reason==='open'&&c.status==='active'&&c.lastSuccessAt!==null&&now-c.lastSuccessAt<minutes*60000)return false;
 return c.lastAttemptAt===null||now-c.lastAttemptAt>=minutes*60000;
}
export function nextRetry(now:number,failures:number,minutes:number,retryAt:number|null):number {
 const backoff=now+Math.min(60,minutes*2**Math.min(failures,5))*60000;
 return Math.max(backoff,Math.min(retryAt??0,now+86400000));
}
export class RefreshCoordinator {
 private running=0; private waiters:(()=>void)[]=[];
 private entries=new Map<string,{controller:AbortController;promise:Promise<void>}>();
 async run(id:string,task:(signal:AbortSignal)=>Promise<void>):Promise<void>{
  const existing=this.entries.get(id);
  if(existing){if(!existing.controller.signal.aborted)return existing.promise;await existing.promise.catch(()=>{});return this.run(id,task);}
  const controller=new AbortController();
  const promise=(async()=>{
   if(this.running>=this.limit)await new Promise<void>(resolve=>this.waiters.push(resolve));
   else this.running++;
   try{if(!controller.signal.aborted)await task(controller.signal);}finally{const next=this.waiters.shift();if(next)next();else this.running--;}
  })();
  const entry={controller,promise};this.entries.set(id,entry);
  try{await promise;}finally{if(this.entries.get(id)===entry)this.entries.delete(id);}
 }
 readonly limit:number;
 constructor(limit=2){this.limit=limit;}
 cancel(id:string){this.entries.get(id)?.controller.abort();}
}
