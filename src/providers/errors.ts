export type AdapterStatus='signed-out'|'waiting-for-tab'|'unavailable'|'offline'|'error';
export class AdapterError extends Error {
 readonly status:AdapterStatus; readonly retryAt:number|null; readonly code:string;readonly canRecoverWithTab:boolean;
 constructor(status:AdapterStatus,message:string,retryAt:number|null=null,code:string=status,canRecoverWithTab=false){super(message);this.status=status;this.retryAt=retryAt;this.code=code;this.canRecoverWithTab=canRecoverWithTab;}
}
export function retryTime(value:string|null,now=Date.now()):number|null {
 if(!value)return null; const seconds=Number(value);
 const time=Number.isFinite(seconds)&&seconds>=0?now+seconds*1000:Date.parse(value);
 return Number.isFinite(time)&&time>=now?Math.min(time,now+86400000):null;
}
export interface ResponseInfo {status:number;contentType?:string|null;cfMitigated?:string|null;retryAfter?:string|null;parseFailed?:boolean;}
export function isChallengeResponse(response:ResponseInfo):boolean {
 // Throttling always keeps its provider wait, even when the error page is HTML.
 if(response.status===429)return false;
 const mime=response.contentType?.split(';',1)[0]?.trim().toLowerCase();
 return response.status===403&&response.cfMitigated==='challenge'||mime==='text/html'||mime==='application/xhtml+xml';
}
export function responseError(response:ResponseInfo,name:string,now=Date.now()):AdapterError|null {
 const retryAt=retryTime(response.retryAfter??null,now);
 if(response.status===429)return new AdapterError('error','The website asked us to slow down. Refresh will wait before retrying.',retryAt,'rate-limit');
 if(isChallengeResponse(response))return new AdapterError('waiting-for-tab','Open website to refresh. A browser check is required.',retryAt,'challenge',response.status!==401);
 if(response.status===401)return new AdapterError('signed-out',`Sign in on the ${name} website, then refresh.`);
 if(response.status===403)return new AdapterError('unavailable','The website declined this usage request.',retryAt,'unavailable',true);
 if(response.status===0)return new AdapterError('error','Usage could not be read. Try again with the website open.',null,'network',true);
 if(response.status<200||response.status>=300)return new AdapterError('unavailable','This usage interface is currently unavailable.',retryAt);
 if(response.parseFailed)return new AdapterError('unavailable','The website returned usage information that could not be verified.',null,'shape');
 return null;
}
