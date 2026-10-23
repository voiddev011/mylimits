import { PROVIDER_IDS, type ProviderId } from '../core/model';
import { isNormalTab, type TabIdentity } from '../core/browser-tabs';
import { providers } from '../providers/catalog';
import { AdapterError } from '../providers/errors';
import type { DiagnosticStorage } from './diagnostics';
import type { SessionCookieState } from './session-cookies';

export const RECOVERY_COUNTERS_KEY='mylimits:recovery-counters:v1';
export const RECOVERY_TABS_KEY='mylimits:recovery-tabs:v1';
export const RECOVERY_COOLDOWN_MS=30*60000;
export const RECOVERY_DAILY_LIMIT=8;
interface RecoveryTab extends TabIdentity {windowId?:number;status?:string;pendingUrl?:string;}
interface OwnedTab {id:number;windowId:number;provider:ProviderId;createdAt:number;}
interface Budget {day:string;attempts:number;lastAttemptAt:number;}
interface EventPort<T extends (...args:any[])=>void>{addListener(listener:T):void;removeListener(listener:T):void;}
interface RecoveryPort {
 tabs:{get(id:number):Promise<RecoveryTab>;create(properties:{url:string;active:false;windowId:number}):Promise<RecoveryTab>;remove(id:number):Promise<unknown>;
  onUpdated:EventPort<(id:number,info:{status?:string},tab:RecoveryTab)=>void>;
  onRemoved:EventPort<(id:number)=>void>;onActivated?:EventPort<(info:{tabId:number})=>void>};
 windows:{getAll(query:{windowTypes:['normal']}):Promise<{id?:number;incognito?:boolean;focused?:boolean}[]>};
 local:DiagnosticStorage;session?:DiagnosticStorage;now?:()=>number;
 schedule?:(callback:()=>void,ms:number)=>unknown;cancel?:(timer:unknown)=>void;
}
export interface RecoveryOptions {enabled:boolean|(()=>Promise<boolean>);cookieState:SessionCookieState;signal?:AbortSignal;onStart?:()=>Promise<void>;}
export interface RecoveryAccess {
 withTemporaryTab<T>(provider:ProviderId,run:(tabId:number,signal:AbortSignal)=>Promise<T>,options:RecoveryOptions):Promise<T>;
 owns(id:number):boolean;
}
function failure(code:string,message='Open website to refresh. Automatic recovery is unavailable.'){return new AdapterError('waiting-for-tab',message,null,code);}
function abortError(){return new AdapterError('error','Refresh was cancelled.',null,'cancelled');}
function integer(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function ownership(raw:unknown):OwnedTab[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>PROVIDER_IDS.length)throw failure('recovery-storage');
 return raw.map(item=>{
  if(!item||!integer(item.id)||!integer(item.windowId)||!integer(item.createdAt)||!PROVIDER_IDS.includes(item.provider))throw failure('recovery-storage');
  return {id:item.id,windowId:item.windowId,provider:item.provider,createdAt:item.createdAt};
 });
}
function sameOwnedTab(tab:RecoveryTab,owned:OwnedTab){
 if(tab.id!==owned.id||tab.windowId!==owned.windowId||!isNormalTab(tab))return false;
 try{return new URL(tab.pendingUrl??tab.url??'').origin===providers[owned.provider].home;}catch{return false;}
}

/** One recorded, inactive normal tab per recovery transaction; no credentials or Store writes. */
export function createTabRecovery(port:RecoveryPort){
 const now=port.now??Date.now;
 const schedule=port.schedule??((callback:()=>void,ms:number)=>setTimeout(callback,ms));
 const cancel=port.cancel??((timer:unknown)=>clearTimeout(timer as ReturnType<typeof setTimeout>));
 const active=new Map<ProviderId,AbortController>();const ownedIds=new Set<number>();
 let queue:Promise<unknown>=Promise.resolve();let ready:Promise<void>|undefined;let available=!!port.session;
 function serial<T>(run:()=>Promise<T>){const task=queue.then(run);queue=task.catch(()=>{});return task;}
 async function records(){return ownership((await port.session!.get(RECOVERY_TABS_KEY))[RECOVERY_TABS_KEY]);}
 async function forget(id:number){await serial(async()=>{const saved=await records();await port.session!.set({[RECOVERY_TABS_KEY]:saved.filter(t=>t.id!==id)});});}
 async function closeOwned(record:OwnedTab,abandoned=false){
  try{
   let tab:RecoveryTab;
   try{tab=await port.tabs.get(record.id);}catch{await forget(record.id);return;}
   if(!abandoned&&!tab.active&&tab.id===record.id&&tab.windowId===record.windowId&&isNormalTab(tab))await port.tabs.remove(record.id);
   await forget(record.id);
  }finally{ownedIds.delete(record.id);}
 }
 async function initialize(){
  ready??=(async()=>{
   if(!port.session)return;
   try{for(const record of await records()){ownedIds.add(record.id);await closeOwned(record);}}
   catch{available=false;}
  })();return ready;
 }
 async function reserve(provider:ProviderId){
  await serial(async()=>{
   const raw=(await port.local.get(RECOVERY_COUNTERS_KEY))[RECOVERY_COUNTERS_KEY];
   if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw failure('recovery-storage');
   const counters={...(raw??{})} as Partial<Record<ProviderId,Budget>>;
   const clock=now();const day=new Date(clock).toISOString().slice(0,10);const previous=counters[provider];
   if(previous&&(!/^\d{4}-\d{2}-\d{2}$/.test(previous.day)||!integer(previous.attempts)||previous.attempts>RECOVERY_DAILY_LIMIT||!integer(previous.lastAttemptAt)))throw failure('recovery-storage');
   if(previous&&clock<previous.lastAttemptAt+RECOVERY_COOLDOWN_MS)throw failure('recovery-cooldown');
   const count=previous&&previous.day>=day?previous.attempts:0;
   if(count>=RECOVERY_DAILY_LIMIT)throw failure('recovery-daily-limit');
   counters[provider]={day,attempts:count+1,lastAttemptAt:clock};
   await port.local.set({[RECOVERY_COUNTERS_KEY]:counters});
  });
 }
 function aborted<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise((resolve,reject)=>{
   const abort=()=>reject(abortError());signal.addEventListener('abort',abort,{once:true});
   work.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
   if(signal.aborted)abort();
  });
 }
 function pause(ms:number,signal:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
   const abort=()=>{cancel(timer);signal.removeEventListener('abort',abort);reject(abortError());};
   const timer=schedule(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  });
 }
 function loaded(record:OwnedTab,signal:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
   let done=false;
   const finish=(error?:Error)=>{if(done)return;done=true;cancel(timer);port.tabs.onUpdated.removeListener(update);port.tabs.onRemoved.removeListener(removed);signal.removeEventListener('abort',abort);error?reject(error):resolve();};
   const update=(id:number,info:{status?:string},tab:RecoveryTab)=>{if(id===record.id&&info.status==='complete')sameOwnedTab(tab,record)?finish():finish(failure('recovery-navigation'));};
   const removed=(id:number)=>{if(id===record.id)finish(failure('recovery-closed'));};
   const abort=()=>finish(abortError());
   const timer=schedule(()=>finish(failure('recovery-timeout')),20000);
   port.tabs.onUpdated.addListener(update);port.tabs.onRemoved.addListener(removed);signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted){abort();return;}
   void port.tabs.get(record.id).then(tab=>{if(tab.status==='complete')sameOwnedTab(tab,record)?finish():finish(failure('recovery-navigation'));},()=>finish(failure('recovery-closed')));
  });
 }
 async function withTemporaryTab<T>(provider:ProviderId,run:(tabId:number,signal:AbortSignal)=>Promise<T>,options:RecoveryOptions):Promise<T>{
  const enabled=()=>typeof options.enabled==='function'?options.enabled():Promise.resolve(options.enabled);
  if(!await enabled()||options.cookieState==='absent')throw failure('recovery-disabled');
  if(options.signal?.aborted)throw abortError();
  if(active.has(provider))throw failure('recovery-busy');
  const controller=new AbortController();active.set(provider,controller);
  const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
  let record:OwnedTab|undefined;let abandoned=false;
  const activated=(info:{tabId:number})=>{if(info.tabId===record?.id){abandoned=true;controller.abort();}};
  try{
   await initialize();if(!available)throw failure('recovery-storage');
   if(controller.signal.aborted)throw abortError();
   if((await records()).some(t=>t.provider===provider))throw failure('recovery-cleanup');
   const windows=(await port.windows.getAll({windowTypes:['normal']})).filter(w=>w.id!==undefined&&w.incognito===false);
   const window=windows.find(w=>w.focused)??windows[0];if(window?.id===undefined)throw failure('recovery-no-window');
   await reserve(provider);if(controller.signal.aborted)throw abortError();if(!await enabled())throw failure('recovery-disabled');
   const tab=await port.tabs.create({url:providers[provider].home,active:false,windowId:window.id});
   if(tab.id===undefined)throw failure('recovery-create');
   record={id:tab.id,windowId:window.id,provider,createdAt:now()};ownedIds.add(tab.id);
   await serial(async()=>{const saved=await records();await port.session!.set({[RECOVERY_TABS_KEY]:[...saved,record!]});});
   if(!isNormalTab(tab)||tab.windowId!==window.id)throw failure('recovery-context');
   if(tab.active){abandoned=true;throw failure('recovery-user-activity');}
   port.tabs.onActivated?.addListener(activated);
   await options.onStart?.();await loaded(record,controller.signal);await pause(3000,controller.signal);
   const current=await port.tabs.get(tab.id);if(!sameOwnedTab(current,record)||current.active){abandoned=!!current.active;throw failure('recovery-navigation');}
   if(controller.signal.aborted)throw abortError();
   return await aborted(run(tab.id,controller.signal),controller.signal);
  }catch(error){
   if(error instanceof AdapterError)throw error;
   throw failure('recovery-unavailable');
  }finally{
   options.signal?.removeEventListener('abort',abort);port.tabs.onActivated?.removeListener(activated);
   try{if(record)await closeOwned(record,abandoned);}catch{/* Retain ownership for cleanup on the next worker start. */}
   active.delete(provider);
  }
 }
 return {initialize,withTemporaryTab,owns:(id:number)=>ownedIds.has(id),cancelAll:()=>{for(const controller of active.values())controller.abort();}};
}
