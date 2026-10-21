import { useEffect,useState } from 'react';
import { browser } from 'wxt/browser';
import { Plus,RefreshCw } from 'lucide-react';
import { command } from '../platform/messages';
import { syncGrant } from '../core/browser-capabilities';
import type { HostedProvider } from '../core/hosted-contracts';
import { unavailableCapabilities } from '../core/hosted-contracts';
import type { z } from 'zod';
import type { HostedAttemptSchema } from '../core/hosted-contracts';
import type { hostedStatus } from '../platform/hosted';
import type { SyncPublic } from '../core/sync';
type Status=Awaited<ReturnType<typeof hostedStatus>>;
type Attempt=z.infer<typeof HostedAttemptSchema>;
export function HostedAccounts({provider,demo,privacy=false,reconnectId,initialAlias='' }:{provider?:HostedProvider|null;demo:boolean;privacy?:boolean;reconnectId?:string;initialAlias?:string}){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState<Attempt|null>(null),[alias,setAlias]=useState(initialAlias);
 const [pairing,setPairing]=useState(false),[finished,setFinished]=useState(false);
 useEffect(()=>{let live=true;if(!demo)void command<Status>({type:'hosted-status'}).then(s=>{if(live){setStatus(s);if(s.pairing)setPairing(true);if(s.pending?.provider===provider)setAttempt(s.pending);}},()=>{if(live)setError('Hosted service unavailable. Website tracking still works.');});return()=>{live=false;};},[demo]);
 useEffect(()=>{
  if(!attempt||attempt.state!=='pending'||demo)return;let live=true;
  const timer=setInterval(()=>{void command<Attempt>({type:'hosted-attempt',id:attempt.id}).then(a=>{if(live)setAttempt(a);},()=>{if(live)setError('Could not check sign-in. Retry or cancel.');});},3000);
  return()=>{live=false;clearInterval(timer);};
 },[attempt?.id,attempt?.state,demo]);
 useEffect(()=>{
  if(!pairing||demo)return;let live=true;
  const timer=setInterval(()=>{void command<SyncPublic>({type:'hosted-link',action:'poll'}).then(async s=>{if(!live)return;if(s.connected){setPairing(false);setStatus(await command<Status>({type:'hosted-status'}));}else if(!s.pairing){setPairing(false);setError('Sign-in expired. Try again.');}},()=>{if(live)setError('Could not check MyLimits sign-in.');});},3000);
  return()=>{live=false;clearInterval(timer);};
 },[pairing,demo]);
 async function perform(fn:()=>Promise<void>){if(demo){setError('Preview does not connect accounts.');return;}setBusy(true);setError('');try{await fn();}catch{setError('Could not complete this action. Check the service and retry.');}finally{setBusy(false);}}
 async function link(){
  if(!status?.origin)return;
  // Optional service permission requested only in a click gesture, before await.
  const permitted=await browser.permissions.request(syncGrant(status.origin,__MYLIMITS_BROWSER__));if(!permitted){setError('Service access was not granted.');return;}
  await perform(async()=>{const s=await command<SyncPublic>({type:'hosted-link',action:'start'});if(!s.pairing)throw new Error();await browser.windows.create({url:`${status.origin}/?pair=${s.pairing.code}`,type:'popup',width:520,height:700});setPairing(true);});
 }
 const capabilities=status?.capabilities??unavailableCapabilities();
 const cap=capabilities.providers.find(c=>c.provider===provider);
 return <section className="connect-steps" aria-label="Independent accounts"><h3>{reconnectId?'Reconnect account':'Connect another account'}</h3>
 {error&&<p role="alert" className="notice">{error}</p>}
 {!cap?.available?<><p role="status">Not available yet</p><p>{provider==='claude'?'Claude remote sign-in is still being validated.':provider==='openai'?'OpenAI hosted authorization is still being validated.':'Independent sign-in is not available for this service.'}</p><small>No account was connected. Website tracking remains available without a helper.</small>{!demo&&<button className="text-button" disabled={busy} onClick={()=>void perform(async()=>{if(status?.origin&&!await browser.permissions.request(syncGrant(status.origin,__MYLIMITS_BROWSER__)))throw new Error();setStatus(await command<Status>({type:'hosted-status'}));})}><RefreshCw size={14}/>Check availability</button>}</>:!status?.connected?<><p>Connect MyLimits to store and refresh independent accounts on its server. Provider authorization stays on the server.</p><button className="button button--primary" disabled={busy||pairing} onClick={()=>void link()}>{pairing?'Waiting for MyLimits sign-in…':'Sign in to MyLimits'}</button><small>Website tracking needs no MyLimits account. This does not enable snapshot uploads.</small></>:attempt?.state==='pending'?<><p role="status">Complete official sign-in in the window, then confirm the account here.</p><button className="button" disabled={busy} onClick={()=>void perform(async()=>setAttempt(await command<Attempt>({type:'hosted-attempt',id:attempt.id})))}>Check sign-in</button><button className="text-button" disabled={busy} onClick={()=>void perform(async()=>setAttempt(await command<Attempt>({type:'hosted-attempt',id:attempt.id,cancel:true})))}>Cancel sign-in</button></>:attempt?.state==='connected'?<><p role="status">{finished?'Account saved':'Account verified'}</p>{attempt.identity&&!privacy&&<p className="small-note">Account ID: {attempt.identity.subject}{attempt.identity.workspace&&` · ${attempt.identity.workspace}`}</p>}{!finished&&<form onSubmit={e=>{e.preventDefault();void perform(async()=>{if(!privacy)await command({type:'hosted-action',id:attempt.connectionId!,action:'rename',alias});setFinished(true);});}}><label>Nickname (optional)<input maxLength={60} disabled={privacy} value={privacy?'':alias} onChange={e=>setAlias(e.target.value)} placeholder="Personal or Work"/></label><button className="button button--primary" disabled={busy}>Save account</button></form>}</>:<>{attempt&&<p role="status">{attempt.state==='duplicate'?'That account is already connected. Your existing account was kept.':attempt.state==='cancelled'?'Sign-in cancelled.':attempt.state==='expired'?'Sign-in expired.':'Sign-in did not complete.'}</p>}<p>{provider==='openai'?'Available Codex / Work quotas only.':'Available subscription quotas only.'} Choose your other account during official sign-in.</p><button className="button button--primary" disabled={busy} onClick={()=>void perform(async()=>{setFinished(false);setAttempt(await command<Attempt>({type:'hosted-start',provider:provider!,reconnectId}));})}><Plus size={16}/>Sign in to {provider==='openai'?'OpenAI':'Claude'}</button></>}
 </section>;
}
