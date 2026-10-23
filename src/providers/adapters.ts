import { browser } from 'wxt/browser';
import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';
import { AdapterError, isChallengeResponse, responseError } from './errors';
import { readJsonResponse, type JsonResponse } from './response';
import { readAccountProvider, type ReaderOptions,type QuotaRequest } from './reader';
import type { RequestTrace } from '../platform/diagnostics';
export { AdapterError } from './errors';

async function pageJSON(provider:ProviderId,path:string,headers:Record<string,string>,request?:QuotaRequest,trace?:RequestTrace):Promise<JsonResponse>{
 let observed=false;
 let tabAvailable:boolean|null=null;
 try{
  const tabs=await browser.tabs.query({url:providers[provider].origin});
  const tab=tabs.find(item=>item.active)??tabs[0];
  tabAvailable=!!tab?.id;
  if(!tab?.id)throw new AdapterError('waiting-for-tab',`Open ${providers[provider].name} in this browser to refresh its existing session.`);
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
  if(!result)throw new AdapterError('error','The website could not return usage information.');
  observed=true;
  await trace?.record({provider,path,transport:'page',status:result.status,contentType:'contentType' in result?result.contentType:null,
   cfMitigated:'cfMitigated' in result?result.cfMitigated:null,retryAfter:'retryAfter' in result?result.retryAfter:null,
   pageFallbackRan:true,tabAvailable,lastSuccessAt:trace.lastSuccessAt});
  return result;
 }catch(error){
  if(!observed)await trace?.record({provider,path,transport:'page',status:0,pageFallbackRan:true,tabAvailable,lastSuccessAt:trace.lastSuccessAt});
  throw error;
 }
}

async function readJSON(provider:ProviderId,path:string,headers:Record<string,string>={},signal?:AbortSignal,request?:QuotaRequest,trace?:RequestTrace):Promise<unknown>{
 if(request)headers={...headers,'Content-Type':'application/json'};
 if(signal?.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new AdapterError('offline','You are offline. Your previous reading is saved.');
 let tabAvailable:boolean|null=null;
 if(trace)try{tabAvailable=(await browser.tabs.query({url:providers[provider].origin})).some(tab=>!!tab.id);}catch{/* Optional metadata never fails a request. */}
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
 // No new tab or login window is created. Temporary-tab recovery belongs to C4.
 if(fallback){
  try{result=await pageJSON(provider,path,headers,request,trace);}
  catch(error){
   if(result.status===401||isChallengeResponse(result))throw responseError(result,providers[provider].name)!;
   if(error instanceof AdapterError)throw error;
   throw new AdapterError('error','Usage could not be read. Try again with the website open.');
  }
 }
 if(signal?.aborted)throw new AdapterError('error','Refresh was cancelled.',null,'cancelled');
 const rejection=responseError(result,providers[provider].name);if(rejection)throw rejection;
 return result.body;
}

export async function readProvider(provider:ProviderId,options:ReaderOptions={},signal?:AbortSignal,trace?:RequestTrace):Promise<Snapshot>{
 return readAccountProvider(provider,options,(path,headers,request)=>readJSON(provider,path,headers,signal,request,trace));
}
