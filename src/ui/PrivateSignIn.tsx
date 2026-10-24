import { useEffect,useState } from 'react';
import { Check,RefreshCw } from 'lucide-react';
import type { ProviderId } from '../core/model';
import { setupCandidate } from '../core/account-setup';
import { privateSignInHelp } from '../core/vault-ui';
import type { ActionRunner,PublicStore } from '../platform/messages';
import type { PrivateAccess } from '../platform/private-access';
export function PrivateSignIn({provider,store,run,access,busy,demo,onSaved}:{provider:ProviderId;store:PublicStore;run:ActionRunner;access:PrivateAccess;busy:boolean;demo:boolean;onSaved:()=>void}){
 const pending=store.accountSetup?.method==='private'?store.accountSetup:null,candidate=pending?setupCandidate(store):null;
 const [method,setMethod]=useState<'private'|'current'>('private'),[working,setWorking]=useState(false),[issue,setIssue]=useState(''),[code,setCode]=useState<string|undefined>(),[consent,setConsent]=useState(false),[nickname,setNickname]=useState('');
 const key=`${pending?.id??''}:${candidate?.id??''}:${candidate?.updatedAt??''}`;
 useEffect(()=>{setConsent(false);setNickname(pending?.nickname??'');setIssue('');setCode(undefined)},[key]);
 const disabled=busy||working||demo,privacy=!!store.settings.privacyMode;
 const fail=(error:unknown)=>{const c=error&&typeof error==='object'&&'code' in error?String(error.code):undefined;setCode(c);setIssue(privateSignInHelp(c));};
 async function start(){
  setWorking(true);setIssue('');setCode(undefined);
  try{if(!await access.grant(provider)){setIssue('Saved-sign-in access was not granted. Nothing was connected.');return;}
   await run({type:'vault-signin-start',provider,method,nickname:''},fail);
  }catch{setIssue('Could not request saved-sign-in access. Try again.');}finally{setWorking(false);}
 }
 async function save(){if(!pending||!candidate||!consent||privacy)return;setWorking(true);
  try{if(await run({type:'vault-signin-save',setupId:pending.id,accountId:candidate.id,consent:true,nickname},fail))onSaved();}finally{setWorking(false);}
 }
 const current=(pending?.captureMethod??method)==='current',browserMatch=!!candidate&&store.connections.some(c=>c.kind==='website'&&c.provider===provider&&c.accountId===candidate.id);
 return <section className="connect-steps saved-signin" aria-label="Saved sign-in">
  {!pending?<><h3>Save a separate sign-in</h3><fieldset className="sign-in-methods"><legend>Sign-in method</legend><label className="check-label"><input type="radio" name="saved-sign-in-method" checked={method==='private'} onChange={()=>setMethod('private')} disabled={disabled}/>Private sign-in (recommended)</label><label className="check-label"><input type="radio" name="saved-sign-in-method" checked={method==='current'} onChange={()=>setMethod('current')} disabled={disabled}/>Save current login</label></fieldset><p>{method==='private'?'A private window keeps the normal browser login separate.':'Uses the account currently signed into this browser.'}</p><button className="button button--primary" disabled={disabled} onClick={()=>void start()}>{method==='private'?'Start private sign-in':'Save current login'}</button></>:candidate?<><span className="setup-success"><Check size={18}/>Identity checked</span><div className="verified-account"><strong>{privacy?'Detected account':candidate.defaultName}</strong>{!privacy&&<small>{candidate.plan??'Plan not reported'} · Local reference {candidate.id.slice(-10)}</small>}</div>{store.accounts.some(a=>a.id===candidate.id)&&<p className="notice">This matches a saved account. Its nickname and history stay.{browserMatch?' Saved sign-in replaces its matching browser tracking source.':''}</p>}<p>Confirm the account shown in the sign-in window before saving.</p>{privacy&&<p className="notice">Turn off Privacy mode to confirm this account.</p>}<label>Account nickname<input aria-label="Saved account nickname" maxLength={60} value={privacy?'':nickname} disabled={disabled||privacy} placeholder="Personal or Work" onChange={e=>setNickname(e.target.value)}/></label><label className="check-label"><input type="checkbox" checked={consent} disabled={disabled||privacy} onChange={e=>setConsent(e.target.checked)}/>I agree to save this account’s encrypted sign-in on this device.</label><button className="button button--primary" disabled={disabled||!consent||privacy} onClick={()=>void save()}>Save account</button></>:<><h3>{pending.phase==='verifying'?'Checking account identity…':'Finish sign-in'}</h3><p role={pending.phase==='error'?'alert':'status'}>{pending.message??'Sign in in the private window. Return here to check the account.'}</p><button className="button" disabled={disabled||pending.phase==='verifying'} onClick={()=>void run({type:'vault-signin-check',setupId:pending.id},fail)}><RefreshCw size={16}/>Check sign-in</button></>}
  {current&&<p className="notice">Signing out of the website will probably end this connection.</p>}
  {!current&&<p className="small-note">Sign in in the private window, then close it after Save — do not log out.</p>}
  {issue&&<p role="alert">{issue}</p>}
  {code==='incognito-access-required'&&method==='private'&&<div className="notice"><strong>Allow in Incognito</strong><p>Open your browser’s Extensions → MyLimits → Details. Turn on Allow in Incognito (Allow in InPrivate on Edge), then retry. You can choose Save current login instead.</p><button className="button" disabled={disabled} onClick={()=>void start()}>Retry private sign-in</button></div>}
  <details className="sign-in-disclosure"><summary>How saved sign-in works</summary><p>MyLimits stores encrypted session cookies locally after you consent. They are never exported or logged. Encryption limits accidental exposure; malware or someone with your entire browser profile may still access them. Sessions can expire or be revoked, and logout survival is unverified.</p>{provider==='chatgpt'&&<p>Available Work / Codex quotas only; ordinary ChatGPT message limits are not inferred.</p>}</details>
  {pending&&<button className="text-button" disabled={disabled} onClick={()=>void run({type:'vault-signin-cancel',setupId:pending.id},fail)}>Cancel saved sign-in</button>}
 </section>;
}
