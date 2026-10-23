import { PROVIDER_IDS,type ProviderId } from '../core/model';
import { VaultError,VaultSlotSchema,VaultPayloadSchema,vaultCookieHeader,type VaultPayload } from '../core/vault-contracts';
import { providerEndpointAllowed } from '../core/provider-endpoints';
import { providers } from '../providers/catalog';
import type { ReadJSON } from '../providers/reader';
import { AdapterError,responseError,retryTime } from '../providers/errors';
import { readJsonResponse } from '../providers/response';
import type { RequestTrace } from './diagnostics';
export const VAULT_RULE_START=930001,VAULT_RULE_END=930099;
export function vaultRule(provider:ProviderId,extensionId:string,cookie:string){
 if(!/^[a-p]{32}$/.test(extensionId)||!cookie||cookie.length>16384||/[\x00-\x20\x7F]/.test(cookie.replace(/; /g,';')))throw new VaultError('invalid-request');
 const origin=providers[provider].home;
 return {id:VAULT_RULE_START+PROVIDER_IDS.indexOf(provider),priority:2,action:{type:'modifyHeaders' as const,requestHeaders:[
  {header:'cookie',operation:'set' as const,value:cookie},{header:'origin',operation:'set' as const,value:origin},{header:'referer',operation:'set' as const,value:origin+'/'}]},
  condition:{requestDomains:[new URL(origin).hostname],initiatorDomains:[extensionId],tabIds:[-1],resourceTypes:['xmlhttprequest' as const]}};
}
export interface VaultDNR {getSessionRules():Promise<{id:number}[]>;updateSessionRules(options:{removeRuleIds:number[];addRules?:ReturnType<typeof vaultRule>[]}):Promise<void>;}
/** This runs before the shared HTTP startup barrier opens, even while policy is off. */
export async function cleanupVaultRules(port:{dnr?:VaultDNR;permitted():Promise<boolean>}):Promise<void>{
 try{if(!port.dnr||!await port.permitted())return;
  const ids=(await port.dnr.getSessionRules()).filter(r=>r.id>=VAULT_RULE_START&&r.id<=VAULT_RULE_END).map(r=>r.id);
  if(ids.length)await port.dnr.updateSessionRules({removeRuleIds:ids});
 }catch{throw new VaultError('rule-cleanup-failed');}
}
export interface VaultTransportPort {
 extensionId:string;dnr:VaultDNR;enabled(provider:ProviderId):boolean;permitted(provider:ProviderId):Promise<boolean>;
 getVault(slot:string,provider:ProviderId):Promise<{payload:VaultPayload}|null>;
 request(url:string,init:RequestInit):Promise<Response>;
 lock<T>(host:string,run:()=>Promise<T>,signal?:AbortSignal):Promise<T>;now():number;
 /** Persist provider waits using the scheduler's normal cooldown mechanism. */
 wait(provider:ProviderId):Promise<void>;rememberWait(provider:ProviderId,until:number):Promise<void>;
 /** A failed removal must block ambient as well as saved-session HTTP. */
 blockHost(host:string):void;
 /** Same one-time startup cleanup barrier used by ambient transports. */
 ready():Promise<void>;
}
export function createVaultTransport(port:VaultTransportPort){
 let initialized:Promise<void>|undefined;let poisoned=false;
 const initialize=()=>initialized??=port.ready().catch(()=>{poisoned=true;for(const p of PROVIDER_IDS)port.blockHost(new URL(providers[p].home).hostname);throw new VaultError('rule-cleanup-failed');});
 function read(provider:ProviderId,slot:string,signal?:AbortSignal,trace?:RequestTrace):ReadJSON{return async(path,headers={},request)=>{
  try{
  if(!port.enabled(provider))throw new VaultError('disabled');
  if(!VaultSlotSchema.safeParse(slot).success)throw new VaultError('invalid-slot');
  if(!providerEndpointAllowed(provider,path)||request&&(provider!=='grok'||path!=='/rest/rate-limits'||request.method!=='POST')||provider==='grok'&&path==='/rest/rate-limits'&&!request)throw new VaultError('invalid-request');
  for(const [name,value] of Object.entries(headers))if(name.toLowerCase()!=='authorization'||!/^Bearer [\x21-\x7E]{1,20000}$/.test(value))throw new VaultError('invalid-request');
  if(request&&JSON.stringify(request.body).length>1000)throw new VaultError('invalid-request');
  await initialize();if(poisoned)throw new VaultError('rule-cleanup-failed');
  const host=new URL(providers[provider].home).hostname;
  return await port.lock(host,async()=>{
   if(poisoned)throw new VaultError('rule-cleanup-failed');if(signal?.aborted)throw new VaultError('cancelled');
   if(!port.enabled(provider)||!await port.permitted(provider))throw new VaultError('disabled');
   await port.wait(provider);
   const saved=await port.getVault(slot,provider);if(!saved)throw new VaultError('missing');
   if(!VaultPayloadSchema.safeParse(saved.payload,{jitless:true}).success||saved.payload.origin!==providers[provider].home)throw new VaultError('invalid-payload');
   const cookie=vaultCookieHeader(saved.payload,port.now()),rule=vaultRule(provider,port.extensionId,cookie);
   let added=false;
   try{
    if(signal?.aborted)throw new VaultError('cancelled');if(!port.enabled(provider))throw new VaultError('disabled');added=true;
    await port.dnr.updateSessionRules({removeRuleIds:[rule.id],addRules:[rule]});
    if(signal?.aborted)throw new VaultError('cancelled');
    const response=await readJsonResponse(await port.request(new URL(path,providers[provider].home).href,{credentials:'omit',redirect:'error',
     signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(12000)]),method:request?.method??'GET',
     headers:{...headers,...(request?{'Content-Type':'application/json'}:{})},body:request?JSON.stringify(request.body):undefined}));
    await trace?.record({provider,path,transport:'vault',status:response.status,contentType:response.contentType,
     cfMitigated:response.cfMitigated,retryAfter:response.retryAfter,lastSuccessAt:trace.lastSuccessAt});
    const error=responseError(response,providers[provider].name,port.now());
    const next=retryTime(response.retryAfter??null,port.now());
    if(next!==null)await port.rememberWait(provider,next);
    else if(response.status===429)await port.rememberWait(provider,port.now()+60000);
    if(signal?.aborted)throw new VaultError('cancelled');if(error)throw error;return response.body;
   }catch(error){if(error instanceof AdapterError||error instanceof VaultError)throw error;throw new VaultError(signal?.aborted?'cancelled':'request-failed');}
   finally{if(added)try{await port.dnr.updateSessionRules({removeRuleIds:[rule.id]});}catch{poisoned=true;port.blockHost(host);throw new VaultError('rule-cleanup-failed');}}
  },signal);
  }catch(error){if(error instanceof VaultError||error instanceof AdapterError)throw error;throw new VaultError(signal?.aborted?'cancelled':'request-failed');}
 };}
 return {initialize,read};
}
