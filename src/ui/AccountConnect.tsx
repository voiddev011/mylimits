import { useState } from 'react';
import { browser } from 'wxt/browser';
import { ArrowLeft, Check, Plus, RefreshCw, X } from 'lucide-react';
import { accountName, PROVIDER_IDS, type ProviderId } from '../core/model';
import { setupCandidate } from '../core/account-setup';
import { providers } from '../providers/catalog';
import type { Command, PublicStore } from '../platform/messages';
import { ProviderMark } from './ProviderMark';
import { HostedAccounts } from './HostedAccounts';
export const connectionNames:Record<ProviderId,string>={chatgpt:'OpenAI · ChatGPT / Codex',claude:'Claude · Claude Code',cursor:'Cursor',gemini:'Gemini',grok:'Grok',perplexity:'Perplexity'};
export async function focusProvider(provider:ProviderId){
  const existing=(await browser.tabs.query({url:providers[provider].origin})).find(t=>t.id);
  if(existing?.id){await browser.windows.update(existing.windowId,{focused:true});await browser.tabs.update(existing.id,{active:true});}
  else await browser.tabs.create({url:providers[provider].home});
}
export function AccountConnect({store,run,busy,demo,notify,onClose,initialProvider=null}:{store:PublicStore;run:(c:Command)=>Promise<boolean>;busy:boolean;demo:boolean;notify:(s:string)=>void;onClose:()=>void;initialProvider?:ProviderId|null}){
 const [selected,setSelected]=useState<ProviderId|null>(initialProvider??store.accountSetup?.provider??null);
 const [independent,setIndependent]=useState(false),[starting,setStarting]=useState(false);
 const pending=store.accountSetup,candidate=setupCandidate(store),provider=pending?.provider??selected;
 const disabled=busy||starting;
 async function current(){
  if(!provider||demo){notify('Exit preview to connect an account.');return;}
  setStarting(true);
  try{
   if(!await browser.permissions.request({origins:[providers[provider].origin]})){notify('Site access was not granted.');return;}
   const activity=provider==='gemini'||store.providers[provider].readingMode==='activity';
   if(await run(activity?{type:'enable',provider,enabled:true}:{type:'account-setup-start',provider,mode:'detect',nickname:''})){
    await focusProvider(provider);if(activity){notify('Tracking this browser’s activity.');onClose();}
   }
  }catch{notify('Could not open the current account. Try again.');}finally{setStarting(false);}
 }
 return <section className="connect-sheet" aria-label="Add an account"><header className="connect-heading"><div className="inline-actions">{provider&&!pending&&<button className="icon-button" aria-label="Choose a different service" onClick={()=>{setSelected(null);setIndependent(false);}}><ArrowLeft size={18}/></button>}<h2>{provider?connectionNames[provider]:'Add an account'}</h2></div><button className="icon-button" aria-label="Close account setup" onClick={onClose}><X size={18}/></button></header>
 {!provider?<div className="connect-providers">{PROVIDER_IDS.map(p=><button key={p} className="connect-provider" onClick={()=>setSelected(p)}><ProviderMark provider={p}/><span><strong>{connectionNames[p]}</strong><small>{p==='chatgpt'?'Available Codex / Work quotas':p==='gemini'?'Browser activity only':'Available provider readings'}</small></span><Plus size={18}/></button>)}</div>:pending?<div className="connect-steps">{candidate?<><span className="setup-success"><Check size={18}/>Account detected</span><strong>{accountName(candidate)}</strong><button className="button button--primary" disabled={disabled} onClick={()=>void run({type:'account-setup-save',setupId:pending.id,accountId:candidate.id}).then(ok=>{if(ok)onClose();})}>Save detected account</button></>:<><h3>Detecting this browser’s account</h3><p>This uses the website login already in this browser. It does not connect a second independent account.</p><div className="inline-actions"><button className="button" onClick={()=>void focusProvider(pending.provider).catch(()=>notify('Could not open website.'))}>Open current account</button><button className="button button--primary" disabled={disabled} onClick={()=>void run({type:'refresh',provider:pending.provider})}><RefreshCw size={16}/>Check account</button></div></>}
 <button className="text-button" disabled={disabled} onClick={()=>void run({type:'account-setup-cancel',setupId:pending.id}).then(ok=>{if(ok){setSelected(pending.provider);setIndependent(true);}})}>Connect another account instead</button><button className="text-button" disabled={disabled} onClick={()=>void run({type:'account-setup-cancel',setupId:pending.id})}>Cancel setup</button></div>:independent?<HostedAccounts provider={provider==='chatgpt'?'openai':provider==='claude'?'claude':null} demo={demo}/>:<div className="connect-steps"><button className="button button--primary" disabled={disabled} onClick={()=>void current()}>Use current account</button><button className="button" disabled={disabled} onClick={()=>setIndependent(true)}><Plus size={16}/>Connect another account</button><p className="connection-boundary">Current account uses your website login. Independent connections require a supported hosted service; availability is checked separately.</p></div>}
 </section>;
}
