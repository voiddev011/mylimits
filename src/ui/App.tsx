import { useEffect, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { Activity, ArrowRight, Bell, BellOff, Check, ChevronDown, CircleHelp, Clock3, ExternalLink, Gauge, Layers3, LoaderCircle, Pencil, RefreshCw, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { accountName, alertThresholds, isFresh, remainingPercent, PROVIDER_IDS, type Account, type Meter, type ProviderId, type Settings } from '../core/model';
import { providers } from '../providers/catalog';
import { command, history, type Command, type PublicStore } from '../platform/messages';
import type { HistoryPoint } from '../platform/history';
import { demoState } from './demo';
import { age, countdown } from './format';
import { OpenAICompanion } from './OpenAICompanion';
import { selectAccounts, type LimitSort } from './overview';
import './styles.css';

type Page = 'overview' | 'websites' | 'alerts';
type View = 'popup' | 'sidepanel' | 'dashboard';
type Run = (action: Command) => Promise<boolean>;

function ProviderMark({ provider }: { provider: ProviderId }) {
  const letters: Record<ProviderId, string> = { claude: 'C', chatgpt: 'G', gemini: '✦', grok: 'X', perplexity: 'P' };
  return <span className="provider-mark" style={{ '--provider-color': providers[provider].color } as React.CSSProperties} aria-hidden="true">{letters[provider]}</span>;
}

function MeterView({ meter, account, settings, now }: { meter: Meter; account: Account; settings: Settings; now: number }) {
  const remaining = remainingPercent(meter);
  const fresh = isFresh(account, meter, now, settings.refreshMinutes);
  const { warning, critical } = alertThresholds(account, settings);
  const level = !fresh ? 'stale' : remaining !== null && remaining <= critical ? 'critical' : remaining !== null && remaining <= warning ? 'warning' : 'healthy';
  return <div className={`meter meter--${level}`}>
    <div className="meter-heading"><span>{meter.label}</span><span className={`evidence evidence--${meter.evidence}`}>{meter.evidence === 'reported' ? 'Reported' : 'Observed'}</span></div>
    {remaining !== null ? <>
      <div className="meter-value"><strong>{Math.round(remaining)}<span>%</span></strong><span>{fresh ? 'left' : 'left at last reading'}</span></div>
      <div className="meter-track" role="progressbar" aria-label={`${meter.label}, percent remaining${fresh ? '' : ' at last reading'}`} aria-valuenow={Math.round(remaining)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${remaining}%` }} /></div>
    </> : <div className="observed-value"><strong>{meter.resetsAt !== null && meter.resetsAt <= now ? 0 : meter.used ?? '—'}</strong><span>{meter.unit} observed</span></div>}
    <div className="meter-footer"><Clock3 size={12} /><span>{meter.resetsAt !== null && meter.resetsAt > now ? `Resets in ${countdown(meter.resetsAt, now)}` : countdown(meter.resetsAt, now)}</span></div>
    {meter.evidence === 'observed' && <p className="small-note">This browser only. Remaining account quota is unknown.</p>}
  </div>;
}

function AccountCard({ account, settings, now, run, demo, busy }: { account: Account; settings: Settings; now: number; run: Run; demo: boolean; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [alias, setAlias] = useState(account.alias || account.defaultName);
  const [options, setOptions] = useState(false);
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const active = account.connection === 'active';
  async function rename(event: FormEvent) {
    event.preventDefault();
    if (await run({ type: 'rename', accountId: account.id, alias: alias.trim() })) setEditing(false);
  }
  async function loadHistory() {
    if (points) { setPoints(null); return; }
    if (demo) { setHistoryError('History is available for real readings; this is sample data.'); return; }
    try { setPoints(await history(account.id)); setHistoryError(''); }
    catch (error) { setHistoryError(error instanceof Error ? error.message : 'History could not be loaded.'); }
  }
  return <article className={`account-card ${active ? '' : 'account-card--saved'}`}>
    <div className="account-heading">
      <ProviderMark provider={account.provider} />
      <div className="account-title">
        {editing ? <form className="rename-form" onSubmit={rename}><label className="sr-only" htmlFor={`alias-${account.id}`}>Account nickname</label><input id={`alias-${account.id}`} maxLength={60} value={alias} onChange={event => setAlias(event.target.value)} autoFocus /><button className="icon-button" type="submit" aria-label="Save nickname" disabled={busy}><Check size={16} /></button><button className="icon-button" type="button" aria-label="Cancel rename" onClick={() => setEditing(false)}><X size={16} /></button></form> : <div className="name-line"><h3>{accountName(account)}</h3><button className="icon-button subtle" aria-label={`Rename ${accountName(account)}`} onClick={() => { setAlias(accountName(account)); setEditing(true); }}><Pencil size={13} /></button></div>}
        <div className="account-subtitle">{providers[account.provider].name}{account.plan ? ` · ${account.plan}` : ''}{account.kind === 'browser' ? ' · browser activity' : ''}</div>
      </div>
      <button className={`icon-button ${options ? 'selected' : ''}`} aria-label={`Settings for ${accountName(account)}`} aria-expanded={options} onClick={() => setOptions(!options)}><Settings2 size={16} /></button>
    </div>
    <div className={`connection-label ${active ? 'connection-label--active' : ''}`}><span className="status-dot" />{account.kind === 'browser' ? 'Local activity · not account-scoped' : account.companionProfile ? (active ? 'Companion connection · independent of website login' : 'Companion · reconnect or check local service') : active ? 'Current website account' : account.connection === 'inactive' ? 'Saved account · not currently signed in' : account.connection === 'signed-out' ? 'Website sign-in needed' : 'Last reading · refresh unavailable'}</div>
    {options && <div className="account-options">
      {account.kind === 'account' && <>
        <label className="field-inline">Warn at <select aria-label={`Alert threshold for ${accountName(account)}`} value={account.alertRemaining ?? ''} disabled={busy} onChange={event => void run({ type: 'account-settings', accountId: account.id, alertRemaining: event.target.value ? Number(event.target.value) : null, alertsMuted: account.alertsMuted })}><option value="">Default ({settings.warningRemaining}% left)</option>{[5, 10, 15, 20, 25, 30, 50].map(value => <option key={value} value={value}>{value}% left</option>)}</select></label>
        <button className="text-button" disabled={busy} onClick={() => void run({ type: 'account-settings', accountId: account.id, alertRemaining: account.alertRemaining, alertsMuted: !account.alertsMuted })}>{account.alertsMuted ? <Bell size={14} /> : <BellOff size={14} />}{account.alertsMuted ? 'Unmute desktop alerts' : 'Mute desktop alerts'}</button>
      </>}
      <button className="text-button danger" disabled={busy} onClick={() => { if (confirm(`${account.companionProfile ? 'Disconnect' : 'Forget'} ${accountName(account)} and remove its local history?${account.companionProfile ? ' This ends its companion connection.' : active ? ' Tracking for this website will also turn off.' : ''}`)) void run({ type: 'forget', accountId: account.id }); }}><Trash2 size={14} />{account.companionProfile ? 'Disconnect' : 'Forget saved'} {account.kind === 'browser' ? 'activity' : 'account'}</button>
    </div>}
    {account.meters.length ? <div className="meter-list">{account.meters.map(meter => <MeterView key={meter.id} meter={meter} account={account} settings={settings} now={now} />)}</div> : <div className="no-reading"><CircleHelp size={18} /><p>{account.kind === 'browser' ? 'Activity will appear after a recognised request on this website. Account quotas are not available yet.' : 'This account has not exposed a usage reading. Its remaining allowance is unknown.'}</p></div>}
    {account.provider === 'chatgpt' && <p className="scope-note">These readings cover Work / Codex. Ordinary chat limits are separate.</p>}
    <footer className="account-footer"><span>Updated {age(account.updatedAt, now)}</span><button className="text-button" onClick={() => void loadHistory()}>History<ChevronDown size={12} /></button></footer>
    {historyError && <p className="small-note">{historyError}</p>}
    {points !== null && <div className="history-list"><p className="small-note">Latest reported readings, newest first.</p>{points.length ? [...points].reverse().slice(0, 8).map((point, index) => <div className="history-row" key={`${point.time}-${index}`}><time>{new Date(point.time).toLocaleString()}</time><span>{point.meters.filter(meter => meter.usedPercent !== null).map(meter => `${Math.round(100 - Math.min(100, meter.usedPercent!))}% left`).join(' · ') || 'No percentage reported'}</span></div>) : <p className="small-note">History starts with your first successful quota reading.</p>}</div>}
  </article>;
}

function Websites({ store, run, busy, demo, notify }: { store: PublicStore; run: Run; busy: boolean; demo: boolean; notify: (message: string) => void }) {
  async function toggle(provider: ProviderId) {
    if (demo) { notify('Sample mode cannot request website access. Exit the preview to enable tracking.'); return; }
    const enabled = !store.providers[provider].enabled;
    if (enabled) {
      const granted = await browser.permissions.request({ origins: [providers[provider].origin] });
      if (!granted) { notify('Chrome site access was not granted. Nothing was connected.'); return; }
    }
    await run({ type: 'enable', provider, enabled });
  }
  return <div className="website-list"><OpenAICompanion run={run} busy={busy} demo={demo} notify={notify} />{PROVIDER_IDS.map(provider => {
    const definition = providers[provider];
    const state = store.providers[provider];
    return <article className="website-card" key={provider}><div className="website-top"><ProviderMark provider={provider} /><div><h3>{definition.name}</h3><span className="small-note">{definition.support === 'prototype' ? 'Account readings · prototype' : 'Browser activity only'}</span></div><button className={`switch ${state.enabled ? 'switch--on' : ''}`} role="switch" aria-checked={state.enabled} aria-label={`Track ${definition.name}`} disabled={busy} onClick={() => void toggle(provider).catch(error => notify(error instanceof Error ? error.message : 'Could not change website access.'))}><span /></button></div><p>{definition.detail}</p>{state.message && state.enabled && <div className="provider-message">{state.message}</div>}<div className="website-bottom"><a className="text-button" href={definition.home} target="_blank" rel="noreferrer">Open website<ExternalLink size={12} /></a>{state.enabled && <button className="text-button" disabled={busy} onClick={() => void run({ type: 'refresh', provider })}><RefreshCw size={12} />Refresh</button>}</div></article>;
  })}<div className="info-panel"><ShieldCheck size={20} /><div><strong>Your existing login, your browser.</strong><p>Allow access once for each website you choose. MyLimits reads supported usage information without opening a separate login window. Turning a website off removes its site access.</p></div></div></div>;
}

function Alerts({ store, run, busy, demo, notify }: { store: PublicStore; run: Run; busy: boolean; demo: boolean; notify: (message: string) => void }) {
  const [draft, setDraft] = useState(store.settings);
  useEffect(() => setDraft(store.settings), [store.settings.warningRemaining, store.settings.criticalRemaining, store.settings.refreshMinutes, store.settings.theme, store.settings.desktopAlerts]);
  async function toggleDesktop() {
    if (demo) { notify('Sample mode does not request notification access.'); return; }
    const enabled = !store.settings.desktopAlerts;
    if (enabled && !await browser.permissions.request({ permissions: ['notifications'] })) { notify('Chrome notification access was not granted.'); return; }
    const saved = await run({ type: 'settings', settings: { ...store.settings, desktopAlerts: enabled } });
    if (saved && !enabled) await browser.permissions.remove({ permissions: ['notifications'] });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (await run({ type: 'settings', settings: { ...draft, desktopAlerts: store.settings.desktopAlerts } })) notify('Alert preferences saved.');
  }
  return <div className="settings-panel"><div className="setting-row"><div className="setting-icon"><Bell size={20} /></div><div className="setting-description"><h3>Desktop alerts</h3><p>A quiet reminder when a reported allowance is running low.</p></div><button className={`switch ${store.settings.desktopAlerts ? 'switch--on' : ''}`} role="switch" aria-checked={store.settings.desktopAlerts} aria-label="Enable desktop alerts" disabled={busy} onClick={() => void toggleDesktop().catch(error => notify(error instanceof Error ? error.message : 'Could not change notifications.'))}><span /></button></div><form onSubmit={event => void save(event).catch(error => notify(error instanceof Error ? error.message : 'Preferences could not be saved.'))}><div className="settings-fields"><label>Early warning<span className="input-suffix"><input type="number" min={1} max={95} required value={draft.warningRemaining} onChange={event => setDraft({ ...draft, warningRemaining: Number(event.target.value) })} /><span>% left</span></span></label><label>Critical warning<span className="input-suffix"><input type="number" min={1} max={draft.warningRemaining} required value={draft.criticalRemaining} onChange={event => setDraft({ ...draft, criticalRemaining: Number(event.target.value) })} /><span>% left</span></span></label><label>Refresh interval<select value={draft.refreshMinutes} onChange={event => setDraft({ ...draft, refreshMinutes: Number(event.target.value) })}>{[2, 5, 10, 15, 30, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><label>Appearance<select value={draft.theme} onChange={event => setDraft({ ...draft, theme: event.target.value as Settings['theme'] })}><option value="system">Follow device</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><button className="button button--primary" disabled={busy} type="submit">Save preferences<Check size={15} /></button></form><p className="small-note settings-note">Visual warnings always appear in the dashboard. Desktop alerts use fresh, reported quotas and fire once per threshold in each reset window. Browser activity counts cannot tell us when an account is running low.</p></div>;
}

export function App({ view = 'dashboard' }: { view?: View }) {
  const [store, setStore] = useState<PublicStore | null>(null);
  const [demo, setDemo] = useState(location.hash === '#demo');
  const [page, setPage] = useState<Page>('overview');
  const [filter, setFilter] = useState<ProviderId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState<LimitSort>('default');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(Date.now());
  const [windowId, setWindowId] = useState<number | undefined>();
  useEffect(() => {
    if (demo) { setStore(demoState()); setError(''); return; }
    const load = () => void command({ type: 'state' }).then(setStore, reason => setError(reason instanceof Error ? reason.message : 'Could not load MyLimits.'));
    load();
    const listener = () => load();
    browser.storage.onChanged.addListener(listener);
    void browser.windows.getCurrent().then(window => setWindowId(window.id));
    return () => browser.storage.onChanged.removeListener(listener);
  }, [demo]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = store?.settings.theme ?? 'system';
  }, [store?.settings.theme]);

  async function run(action: Command) {
    if (demo) {
      if (action.type === 'rename') setStore(current => current ? { ...current, accounts: current.accounts.map(account => account.id === action.accountId ? { ...account, alias: action.alias } : account) } : current);
      else if (action.type === 'account-settings') setStore(current => current ? { ...current, accounts: current.accounts.map(account => account.id === action.accountId ? { ...account, alertRemaining: action.alertRemaining, alertsMuted: action.alertsMuted } : account) } : current);
      else if (action.type === 'settings') setStore(current => current ? { ...current, settings: action.settings } : current);
      else if (action.type === 'forget') setStore(current => current ? { ...current, accounts: current.accounts.filter(account => account.id !== action.accountId) } : current);
      else setToast('This is a preview with sample readings.');
      return true;
    }
    setBusy(true); setError('');
    try { setStore(await command(action)); return true; }
    catch (reason) { const message = reason instanceof Error ? reason.message : 'Action could not be completed.'; setError(message); return false; }
    finally { setBusy(false); }
  }
  const safeRun: Run = run;
  const accounts = store?.accounts.filter(account => account.kind === 'account') ?? [];
  const current = accounts.filter(account => account.connection === 'active');
  const low = current.filter(account => account.meters.some(meter => meter.evidence === 'reported' && isFresh(account, meter, now, store!.settings.refreshMinutes) && remainingPercent(meter) !== null && remainingPercent(meter)! <= (account.alertRemaining ?? store!.settings.warningRemaining)));
  const resetTimes = current.flatMap(account => account.meters.filter(meter => isFresh(account, meter, now, store!.settings.refreshMinutes) && meter.resetsAt !== null).map(meter => meter.resetsAt!));
  const visible = store ? selectAccounts(store.accounts.filter(account => filter === 'all' || account.provider === filter), store.settings, now, query, lowOnly, sort) : [];
  const quotas = visible.filter(account => account.kind === 'account');
  const browserActivity = visible.filter(account => account.kind === 'browser');
  const messages = store ? PROVIDER_IDS.filter(provider => store.providers[provider].enabled && store.providers[provider].message && providers[provider].support === 'prototype') : [];

  return <div className={`app app--${view} ${page === 'overview' ? 'app--compact' : ''}`}>
    <header className="app-header"><a className="brand" href="#" onClick={event => { event.preventDefault(); setPage('overview'); }}><span className="brand-mark"><Gauge size={23} strokeWidth={1.7} /></span><span>MyLimits<span className="brand-caption">A little more headroom.</span></span></a><div className="header-actions">{view === 'popup' && windowId !== undefined && <button className="icon-button" aria-label="Open side panel" onClick={() => void browser.sidePanel.open({ windowId }).catch(() => setToast('Open the full dashboard using the link below.'))}><Layers3 size={17} /></button>}<button className="icon-button" aria-label="Refresh all websites" disabled={busy || !store} onClick={() => void safeRun({ type: 'refresh' })}><RefreshCw size={17} className={busy ? 'spin' : ''} /></button></div></header>
    {demo && <div className="demo-banner"><span>Preview · sample accounts and readings</span><button onClick={() => { location.hash = ''; setDemo(false); setStore(null); }} aria-label="Exit sample preview"><X size={14} /></button></div>}
    <nav className="nav-tabs" aria-label="MyLimits pages">{([{ id: 'overview', label: 'Overview', icon: Gauge }, { id: 'websites', label: 'Websites', icon: Layers3 }, { id: 'alerts', label: 'Preferences', icon: Bell }] as const).map(item => <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><item.icon size={15} />{item.label}</button>)}</nav>
    <main>
      {page !== 'overview' && <div className="page-heading"><span className="eyebrow">{page === 'websites' ? 'MAKE YOURSELF AT HOME' : 'A HEADS-UP, YOUR WAY'}</span><h1>{page === 'websites' ? 'Your websites.' : 'Stay ahead of limits.'}</h1><p>{page === 'websites' ? 'Choose what to track. Your existing website login does the rest.' : 'Set the reminders that fit the way you work.'}</p></div>}
      {error && <div className="error-panel" role="alert">{error}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      {!store ? <div className="loading-state"><LoaderCircle className="spin" size={24} /><p>{error ? 'The extension is not responding.' : 'Getting your local dashboard ready…'}</p>{error && <button className="button" onClick={() => { setDemo(true); setError(''); }}>Preview with sample data</button>}</div> : page === 'websites' ? <Websites store={store} run={run} busy={busy} demo={demo} notify={setToast} /> : page === 'alerts' ? <Alerts store={store} run={run} busy={busy} demo={demo} notify={setToast} /> : <>
        <div className="summary-grid"><div><Layers3 size={16} /><strong>{accounts.length}</strong><span>accounts</span></div><div className={low.length ? 'summary-warning' : ''}><Activity size={16} /><strong>{low.length}</strong><span>running low</span></div><div><Clock3 size={16} /><strong className="reset-stat">{resetTimes.length ? countdown(Math.min(...resetTimes), now) : '—'}</strong><span>next reset</span></div></div>
        {store.accounts.length > 0 && <>
          <div className="limit-tools">
            <input type="search" aria-label="Search accounts and limits" placeholder="Find account or limit…" value={query} onChange={event => setQuery(event.target.value)} />
            <select aria-label="Sort limits" value={sort} onChange={event => setSort(event.target.value as LimitSort)}><option value="default">Current first</option><option value="remaining">Lowest left</option><option value="reset">Next reset</option><option value="name">Name</option></select>
          </div>
          <div className="limit-filters"><select aria-label="Filter by website" value={filter} onChange={event => setFilter(event.target.value as ProviderId | 'all')}><option value="all">All websites</option>{PROVIDER_IDS.filter(provider => store.accounts.some(account => account.provider === provider)).map(provider => <option key={provider} value={provider}>{providers[provider].name}</option>)}</select><button className={lowOnly ? 'active' : ''} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}><Bell size={12} />Low only</button><span>{quotas.reduce((count, account) => count + account.meters.length, 0)} limits</span></div>
          <div className="compact-accounts" aria-label="Account limits">{quotas.map(account => <article className="compact-account" key={account.id}>
            <button className="compact-account-heading" aria-label={`Details for ${accountName(account)}`} aria-expanded={expanded === account.id} onClick={() => setExpanded(expanded === account.id ? null : account.id)}><ProviderMark provider={account.provider} /><strong>{accountName(account)}</strong><span>{account.companionProfile ? (account.connection === 'active' ? 'Companion' : 'Offline') : account.connection === 'active' ? 'Current' : 'Saved'}</span><ChevronDown size={14} /></button>
            <div className="compact-meters">{account.meters.map(meter => {
              const remaining = remainingPercent(meter);
              const fresh = isFresh(account, meter, now, store.settings.refreshMinutes);
              const { warning, critical } = alertThresholds(account, store.settings);
              const level = !fresh ? 'stale' : remaining !== null && remaining <= critical ? 'critical' : remaining !== null && remaining <= warning ? 'warning' : 'healthy';
              return <div key={meter.id} className={`compact-meter meter--${level}`}><div><span className="compact-meter-label" title={meter.label}>{meter.label}</span><strong>{remaining === null ? 'Unknown' : `${Math.round(remaining)}%`}<small>{remaining === null ? '' : ' left'}</small></strong></div>{remaining !== null && <div className="meter-track" role="progressbar" aria-label={`${accountName(account)}: ${meter.label}, percent remaining${fresh ? '' : ' at last reading'}`} aria-valuenow={Math.round(remaining)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${remaining}%` }} /></div>}<div className="compact-meter-meta"><span>{fresh ? 'Reported' : `Last reading · ${age(account.updatedAt, now)}`}</span><span>{meter.resetsAt !== null && meter.resetsAt > now ? `Reset ${countdown(meter.resetsAt, now)}` : countdown(meter.resetsAt, now)}</span></div></div>;
            })}{account.meters.length === 0 && <p className="small-note">Remaining allowance unknown. Expand for details.</p>}</div>
          </article>)}</div>
          {quotas.some(account => account.provider === 'chatgpt') && <p className="compact-note">ChatGPT readings cover Work / Codex. Saved readings may be out of date.</p>}
          {expanded && visible.some(account => account.id === expanded) && <div className="expanded-account"><div className="section-line"><h2>Account details</h2><button className="text-button" onClick={() => setExpanded(null)}>Close<X size={13} /></button></div><AccountCard key={expanded} account={visible.find(account => account.id === expanded)!} settings={store.settings} now={now} run={safeRun} demo={demo} busy={busy} /></div>}
          {browserActivity.length > 0 && <details className="activity-details"><summary>Browser activity · {browserActivity.length} websites · quotas unknown</summary><div className="account-grid">{browserActivity.map(account => <AccountCard key={account.id} account={account} settings={store.settings} now={now} run={safeRun} demo={demo} busy={busy} />)}</div></details>}
        </>}
        {messages.length > 0 && <details className="activity-details"><summary>Website status · {messages.length} need attention</summary>{messages.map(provider => <div className="provider-message overview-message" key={provider}><ProviderMark provider={provider} /><div><strong>{providers[provider].name}</strong><p>{store.providers[provider].message}</p></div><button className="text-button" disabled={busy} onClick={() => void safeRun({ type: 'refresh', provider })}>Retry</button></div>)}</details>}
        {store.accounts.length === 0 && <div className="empty-state"><div className="empty-illustration"><Gauge size={48} strokeWidth={1.3} /><span className="empty-dot dot-a" /><span className="empty-dot dot-b" /><span className="empty-dot dot-c" /></div><h2>A clear view starts here.</h2><p>Add the websites you use. MyLimits will reuse their existing browser logins and show the usage information they make available.</p><button className="button button--primary" onClick={() => setPage('websites')}>Choose your websites<ArrowRight size={16} /></button><button className="text-button preview-link" onClick={() => { setDemo(true); location.hash = 'demo'; }}>Preview with sample data</button></div>}
        {visible.length === 0 && store.accounts.length > 0 && <p className="small-note">No matching readings. Try clearing search or turning off Low only.</p>}
        {store.accounts.length > 0 && <button className="add-website" onClick={() => setPage('websites')}><Layers3 size={17} /><span>Manage websites</span><ArrowRight size={15} /></button>}
      </>}
    </main>
    <footer className="app-footer"><span><ShieldCheck size={13} />Stored on this device</span>{view !== 'dashboard' ? <a href={browser.runtime.getURL('/dashboard.html')} target="_blank" rel="noreferrer">Full dashboard<ExternalLink size={12} /></a> : <span>MyLimits v0.1.0</span>}</footer>
    {toast && <div className="toast" role="status">{toast}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>;
}
