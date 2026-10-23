import { browser } from 'wxt/browser';
import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';
import { AdapterError, isChallengeResponse, responseError } from './errors';
import { readJsonResponse, type JsonResponse } from './response';
import { readAccountProvider, type ReaderOptions,type QuotaRequest } from './reader';
import type { RequestTrace } from '../platform/diagnostics';
import { isNormalTab, pickNormalTab } from '../core/browser-tabs';
import type { RecoveryAccess, RecoveryOptions } from '../platform/bootstrap-tab';
export { AdapterError } from './errors';

async function pageJSON(provider:ProviderId,path:string,headers:Record<string,string>,request?:QuotaRequest,trace?:RequestTrace,explicitTab?:number,owns?:(id:number)=>boolean):Promise<JsonResponse>{
 let observed=false;
 let tabAvailable:boolean|null=null;
 try{
  const tabs=explicitTab===undefined?await browser.tabs.query({url:providers[provider].origin}):[await browser.tabs.get(explicitTab)];
  const tab=pickNormalTab(tabs,explicitTab===undefined?owns:undefined);
  tabAvailable=!!tab?.id;
  if(tab?.id===undefined||!isNormalTab(tab))throw new AdapterError('waiting-for-tab','Open website to refresh.',null,'waiting-for-tab',true);
  const results=await browser.scripting.executeScript({
   target:{tabId:tab.id},world:'MAIN',
   func:async(targetPath:string,requestHeaders:Record<string,string>,expectedOrigin:string,quotaRequest:QuotaRequest|null)=>{
    if(location.origin!==expectedOrigin||!targetPath.startsWith('/')||targetPath.startsWith('//'))return {status:400,body:null};
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
     const response=await fetch(new URL(targetPath,expectedOrigin),{credentials:'include',headers:requestHeaders,signal:controller.signal,
      redirect:'error',method:quotaRequest?.method??'GET',body:quotaRequest?JSON.stringify(quotaRequest.body):undefined});
     const contentType=response.headers.get('content-type');
     const mime=contentType?.split(';',1)[0]?.trim().toLowerCase();
     let body:unknown=null;let parseFailed=false;
     if(response.ok&&mime!=='text/html'&&mime!=='application/xhtml+xml')try{body=await response.json();}catch{parseFailed=true;}
     return {status:response.status,body,parseFailed,contentType,cfMitigated:response.headers.get('cf-mitigated'),retryAfter:response.headers.get('retry-after')};
    }finally{clearTimeout(timer);}
   },args:[path,headers,providers[provider].home,request??null],
  });
  const result=results[0]?.result;
  if(!result)throw new AdapterError('waiting-for-tab','Open website to refresh. The browser could not complete the check.',null,'waiting-for-tab',true);
  observed=true;
  await trace?.record({provider,path,transport:explicitTab===undefined?'page':'temp-tab',status:result.status,contentType:'contentType' in result?result.contentType:null,
   cfMitigated:'cfMitigated' in result?result.cfMitigated:null,retryAfter:'retryAfter' in result?result.retryAfter:null,
   pageFallbackRan:true,tabAvailable,lastSuccessAt:trace.lastSuccessAt});
  return result;
 }catch(error){
  if(!observed)await trace?.record({provider,path,transport:explicitTab===undefined?'page':'temp-tab',status:0,pageFallbackRan:true,tabAvailable,lastSuccessAt:trace.lastSuccessAt});
  throw error;
 }
}

async function readJSON(provider:ProviderId,path:string,headers:Record<string,string>={},signal?:AbortSignal,request?:QuotaRequest,trace?:RequestTrace,owns?:(id:number)=>boolean):Promise<unknown>{
 if(request)headers={...headers,'Content-Type':'application/json'};
 if(signal?.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new AdapterError('offline','You are offline. Your previous reading is saved.');
 let tabAvailable:boolean|null=null;
 if(trace)try{tabAvailable=!!pickNormalTab(await browser.tabs.query({url:providers[provider].origin}),owns);}catch{/* Optional metadata never fails a request. */}
 const controller=new AbortController();const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 const timer=setTimeout(()=>controller.abort(),12000);
 let result:JsonResponse;
 try{result=await readJsonResponse(await fetch(new URL(path,providers[provider].home),{credentials:'include',headers,signal:controller.signal,
  redirect:'error',method:request?.method??'GET',body:request?JSON.stringify(request.body):undefined}));}
 catch{result={status:0,body:null};}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 const fallback=[0,401,403].includes(result.status)||isChallengeResponse(result);
 await trace?.record({provider,path,transport:'background',status:result.status,contentType:result.contentType,cfMitigated:result.cfMitigated,
  retryAfter:result.retryAfter,pageFallbackRan:!signal?.aborted&&fallback,tabAvailable,lastSuccessAt:trace.lastSuccessAt});
 if(signal?.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
 // Existing normal tabs come first; readProvider owns the single recovery transaction.
 if(fallback){
  try{result=await pageJSON(provider,path,headers,request,trace,undefined,owns);}
  catch(error){
   const initial=responseError(result,providers[provider].name);
   if(result.status===401||isChallengeResponse(result)||initial?.retryAt)throw initial!;
   if(error instanceof AdapterError)throw error;
   throw new AdapterError('error','Usage could not be read. Try again with the website open.',null,'network',true);
  }
 }
 if(signal?.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
 const rejection=responseError(result,providers[provider].name);if(rejection)throw rejection;
 return result.body;
}

export async function readProvider(provider:ProviderId,options:ReaderOptions={},signal?:AbortSignal,trace?:RequestTrace,recovery?:{access:RecoveryAccess;options:RecoveryOptions}):Promise<Snapshot>{
 try{return await readAccountProvider(provider,options,(path,headers,request)=>readJSON(provider,path,headers,signal,request,trace,recovery?.access.owns));}
 catch(error){
  if(!recovery||!(error instanceof AdapterError)||!error.canRecoverWithTab||error.status==='signed-out'||signal?.aborted||error.retryAt!==null&&error.retryAt>Date.now())throw error;
  return recovery.access.withTemporaryTab(provider,(tabId,recoverySignal)=>readAccountProvider(provider,options,async(path,headers={},request)=>{
   if(recoverySignal.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
   const result=await pageJSON(provider,path,request?{...headers,'Content-Type':'application/json'}:headers,request,trace,tabId);
   if(recoverySignal.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
   const rejection=responseError(result,providers[provider].name);if(rejection)throw rejection;return result.body;
  }),{...recovery.options,signal});
 }
}
