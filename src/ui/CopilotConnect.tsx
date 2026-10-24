import { useState } from 'react';
import { browser } from 'wxt/browser';
import { COPILOT_PLANS } from '../core/copilot';
import type { ActionRunner } from '../platform/messages';
export function CopilotConnect({run,busy,onSaved,connectionId}:{run:ActionRunner;busy:boolean;onSaved:()=>void;connectionId?:string}){
 const [token,setToken]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('');
 return <form className="connect-steps" onSubmit={async e=>{e.preventDefault();setWorking(true);setError('');try{
  const granted=await browser.permissions.request({origins:['https://api.github.com/*']});
  if(!granted){setError('Allow GitHub API access to connect.');return;}
  if(await run({type:'copilot-connect',token,connectionId}))onSaved();
 }catch{setError('Could not connect. Try again.');}finally{setToken('');setWorking(false)}}}>
 <p>Create a fine-grained personal access token. Under Account permissions, set <strong>Plan → Read-only</strong>. No repository access is needed.</p>
 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create token on GitHub ↗</a>
 <label>Fine-grained personal access token<input type="password" autoComplete="off" spellCheck={false} maxLength={501} value={token} onChange={e=>setToken(e.target.value)} required pattern="github_pat_[A-Za-z0-9_]{10,490}"/></label>
 <small>Encrypted on this device. Premium requests only; choose your allowance in account settings. Checks run at most every 15 minutes.</small>
 {error&&<p role="alert">{error}</p>}<button className="button button--primary" disabled={busy||working}>{working?'Verifying GitHub account…':connectionId?'Replace token':'Connect GitHub Copilot'}</button>
 </form>;
}
export function CopilotSettings({connectionId,allowance,run,busy}:{connectionId:string;allowance:number|null;run:ActionRunner;busy:boolean}){
 const [plan,setPlan]=useState('Custom'),[custom,setCustom]=useState(String(allowance??'')),[replace,setReplace]=useState(false);
 return <div><form className="inline-form" onSubmit={e=>{e.preventDefault();void run({type:'copilot-allowance',connectionId,allowance:plan==='Custom'?(custom?Number(custom):null):COPILOT_PLANS[plan as keyof typeof COPILOT_PLANS]})}}>
 <label>Monthly allowance<select value={plan} onChange={e=>setPlan(e.target.value)}>{Object.entries(COPILOT_PLANS).map(([name,n])=><option key={name} value={name}>{name} · {n}</option>)}<option>Custom</option></select></label>
 {plan==='Custom'&&<label>Requests (blank = unknown)<input type="number" min="1" max="1000000000" step="any" value={custom} onChange={e=>setCustom(e.target.value)}/></label>}
 <button className="button" disabled={busy}>Save allowance</button></form>
 <button className="text-button" disabled={busy} onClick={()=>setReplace(!replace)}>{replace?'Cancel':'Replace token'}</button>{replace&&<CopilotConnect run={run} busy={busy} connectionId={connectionId} onSaved={()=>setReplace(false)}/>}</div>;
}
