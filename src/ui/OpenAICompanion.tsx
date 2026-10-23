import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Check, ExternalLink, Plus, RefreshCw, Unplug, X } from 'lucide-react';
import { command, type Command } from '../platform/messages';
import type { companionStatus } from '../platform/companion';
import { age, countdown } from './format';

type Status = Awaited<ReturnType<typeof companionStatus>>;
const initial: Status = { enabled: false, connected: false, compatible: false, capabilities: null, profiles: [], issue: null };
const descriptions: Record<string,string> = {
  'signing-in': 'Finish sign-in in the separate browser window', verifying: 'Checking reported identity', 'awaiting-confirmation':'Confirm the account below',
  connected: 'Connected', 'needs-sign-in': 'Needs sign-in', 'needs-setup':'Finish official Claude setup', duplicate: 'Possible existing account',
  disconnected: 'Disconnected · last reading retained', unavailable: 'Check connection',
};
const errorHelp:Record<string,string>={
 'unsupported-cli':'Update official Claude Code to version 2.1.301 or later.',
 'missing-browser-router':'Update or reinstall the helper to create its separate sign-in launcher.',
 'browser-route-unconfirmed':'A separate sign-in browser was not confirmed. Update the helper and retry.',
 'terminal-stop-unconfirmed':'Reopen Desktop setup to repair owned processes before trying again.',
 'shutdown-unconfirmed':'Reopen Desktop setup to repair owned processes before trying again.',
 'missing-setup-terminal':'Linux first-party setup needs xterm. Windows setup includes its terminal launcher.',
 'unverified-profile':'The official CLI did not confirm this account’s isolated profile. Update Claude Code.',
 'unverified-identity':'The provider did not report an account identity. Sign-in was not accepted.',
 'unsupported-auth':'Use your Claude subscription in the official sign-in flow. API/Console logins are a separate source.',
 'unsupported-panel':'The official usage panel could not be read. Update Claude Code and retry after the wait.',
 'throttled':'The provider asked us to wait. The next check time is shown below.',
};
export function OpenAICompanion({ run, busy, demo, notify, nickname = '', provider = 'openai', privacy = false }: {
  run: (action: Command) => Promise<boolean>; busy: boolean; demo: boolean; notify: (message: string) => void; nickname?: string;
  provider?: 'openai'|'claude'; privacy?: boolean;
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [working, setWorking] = useState(false);
  const [issue, setIssue] = useState('');
  const [now, setNow] = useState(Date.now());
  const [aliases,setAliases] = useState<Record<string,string>>({});
  async function check() {
    if (demo) return;
    try { setStatus(await command<Status>({ type: 'companion-status' })); setIssue(''); }
    catch { setIssue('Could not reach MyLimits Desktop. Open it, then retry.'); }
  }
  useEffect(() => {
    let mounted = true, polling = false;
    const update = async () => {
      if (demo || polling) return; polling = true;
      try { const value = await command<Status>({ type: 'companion-status' }); if (mounted) { setStatus(value); setIssue(''); setNow(Date.now()); } }
      catch { if (mounted) setIssue('Could not reach MyLimits Desktop. Retry its connection.'); }
      finally { polling = false; }
    };
    void update(); const timer = setInterval(() => void update(), 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [demo]);
  async function enable() {
    if (demo) { notify('Exit preview to connect an account.'); return; }
    const granted = await browser.permissions.request({ permissions: ['nativeMessaging'] });
    if (!granted) { notify('Desktop access was not granted.'); return; }
    setWorking(true);
    try { await run({ type: 'companion-enable', enabled: true }); await check(); }
    finally { setWorking(false); }
  }
  async function action(value: Command) {
    setWorking(true);
    try { await run(value); await check(); } finally { setWorking(false); }
  }
  if (__MYLIMITS_BROWSER__ === 'firefox') return <article className="website-card"><h3>Independent connections</h3><p>Helper setup currently supports desktop Chromium browsers on Windows/Linux. Firefox website tracking remains available.</p></article>;
  const name=provider==='claude'?'Claude':'OpenAI';
  const list = status.profiles.filter(p => p.provider === provider);
  const supported = status.compatible && status.capabilities?.providers.some(p => p.provider === provider && p.available);
  const disabled = busy || working || demo;
  const signingIn=status.profiles.some(p=>p.authState==='signing-in'||p.authState==='verifying');
  const setupURL=__MYLIMITS_DESKTOP_SETUP_URL__||'https://github.com/voiddev011/mylimits/actions?query=branch%3Afeature%2Fdesktop-independent-accounts';
  return <section className="independent-accounts" aria-label="Independent account connections">
    <div className="section-heading"><h3>Independent {name} accounts</h3><p>{provider==='claude'?'Subscription limits · official Claude Code':'Codex quotas · separate sign-in for each account'}</p></div>
    <div className="connection-readiness" role="status">{demo ? 'Sample mode' : status.compatible ? 'Desktop connected · experimental provider support' : status.enabled ? status.issue ?? 'Desktop unavailable or needs an update' : 'Connect MyLimits Desktop once for separate account logins.'}</div>
    {issue && <p role="alert">{issue}</p>}
    {status.compatible&&!supported&&<p className="notice">{status.capabilities?.providers.find(p=>p.provider===provider)?.reason??'Update the helper for this provider.'}</p>}
    <div className="inline-actions">
      {!status.compatible ? <button className="button button--primary" disabled={disabled} onClick={() => void enable().catch(() => notify('Could not connect Desktop. Install or open it, then retry.'))}><RefreshCw size={14}/>{status.enabled ? 'Retry Desktop' : 'Connect Desktop'}</button> : <button className="button button--primary" disabled={disabled || !supported || signingIn} onClick={() => void action({ type: 'companion-add', provider, nickname }).catch(() => notify('Could not start sign-in. Check Desktop.'))}><Plus size={14}/>Sign in to {name}</button>}
      {!status.compatible&&<a className="text-button" href={setupURL} target="_blank" rel="noreferrer">{__MYLIMITS_DESKTOP_SETUP_URL__?'Install MyLimits Desktop':'Get Desktop test setup'}<ExternalLink size={12}/></a>}
    </div>
    <p className="small-note">{provider==='claude'?'Separate official Claude Code login. First use may require provider setup.':'Separate OpenAI login · available Codex quotas only.'} Your normal browser login stays separate. Real account acceptance is pending.</p>
    <div className="independent-list">{list.map(p => {
      const pending = p.authState === 'signing-in' || p.authState === 'verifying';
      const cooling = !!p.nextRetryAt && p.nextRetryAt > now;
      return <article className="independent-profile" key={p.id}>
        <div><strong>{privacy ? `${name} account` : p.alias || `${name} ${p.id.slice(0,4)}`}</strong><p className="small-note">{descriptions[p.authState]}</p>
          {!privacy && p.displayIdentity && <span className="verified-identity"><Check size={13}/>{p.displayIdentity}</span>}
          {p.authState==='awaiting-confirmation'&&<form onSubmit={e=>{e.preventDefault();void action({type:'companion-confirm',profile:p.id,generation:p.authorizationGeneration!,alias:aliases[p.id]??p.alias});}}>
            <p>Is this the account you intended to connect?</p>
            {p.identityConfidence==='email-only'&&<small>Reported email only; workspace identity is unavailable.</small>}
            {privacy&&<p className="notice">Turn off Privacy mode to view and confirm this identity.</p>}
            <label>Account nickname<input aria-label="Independent account nickname" maxLength={60} value={privacy?'':aliases[p.id]??p.alias} disabled={privacy} placeholder="Personal or Work" onChange={e=>setAliases({...aliases,[p.id]:e.target.value})}/></label>
            <div className="inline-actions"><button className="button button--primary" disabled={disabled||privacy||!p.displayIdentity||p.authorizationGeneration===undefined}>Confirm account</button><button type="button" className="text-button" disabled={disabled} onClick={()=>void action({type:'companion-remove',profile:p.id})}>Wrong account · discard</button></div>
          </form>}
          {p.possibleDuplicate && <p className="notice">This sign-in may match another saved connection. Choose the intended account and organization; profiles are not merged.</p>}
          {p.errorCode && !p.possibleDuplicate && <p className="small-note">{errorHelp[p.errorCode]??(p.errorCode === 'quota-unavailable' ? 'Quota unavailable; previous reading retained.' : p.errorCode === 'cancelled' ? 'Sign-in cancelled.' : p.authState==='needs-setup'?'Complete the provider’s setup prompts, then close its window. No model prompt is needed.':'Last action failed. Dated readings are retained.')}</p>}
          <small>{p.updatedAt ? `${provider==='claude'?'Last panel read':'Last reading'} ${age(p.updatedAt, now)}` : 'No quota reading yet'}{cooling && ` · Next check in ${countdown(p.nextRetryAt!, now)}`}</small>
        </div>
        <div className="inline-actions">{pending ? <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-action',action:'cancel',profile:p.id})}><X size={13}/>Cancel sign-in</button> : <>
          {p.errorCode==='setup-open'&&<button className="text-button" disabled={disabled} onClick={()=>void action({type:'companion-action',action:'cancel',profile:p.id})}>Cancel setup</button>}
          {p.authState==='needs-setup'&&<button className="button button--small" disabled={disabled||p.errorCode==='setup-open'} onClick={()=>void action({type:'companion-action',action:'setup',profile:p.id})}>Finish Claude setup</button>}
          {!['connected','duplicate','needs-setup','awaiting-confirmation'].includes(p.authState) && <button className="text-button" disabled={disabled || cooling || signingIn} onClick={() => void action({type:'companion-action',action:'reconnect',profile:p.id})}>Reconnect</button>}
          {p.authState==='duplicate'&&<button className="text-button" disabled={disabled} onClick={()=>void action({type:'companion-remove',profile:p.id})}>Discard this attempt</button>}
          {p.authState==='needs-setup'&&<button className="text-button" disabled={disabled||cooling||p.errorCode==='setup-open'} onClick={()=>void action({type:'refresh',connectionId:`companion:${p.id}`})}>Check setup</button>}
          {p.authState === 'connected' && <button className="text-button" disabled={disabled || cooling} onClick={() => void action({type:'refresh',connectionId:`companion:${p.id}`})}><RefreshCw size={13}/>Refresh</button>}
          {p.authState !== 'disconnected' && <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-action',action:'disconnect',profile:p.id})}><Unplug size={13}/>Disconnect</button>}
        </>}</div>
      </article>;
    })}</div>
    {status.enabled && <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-enable',enabled:false})}>Disconnect this browser from Desktop</button>}
  </section>;
}
