import { browser } from 'wxt/browser';
import { z } from 'zod';
import { SyncError } from '../core/sync';
import { snapshotSync,syncOrigin } from './sync';
import { syncGrant } from '../core/browser-capabilities';
import { HostedCapabilitiesSchema,HostedListSchema,HostedAttemptSchema,unavailableCapabilities,type HostedProvider } from '../core/hosted-contracts';
import { hostedUnavailable,mergeHosted } from '../core/hosted';
import { updateStore } from './repository';
import { saveHistory } from './history';
import { historyPoint } from '../core/history-data';
let flight:Promise<void>|null=null,last=0;
const attemptKey='mylimits:hosted:attempt:v1';
const windows=new Map<string,number>();
const SavedAttempt=z.object({origin:z.string(),id:z.string().uuid(),provider:z.enum(['openai','claude'])}).strict();
export async function hostedCapabilities(){
 if(!syncOrigin||!await browser.permissions.contains(syncGrant(syncOrigin,__MYLIMITS_BROWSER__)))return unavailableCapabilities();
 const r=await fetch(`${syncOrigin}/hosted/capabilities`,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('Hosted service unavailable.');
 // This tiny public response is bounded before JSON parsing.
 const reader=r.body?.getReader();if(!reader)throw new Error('Empty response.');let data='';let size=0;
 const decoder=new TextDecoder();for(;;){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>8192){await reader.cancel();throw new Error('Invalid capabilities.');}data+=decoder.decode(c.value,{stream:true});}
 data+=decoder.decode();return HostedCapabilitiesSchema.parse(JSON.parse(data));
}
export async function refreshHosted(manual=false){
 if(flight)return flight;if(Date.now()-last<(manual?15000:60000))return;
 last=Date.now();flight=(async()=>{
  try{
   const auth=await snapshotSync.status();if(!auth.connected){await updateStore(s=>({store:hostedUnavailable(s),value:undefined}));return;}
   if(manual){const cached=HostedListSchema.parse(await snapshotSync.hostedRequest('/v1/hosted/connections'));for(const c of cached.connections)if(c.state!=='disconnected'&&c.state!=='needs-auth'&&(c.nextEligibleAt===null||c.nextEligibleAt<=Date.now()))await snapshotSync.hostedRequest(`/v1/hosted/connections/${c.id}/refresh`,'POST',{}).catch(()=>{});}
   const list=HostedListSchema.parse(await snapshotSync.hostedRequest('/v1/hosted/connections'));
   const snapshots=await updateStore(s=>{const store=mergeHosted(s,list,Date.now());return {store,value:store.snapshots.filter(x=>x.accountId.startsWith('hosted:'))};});
   for(const s of snapshots)await saveHistory(historyPoint(s));
  }catch{await updateStore(s=>({store:hostedUnavailable(s),value:undefined}));}
 })().finally(()=>{flight=null;});return flight;
}
export async function hostedStatus(){
 const saved=SavedAttempt.safeParse((await browser.storage.local.get(attemptKey))[attemptKey]);
 let pending:ReturnType<typeof HostedAttemptSchema.parse>|null=null;
 if(saved.success&&saved.data.origin===syncOrigin){try{pending=await hostedAttempt(saved.data.id);}catch{/* Keep ID for a later retry; never infer successful sign-in. */}}
 return {pending,configured:!!syncOrigin,origin:syncOrigin,connected:(await snapshotSync.status()).connected,pairing:(await snapshotSync.status()).pairing,capabilities:await hostedCapabilities()};}
let starting=false;
export async function startHosted(provider:HostedProvider,reconnectId?:string){
 if(starting)throw new Error('Sign-in is already starting.');starting=true;
 try{return await startHostedImpl(provider,reconnectId);}finally{starting=false;}
}
async function startHostedImpl(provider:HostedProvider,reconnectId?:string){
 const saved=SavedAttempt.safeParse((await browser.storage.local.get(attemptKey))[attemptKey]);
 if(saved.success&&saved.data.origin===syncOrigin){try{const old=await hostedAttempt(saved.data.id);if(old.state==='pending'){if(old.provider!==provider)throw new Error('Complete or cancel the pending sign-in first.');return old;}}catch(e){if(!(e instanceof SyncError&&e.status===404))throw e;}}
 const a=HostedAttemptSchema.parse(await snapshotSync.hostedRequest('/v1/hosted/attempts','POST',{provider,requestId:crypto.randomUUID(),...(reconnectId?{reconnectId}:{})}));
 if(a.state==='pending'&&a.authorizationUrl){
  const u=new URL(a.authorizationUrl),allowed=provider==='openai'?['auth.openai.com']:['claude.ai','claude.com'];
  if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed.includes(u.hostname)||!['/oauth/authorize','/cai/oauth/authorize'].includes(u.pathname))throw new Error('Unsupported provider authorization.');
  try{await browser.storage.local.set({[attemptKey]:{origin:syncOrigin,id:a.id,provider}});const window=await browser.windows.create({url:u.href,type:'popup',width:520,height:700});if(window?.id!==undefined)windows.set(a.id,window.id);}catch{await snapshotSync.hostedRequest(`/v1/hosted/attempts/${a.id}`,'DELETE').catch(()=>{});throw new Error('Sign-in window could not open.');}
 }
 // Do not send authorization URLs/state to the UI; popup closure is not success.
 return {...a,authorizationUrl:null};
}
export async function hostedAttempt(id:string,cancel=false){
 try{
  const a=HostedAttemptSchema.parse(await snapshotSync.hostedRequest(`/v1/hosted/attempts/${z.string().uuid().parse(id)}`,cancel?'DELETE':'GET'));
  if(a.state!=='pending'){
   const saved=SavedAttempt.safeParse((await browser.storage.local.get(attemptKey))[attemptKey]);
   if(saved.success&&saved.data.id===id)await browser.storage.local.remove(attemptKey);
   const window=windows.get(id);windows.delete(id);if(window!==undefined)await browser.windows.remove(window).catch(()=>{});
  }
  if(a.state==='connected'){if(flight)await flight;last=0;await refreshHosted();}
  return {...a,authorizationUrl:null};
 }catch(e){if(e instanceof SyncError&&[401,404,410].includes(e.status))await browser.storage.local.remove(attemptKey);throw e;}
}
export async function hostedAction(id:string,action:'rename'|'refresh'|'disconnect'|'forget',alias?:string){
 z.string().uuid().parse(id);if(flight)await flight;await snapshotSync.hostedRequest(`/v1/hosted/connections/${id}${action==='refresh'?'/refresh':action==='forget'?'/data':''}`,action==='rename'?'PATCH':action==='refresh'?'POST':'DELETE',action==='rename'?{alias}:action==='refresh'?{}:undefined);
 last=0;await refreshHosted();return null;
}
