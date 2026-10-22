import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Check, ExternalLink, Plus, RefreshCw, Unplug, X } from 'lucide-react';
import { command, type Command } from '../platform/messages';
import type { companionStatus } from '../platform/companion';
import { age, countdown } from './format';

type Status = Awaited<ReturnType<typeof companionStatus>>;
const initial: Status = { enabled: false, connected: false, compatible: false, capabilities: null, profiles: [], issue: null };
const descriptions: Record<string,string> = {
  'signing-in': 'Finish sign-in in the separate browser window', verifying: 'Verifying account',
  connected: 'Account verified', 'needs-sign-in': 'Needs sign-in', 'needs-setup':'Finish first-party Claude setup', duplicate: 'Same email as another connection',
  disconnected: 'Disconnected · last reading retained', unavailable: 'Check connection',
};
const errorHelp:Record<string,string>={
 'unsupported-cli':'Update official Claude Code to version 2.1.301 or later.',
 'missing-browser-router':'Update or reinstall the helper to create its separate sign-in launcher.',
 'browser-route-unconfirmed':'A separate sign-in browser was not confirmed. Update the helper and retry.',
 'terminal-stop-unconfirmed':'Restart the helper before trying another operation.',
 'missing-setup-terminal':'Linux first-party setup needs xterm. Windows setup includes its terminal launcher.',
};
export function OpenAICompanion({ run, busy, demo, notify, nickname = '', provider = 'openai', privacy = false }: {
  run: (action: Command) => Promise<boolean>; busy: boolean; demo: boolean; notify: (message: string) => void; nickname?: string;
  provider?: 'openai'|'claude'; privacy?: boolean;
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [working, setWorking] = useState(false);
  const [issue, setIssue] = useState('');
  const [now, setNow] = useState(Date.now());
  async function check() {
    if (demo) return;
    try { setStatus(await command<Status>({ type: 'companion-status' })); setIssue(''); }
    catch { setIssue('Could not reach the helper. Install or restart it, then retry.'); }
  }
  useEffect(() => {
    let mounted = true, polling = false;
    const update = async () => {
      if (demo || polling) return; polling = true;
      try { const value = await command<Status>({ type: 'companion-status' }); if (mounted) { setStatus(value); setIssue(''); setNow(Date.now()); } }
      catch { if (mounted) setIssue('Could not reach the helper. Retry its connection.'); }
      finally { polling = false; }
    };
    void update(); const timer = setInterval(() => void update(), 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [demo]);
  async function enable() {
    if (demo) { notify('Exit preview to connect an account.'); return; }
    const granted = await browser.permissions.request({ permissions: ['nativeMessaging'] });
    if (!granted) { notify('Helper access was not granted.'); return; }
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
  return <section className="independent-accounts" aria-label="Independent account connections">
    <div className="section-heading"><h3>Independent {name} accounts</h3><p>{provider==='claude'?'Subscription limits · official Claude Code':'Codex quotas · separate sign-in for each account'}</p></div>
    <div className="connection-readiness" role="status">{demo ? 'Sample mode' : status.compatible ? 'Helper ready · live provider verification pending' : status.enabled ? status.issue ?? 'Helper unavailable or needs an update' : 'Install the local helper once to connect independent accounts.'}</div>
    {issue && <p role="alert">{issue}</p>}
    {status.compatible&&!supported&&<p className="notice">{status.capabilities?.providers.find(p=>p.provider===provider)?.reason??'Update the helper for this provider.'}</p>}
    <div className="inline-actions">
      {!status.compatible ? <button className="button button--primary" disabled={disabled} onClick={() => void enable().catch(() => notify('Could not enable the helper. Check its installation.'))}><RefreshCw size={14}/>{status.enabled ? 'Retry helper' : 'Enable helper connection'}</button> : <button className="button button--primary" disabled={disabled || !supported} onClick={() => void action({ type: 'companion-add', provider, nickname }).catch(() => notify('Could not start sign-in. Check the helper.'))}><Plus size={14}/>Sign in to {name}</button>}
      <a className="text-button" href="https://github.com/voiddev011/mylimits/blob/docs/desktop-accounts-execution-plan/docs/OPENAI-COMPANION.md" target="_blank" rel="noreferrer">Install / update helper<ExternalLink size={12}/></a>
    </div>
    <p className="small-note">{provider==='claude'?'Experimental CLI adapter. Sign-in uses a separate browser profile. First use may require completing official Claude Code setup once. Panel readings and cross-device freshness need your account acceptance.':'A separate sign-in browser opens. Your normal ChatGPT tab is not used. Ordinary ChatGPT message, image and voice limits are not covered by this connection.'}</p>
    <div className="independent-list">{list.map(p => {
      const pending = p.authState === 'signing-in' || p.authState === 'verifying';
      const cooling = !!p.nextRetryAt && p.nextRetryAt > now;
      return <article className="independent-profile" key={p.id}>
        <div><strong>{privacy ? `${name} account` : p.alias || `${name} ${p.id.slice(0,4)}`}</strong><p className="small-note">{descriptions[p.authState]}</p>
          {!privacy && p.displayIdentity && <span className="verified-identity"><Check size={13}/>{p.displayIdentity}</span>}
          {p.possibleDuplicate && <p className="notice">This sign-in may match another saved connection. Choose the intended account and organization; profiles are not merged.</p>}
          {p.errorCode && !p.possibleDuplicate && <p className="small-note">{errorHelp[p.errorCode]??(p.errorCode === 'quota-unavailable' ? 'Quota unavailable; previous reading retained.' : p.errorCode === 'cancelled' ? 'Sign-in cancelled.' : p.authState==='needs-setup'?'Complete the provider’s setup prompts, then close its window. No model prompt is needed.':'Last action failed. Dated readings are retained.')}</p>}
          <small>{p.updatedAt ? `${provider==='claude'?'Last panel read':'Last reading'} ${age(p.updatedAt, now)}` : 'No quota reading yet'}{cooling && ` · Next check in ${countdown(p.nextRetryAt!, now)}`}</small>
        </div>
        <div className="inline-actions">{pending ? <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-action',action:'cancel',profile:p.id})}><X size={13}/>Cancel sign-in</button> : <>
          {p.errorCode==='setup-open'&&<button className="text-button" disabled={disabled} onClick={()=>void action({type:'companion-action',action:'cancel',profile:p.id})}>Cancel setup</button>}
          {p.authState==='needs-setup'&&<button className="button button--small" disabled={disabled||p.errorCode==='setup-open'} onClick={()=>void action({type:'companion-action',action:'setup',profile:p.id})}>Finish Claude setup</button>}
          {!['connected','duplicate','needs-setup'].includes(p.authState) && <button className="text-button" disabled={disabled || cooling} onClick={() => void action({type:'companion-action',action:'reconnect',profile:p.id})}>Reconnect</button>}
          {p.authState==='needs-setup'&&<button className="text-button" disabled={disabled||cooling||p.errorCode==='setup-open'} onClick={()=>void action({type:'refresh',connectionId:`companion:${p.id}`})}>Check setup</button>}
          {p.authState === 'connected' && <button className="text-button" disabled={disabled || cooling} onClick={() => void action({type:'refresh',connectionId:`companion:${p.id}`})}><RefreshCw size={13}/>Refresh</button>}
          {p.authState !== 'disconnected' && <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-action',action:'disconnect',profile:p.id})}><Unplug size={13}/>Disconnect</button>}
        </>}</div>
      </article>;
    })}</div>
    {status.enabled && <button className="text-button" disabled={disabled} onClick={() => void action({type:'companion-enable',enabled:false})}>Pause extension sync</button>}
  </section>;
}
