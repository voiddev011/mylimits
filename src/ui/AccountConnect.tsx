import { useState } from 'react';
import { browser } from 'wxt/browser';
import { ArrowLeft, Check, ExternalLink, Plus, RefreshCw, X } from 'lucide-react';
import { accountName, PROVIDER_IDS, type ProviderId } from '../core/model';
import { setupCandidate } from '../core/account-setup';
import { providers } from '../providers/catalog';
import type { Command, PublicStore } from '../platform/messages';
import { OpenAICompanion } from './OpenAICompanion';
import { ProviderMark } from './ProviderMark';

export const connectionNames: Record<ProviderId, string> = {
  chatgpt: 'OpenAI · ChatGPT / Codex', claude: 'Claude · Claude Code',
  cursor: 'Cursor', gemini: 'Gemini', grok: 'Grok', perplexity: 'Perplexity',
};
const order: ProviderId[] = ['chatgpt', 'claude', 'cursor', 'gemini', 'grok', 'perplexity'];

export function AccountConnect({ store, run, busy, demo, notify, onClose }: {
  store: PublicStore; run: (action: Command) => Promise<boolean>; busy: boolean; demo: boolean;
  notify: (message: string) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<ProviderId | null>(store.accountSetup?.provider ?? null);
  const [nickname, setNickname] = useState('');
  const [independent, setIndependent] = useState(false);
  const [starting, setStarting] = useState(false);
  const pending = store.accountSetup;
  const candidate = setupCandidate(store);
  const provider = pending?.provider ?? selected;
  const activity = provider === 'gemini' || (provider && store.providers[provider].readingMode === 'activity');

  async function start(mode: 'detect' | 'another') {
    if (!provider) return;
    if (demo) { notify('Exit preview to connect an account.'); return; }
    setStarting(true);
    try {
      // Keep the optional permission request in the click's user gesture.
      if (!await browser.permissions.request({ origins: [providers[provider].origin] })) {
        notify('Site access was not granted. Nothing was connected.'); return;
      }
      if (activity) {
        if (await run({ type: 'enable', provider, enabled: true })) { notify('Browser activity tracking enabled.'); onClose(); }
        return;
      }
      await run({ type: 'account-setup-start', provider, mode, nickname });
    } catch { notify('Could not start account setup. Try again.'); }
    finally { setStarting(false); }
  }
  async function save() {
    if (pending && candidate && await run({ type: 'account-setup-save', setupId: pending.id, accountId: candidate.id })) {
      notify('Account saved. Other accounts keep their own names and readings.'); onClose();
    }
  }
  const disabled = busy || starting;
  return <section className="connect-sheet" aria-label="Add an account">
    <header className="connect-heading">
      <div className="inline-actions">{provider && !pending && <button className="icon-button" aria-label="Choose a different service" onClick={() => { setSelected(null); setIndependent(false); }}><ArrowLeft size={16}/></button>}<h2>{provider ? connectionNames[provider] : 'Add an account'}</h2></div>
      <button className="icon-button" aria-label="Close account setup" onClick={onClose}><X size={16}/></button>
    </header>
    {!provider ? <><p className="connect-intro">Choose a service.</p><div className="connect-providers">{order.filter(p => PROVIDER_IDS.includes(p)).map(p => <button className="connect-provider" key={p} onClick={() => { setSelected(p); setNickname(''); }}>
      <ProviderMark provider={p}/><span><strong>{connectionNames[p]}</strong><small>{p === 'gemini' ? 'Browser activity only' : p === 'chatgpt' ? 'Work / Codex limits' : p === 'claude' ? 'Reported subscription limits' : providers[p].support === 'prototype' ? 'Account quota · prototype' : 'Browser activity only'}</small></span><Plus size={15}/>
    </button>)}</div></> : pending ? <div className="connect-steps">
      {candidate ? <><span className="setup-success"><Check size={16}/>Account detected</span><strong className="detected-name">{accountName(candidate)}</strong><p>{pending.nickname ? `Save this account as “${pending.nickname}”.` : 'Confirm this is the account you want to add.'}</p><button className="button button--primary" disabled={disabled} onClick={() => void save()}>Save detected account<Check size={14}/></button></> : <>
        <h3>{pending.mode === 'another' ? 'Sign in to your other account' : 'Detecting your current login'}</h3>
        <p>{pending.mode === 'another' ? 'Switch accounts on the website, then check again. This saves a dated reading; it does not create an independent connection.' : 'MyLimits reads the login already in this browser. If you are signed out, open the website and sign in, then check again.'}</p>
        {store.providers[pending.provider].message && <p className="notice">{store.providers[pending.provider].message}</p>}
        {pending.mode === 'another' && store.providers[pending.provider].activeAccountId === pending.previousAccountId && <p className="small-note">Still seeing the original account. It will not be renamed by this setup.</p>}
        <div className="inline-actions"><button className="button" disabled={disabled || demo} onClick={() => void browser.tabs.create({url: providers[pending.provider].home}).catch(() => notify('Could not open the website.'))}>Open {providers[pending.provider].name}<ExternalLink size={13}/></button><button className="button button--primary" disabled={disabled} onClick={() => void run({type:'refresh',provider:pending.provider})}><RefreshCw size={13}/>Check account</button></div>
        <small>Checks respect the provider’s retry wait. No password or token copying.</small>
      </>}
      <p className="connection-boundary">Website tracking updates the account currently signed in. Other accounts show their last reading until reconnected.</p>
      <button className="text-button" disabled={disabled} onClick={() => void run({type:'account-setup-cancel',setupId:pending.id})}>Cancel setup</button>
    </div> : independent ? <OpenAICompanion run={run} busy={disabled} demo={demo} notify={notify} nickname={nickname}/> : <div className="connect-steps">
      <p>{activity ? 'Count requests from this browser.' : 'Website detection uses the account currently signed in.'}</p>
      {!activity && <label>Nickname (optional)<input aria-label="New account nickname" placeholder="For example: Personal or Work" maxLength={60} disabled={store.settings.privacyMode} value={store.settings.privacyMode ? '' : nickname} onChange={e => setNickname(e.target.value)}/></label>}
      <button className="button button--primary" disabled={disabled} onClick={() => void start('detect')}><RefreshCw size={14}/>{activity ? 'Enable browser activity' : 'Detect current account'}</button>
      {!activity && <button className="button" disabled={disabled || !store.providers[provider].activeAccountId} onClick={() => void start('another')}><Plus size={14}/>Save another website account</button>}
      {!activity && !store.providers[provider].activeAccountId && <small>Detect your current account first to keep the two accounts separate.</small>}
      {provider === 'chatgpt' && __MYLIMITS_BROWSER__ !== 'firefox' && <button className="text-button independent-option" onClick={() => setIndependent(true)}>Independent OpenAI connection<ExternalLink size={12}/></button>}
      <p className="connection-boundary">{activity ? 'This service currently reports local browser activity here. Separate account quotas are unavailable.' : provider === 'claude' ? 'Uses your Claude website login. Shared Claude Code allowance depends on your plan. An independent Claude connection is not available in this build.' : provider === 'chatgpt' ? 'Website detection uses your current login. Separate OpenAI connections use the optional companion; ordinary ChatGPT model limits are separate.' : 'Uses your current website login. Independent sign-in is not available for this service in this build.'}</p>
    </div>}
  </section>;
}
