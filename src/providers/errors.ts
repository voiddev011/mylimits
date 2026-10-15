export type AdapterStatus='signed-out'|'waiting-for-tab'|'unavailable'|'offline'|'error';
export class AdapterError extends Error {
 readonly status:AdapterStatus; readonly retryAt:number|null; readonly code:string;
 constructor(status:AdapterStatus,message:string,retryAt:number|null=null,code:string=status){super(message);this.status=status;this.retryAt=retryAt;this.code=code;}
}
export function retryTime(value:string|null,now=Date.now()):number|null {
 if(!value)return null; const seconds=Number(value);
 const time=Number.isFinite(seconds)&&seconds>=0?now+seconds*1000:Date.parse(value);
 return Number.isFinite(time)&&time>=now?Math.min(time,now+86400000):null;
}
