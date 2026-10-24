import { CopilotConnect } from './CopilotConnect';
import { useState } from 'react';
import { browser } from 'wxt/browser';
import { ArrowLeft, Check, Plus, RefreshCw, X } from 'lucide-react';
import { accountName, PROVIDER_IDS, type ProviderId } from '../core/model';
import { providers } from '../providers/catalog';
import type { ActionRunner, PublicStore } from '../platform/messages';
import { ProviderMark } from './ProviderMark';
import { supportsSessionSignals } from '../platform/session-cookies';
import { pickNormalTab } from '../core/browser-tabs';
import { offerSavedSignIn } from '../core/vault-ui';
import { createPrivateAccess } from '../platform/private-access';
import { PrivateSignIn } from './PrivateSignIn';
const privateAccess=createPrivateAccess({permissions:browser.permissions});
export const connectionNames:Record<ProviderId,string>={copilot:'GitHub Copilot',chatgpt:'ChatGPT / Codex',claude:'Claude / Claude Code',cursor:'Cursor'};
export async function focusProvider(provider:ProviderId){
  const existing=pickNormalTab(await browser.tabs.query({url:providers[provider].origin}));
  if(existing?.id){await browser.windows.update(existing.windowId,{focused:true});await browser.tabs.update(existing.id,{active:true});}
  else await browser.tabs.create({url:providers[provider].home});
}
export function AccountConnect({store,run,busy,demo,notify,onClose,initialProvider=null}:{store:PublicStore;run:ActionRunner;busy:boolean;demo:boolean;notify:(s:string)=>void;onClose:()=>void;initialProvider?:ProviderId|null}){
 const [selected,setSelected]=useState<ProviderId|null>(initialProvider??store.accountSetup?.provider??null);
 const [starting,setStarting]=useState(false);
 const [siteOnly,setSiteOnly]=useState(false);
 const [website,setWebsite]=useState(false);
 const pending=store.accountSetup?.method==='private'?store.accountSetup:null,provider=pending?.provider??selected;
 const offered=!!provider&&offerSavedSignIn(provider,__MYLIMITS_BROWSER__);
 const disabled=busy||starting;
 async function current(withSignals=true){
  if(!provider||demo){notify('Exit preview to connect an account.');return;}
  setStarting(true);
  try{
   const signals=withSignals&&supportsSessionSignals(provider);
   const granted=await browser.permissions.request({origins:[providers[provider].origin],...(signals?{permissions:['cookies']}: {})});
   if(!granted&&!await browser.permissions.contains({origins:[providers[provider].origin]})){setSiteOnly(signals);notify('Site access was not granted.');return;}
   setSiteOnly(false);

   if(await run({type:'enable',provider,enabled:true})){await focusProvider(provider);onClose();}
  }catch{notify('Could not open the current account. Try again.');}finally{setStarting(false);}
 }
 return <section className="connect-sheet" aria-label="Add an account"><header className="connect-heading"><div className="inline-actions">{provider&&!pending&&<button className="icon-button" aria-label="Choose a different service" onClick={()=>{setSelected(null);setWebsite(false);setSiteOnly(false);}}><ArrowLeft size={18}/></button>}<h2>{provider?connectionNames[provider]:'Add an account'}</h2></div><button className="icon-button" aria-label="Close account setup" onClick={onClose}><X size={18}/></button></header>
 {provider&&!pending&&offered&&<div className="sign-in-choices" role="group" aria-label="Connection method"><button className="button" aria-pressed={!website} disabled={disabled} onClick={()=>{setWebsite(false)}}>Private sign-in</button><button className="button" aria-pressed={website} disabled={disabled} onClick={()=>{setWebsite(true)}}>Use current browser login</button></div>}
 {!provider?<div className="connect-providers">{PROVIDER_IDS.map(p=><button key={p} className="connect-provider" onClick={()=>{setSelected(p);setSiteOnly(false);}}><ProviderMark provider={p}/><span><strong>{connectionNames[p]}</strong><small>{p==='chatgpt'?'Available Codex / Work quotas':'Available provider readings'}</small></span><Plus size={18}/></button>)}</div>:provider==='copilot'?<CopilotConnect run={run} busy={busy||demo} onSaved={onClose}/>:pending?.method==='private'?<PrivateSignIn provider={provider} store={store} run={run} access={privateAccess} busy={busy} demo={demo} onSaved={onClose}/>:offered&&!website?<PrivateSignIn provider={provider} store={store} run={run} access={privateAccess} busy={busy} demo={demo} onSaved={onClose}/>:<div className="connect-steps"><button className="button button--primary" disabled={disabled} onClick={()=>void current()}>Use current browser login</button>{siteOnly&&<button className="text-button" disabled={disabled} onClick={()=>void current(false)}>Continue without sign-in detection</button>}</div>}
 </section>;
}
