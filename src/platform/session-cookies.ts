import type { ConnectionStatus, ProviderId } from '../core/model';
import { nextRetry } from '../core/scheduler';
import { providers } from '../providers/catalog';
import type { AdapterStatus } from '../providers/errors';

export type SessionCookieState='present'|'absent'|'unknown';
interface CookieMetadata {name:string;domain:string;storeId:string;expirationDate?:number;partitionKey?:unknown;}
interface CookieChange {removed:boolean;cause:string;cookie:CookieMetadata;}
interface CookiePort {
 getAllCookieStores():Promise<{id:string;tabIds:number[]}[]>;
 getAll(details:{url:string;storeId:string}):Promise<CookieMetadata[]>;
 onChanged:{addListener(listener:(change:CookieChange)=>void):void;removeListener(listener:(change:CookieChange)=>void):void};
}
interface SessionPort {
 cookies?:CookiePort;
 tabs:{query(query:Record<string,never>):Promise<{id?:number;incognito?:boolean;cookieStoreId?:string}[]>};
 permissions:{contains(query:{permissions:'cookies'[];origins:string[]}):Promise<boolean>};
 status(provider:ProviderId):Promise<ConnectionStatus|null>;
 verifiedProviders?:readonly ProviderId[];
 now?:()=>number;
 schedule?:(callback:()=>void,ms:number)=>unknown;
 cancel?:(timer:unknown)=>void;
}
// Candidate names from the plan. Absence is not authoritative until live evidence verifies them.
const SESSION:Partial<Record<ProviderId,RegExp>>={claude:/^sessionKey$/,chatgpt:/^__Secure-next-auth\.session-token(?:\.\d+)?$/};
export function supportsSessionSignals(provider:ProviderId){return !!SESSION[provider];}
export function needsSessionSignal(status:ConnectionStatus|null){return status==='active'||status==='needs-auth'||status==='needs-tab';}
function matches(provider:ProviderId,cookie:CookieMetadata):boolean {
 return !!SESSION[provider]?.test(cookie.name)&&cookie.domain.replace(/^\./,'').toLowerCase()===new URL(providers[provider].home).hostname
  &&cookie.partitionKey===undefined;
}
export function authRetryDeadline(status:AdapterStatus,state:SessionCookieState,now:number,failures:number,minutes:number,retryAt:number|null){
 return status==='signed-out'&&state==='absent'?null:nextRetry(now,failures,minutes,retryAt);
}

/** Browser APIs are injected. Only provider cookie metadata is inspected; values are never retained. */
export function createSessionCookies(port:SessionPort){
 const now=port.now??Date.now;
 const schedule=port.schedule??((callback:()=>void,ms:number)=>setTimeout(callback,ms));
 const cancel=port.cancel??((timer:unknown)=>clearTimeout(timer as ReturnType<typeof setTimeout>));
 async function allowed(provider:ProviderId){
  try{return supportsSessionSignals(provider)&&!!port.cookies&&await port.permissions.contains({permissions:['cookies'],origins:[providers[provider].origin]});}
  catch{return false;}
 }
 async function defaultStore():Promise<string|null>{
  if(!port.cookies)return null;
  const [tabs,stores]=await Promise.all([port.tabs.query({}),port.cookies.getAllCookieStores()]);
  // Never infer the default store from list order or a hardcoded Chromium store ID.
  // Firefox containers are not the normal cookie jar; their support is a later task.
  const ids=new Set(tabs.filter(t=>t.id!==undefined&&t.incognito===false&&(!t.cookieStoreId||t.cookieStoreId==='firefox-default')).map(t=>t.id));
  const candidates=stores.filter(store=>store.tabIds.some(id=>ids.has(id)));
  return candidates.length===1?candidates[0]!.id:null;
 }
 async function inspect(provider:ProviderId):Promise<{state:SessionCookieState;names:string[]}>{
  const unknown={state:'unknown' as const,names:[]};
  if(!await allowed(provider))return unknown;
  try{
   const storeId=await defaultStore();if(storeId===null)return unknown;
   const cookies=await port.cookies!.getAll({url:providers[provider].home,storeId});
   if(cookies.some(c=>c.storeId!==storeId||c.partitionKey!==undefined&&SESSION[provider]?.test(c.name)))return unknown;
   const names=[...new Set(cookies.filter(c=>c.storeId===storeId&&matches(provider,c)&&(c.expirationDate===undefined||c.expirationDate>now()/1000)).map(c=>c.name))];
   return {state:names.length?'present':port.verifiedProviders?.includes(provider)?'absent':'unknown',names};
  }catch{return unknown;}
 }
 function listenSessionCookies(onSet:(provider:ProviderId)=>Promise<void>|void):()=>void{
  if(!port.cookies)return ()=>{};
  let stopped=false;
  const pending=new Map<ProviderId,unknown>();
  const generations=new Map<ProviderId,number>();
  function listener(change:CookieChange){
   if(stopped||change.removed||!['explicit','overwrite'].includes(change.cause))return;
   const provider=(Object.keys(SESSION) as ProviderId[]).find(p=>matches(p,change.cookie));
   if(!provider)return;
   const storeId=change.cookie.storeId;
   void (async()=>{
    if(!await allowed(provider)||await defaultStore()!==storeId||!needsSessionSignal(await port.status(provider)))return;
    if(stopped)return;
    const generation=(generations.get(provider)??0)+1;generations.set(provider,generation);
    if(pending.has(provider))cancel(pending.get(provider));
    pending.set(provider,schedule(()=>{
     pending.delete(provider);
     void (async()=>{
      if(stopped||generations.get(provider)!==generation||!await allowed(provider)||await defaultStore()!==storeId)return;
      if(!needsSessionSignal(await port.status(provider))||(await inspect(provider)).state!=='present')return;
      if(!stopped&&generations.get(provider)===generation)await onSet(provider);
     })().catch(()=>{});
    },2000));
   })().catch(()=>{});
  }
  try{port.cookies.onChanged.addListener(listener);}catch{return ()=>{};}
  return ()=>{stopped=true;for(const timer of pending.values())cancel(timer);pending.clear();try{port.cookies!.onChanged.removeListener(listener);}catch{/* Permission may have been revoked. */}};
 }
 return {inspect,sessionCookieState:async(provider:ProviderId)=>(await inspect(provider)).state,listenSessionCookies};
}
