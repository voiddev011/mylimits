import { browser } from 'wxt/browser';
import { PROVIDER_IDS, type ProviderId } from '../core/model';
import { AccountSchema, MeterSchema, SettingsSchema } from '../core/schema';
import { accountId, applySnapshot, badge, collectAlerts, markProvider, recordObservation } from '../core/engine';
import { providers, providerForUrl } from '../providers/catalog';
import { AdapterError, readProvider } from '../providers/adapters';
import { enableWebsite, setWorkspace, accountPreferences, orderAccounts, forgetAccount } from '../core/actions';
import { RefreshCoordinator, shouldRefresh, nextRetry, type RefreshReason } from '../core/scheduler';
import { changeConnection } from '../core/connections';
import { analyzeHistory } from '../core/insights';
import { historyPoint, exportReadings } from '../core/history-data';
import { readStore, publicStore, updateStore, forgetLegacyAccount } from './repository';
import { readHistory, readHistoryPage, readHistorySeries, pruneHistory, historyExport, clearHistory, removeHistory, saveHistory } from './history';
import { CommandSchema, type Command } from './messages';
import { mergeCompanion, markCompanionUnavailable } from '../core/companion';
import { addCompanionAccount, companionRequest, companionStatus, enableCompanion, listenCompanion, refreshCompanion } from './companion';
import { widgetSettings,updateWidgetSettings,reconcileWidgets,readWidget,listenWidgets } from './widget';
import { snapshotSync } from './sync';

const coordinator = new RefreshCoordinator(2);
const observedProviders: readonly ProviderId[] = ['gemini', 'grok', 'perplexity'];
const REFRESH_ALARM = 'mylimits:refresh';
const COMPANION_ALARM = 'mylimits:companion';
const SYNC_ALARM='mylimits:sync';

async function renderBadge(): Promise<void> {
  const value = badge(await readStore(), Date.now());
  await browser.action.setBadgeText({ text: value.text });
  await browser.action.setBadgeBackgroundColor({ color: value.color });
  await browser.action.setTitle({ title: value.text ? `MyLimits · ${value.text} ${(await readStore()).settings.displayMode === 'used' ? 'used' : 'left'} in the most constrained reported allowance` : 'MyLimits · your usage, in one place' });
}

async function sendAlerts(): Promise<void> {
  if (!await browser.permissions.contains({ permissions: ['notifications'] })) return;
  // Serialize the decision and delivery, so overlapping refreshes cannot alert twice.
  await updateStore(async store => {
    const result = collectAlerts(store, Date.now());
    const failed: typeof result.alerts = [];
    for (const alert of result.alerts) {
      try {
        await browser.notifications.create(alert.id, {
          type: 'basic', iconUrl: browser.runtime.getURL('/icon/128.png'), title: alert.title, message: alert.message,
        });
      } catch { failed.push(alert); }
    }
    // Failed deliveries can retry next refresh; a failure must not silently consume an alert.
    for (const alert of failed) {
      const key = alert.ledgerKey;
      if (alert.kind === 'reset') { if(store.resetLedger[key])result.store.resetLedger[key]=store.resetLedger[key]!;else delete result.store.resetLedger[key]; }
      else { if(store.alertLedger[key])result.store.alertLedger[key]=store.alertLedger[key]!;else delete result.store.alertLedger[key]; }
    }
    return { store: result.store, value: undefined };
  });
}

async function saveAcceptedHistory(accountId: string, connectionId: string): Promise<void> {
  await updateStore(async store => {
    const connection=store.connections.find(c=>c.id===connectionId&&c.accountId===accountId&&c.enabled);
    if(!connection)return {store,value:undefined};
    const snapshot=store.snapshots.filter(s=>s.accountId===accountId&&s.connectionId===connectionId&&s.workspaceId===connection.workspaceId).sort((a,b)=>b.observedAt-a.observedAt)[0];
    if(!snapshot)return {store,value:undefined};
    try { await saveHistory(historyPoint(snapshot),store.settings.historyRetentionDays??30); return {store:store.historyIssue?{...store,historyIssue:null}:store,value:undefined}; }
    catch { return {store:{...store,historyIssue:'A reading was updated, but local history could not be saved.'},value:undefined}; }
  });
}

export async function refreshProvider(provider: ProviderId, manual = false, reason: RefreshReason = manual ? 'manual' : 'scheduled'): Promise<void> {
  const connectionId = `website:${provider}`;
  return coordinator.run(connectionId, async signal => {
    const before = await readStore();
    const connection = before.connections.find(c => c.id === connectionId);
    if (!connection || !shouldRefresh(connection, reason, Date.now(), before.settings.refreshMinutes)) return;
    if (!await browser.permissions.contains({ origins: [providers[provider].origin] })) { await setProvider(provider, false); return; }
    const stamp = connection.generation;
    await updateStore(store => ({ store: { ...store, connections: store.connections.map(c => c.id === connectionId && c.generation === stamp ? { ...c, status:'checking',lastAttemptAt:Date.now() } : c),
      providers: { ...store.providers, [provider]: { ...store.providers[provider], status:'checking',checkedAt:Date.now() } } }, value:undefined }));
    try {
      const selected = before.workspaces.find(w => w.id === connection.workspaceId);
      const snapshot = await readProvider(provider, { workspaceRemoteId: selected?.remoteId,readingMode:before.providers[provider].readingMode }, signal);
      const meters = snapshot.meters.map(m => MeterSchema.parse(m));
      const id = await accountId(provider, snapshot.identity, before.installSalt);
      const choices = await Promise.all((snapshot.workspaces ?? []).map(async w => ({ id:await accountId(provider,`workspace:${w.identity}`,before.installSalt),provider,remoteId:w.identity,name:w.name })));
      const workspaceId = choices.find(w => w.remoteId === snapshot.workspace?.identity)?.id ?? null;
      const accepted = await updateStore(store => {
        const current=store.connections.find(c=>c.id===connectionId);
        if(!current?.enabled || current.generation!==stamp || signal.aborted)return {store,value:false};
        const enriched={...store,workspaces:[...store.workspaces.filter(w=>!choices.some(n=>n.id===w.id)),...choices],connections:store.connections.map(c=>c.id===connectionId?{...c,workspaceIds:choices.map(w=>w.id)}:c)};
        const next=applySnapshot(enriched,provider,id,{...snapshot,meters},Date.now(),{workspaceId,generation:stamp});
        AccountSchema.parse(next.accounts.find(a=>a.id===id));return {store:next,value:true};
      });
      if(accepted&&meters.length)await saveAcceptedHistory(id, connectionId);
    } catch(error) {
      if(signal.aborted)return;
      const status=error instanceof AdapterError?error.status:'error';
      const message=error instanceof AdapterError?error.message:'The website returned information MyLimits could not verify.';
      await updateStore(store=>{
        const current=store.connections.find(c=>c.id===connectionId);
        if(!current?.enabled||current.generation!==stamp)return {store,value:undefined};
        const next=markProvider(store,provider,status,message,Date.now());
        const retry=nextRetry(Date.now(),current.failures+1,store.settings.refreshMinutes,error instanceof AdapterError?error.retryAt:null);
        next.connections=next.connections.map(c=>c.id===connectionId?{...c,lastAttemptAt:Date.now(),failures:current.failures+1,nextRetryAt:retry}:c);
        next.providers[provider].failures=current.failures+1;next.providers[provider].nextRetryAt=retry;
        return {store:next,value:undefined};
      });
    }
    await renderBadge();await sendAlerts();
  });
}

async function refreshAll(manual = false, reason: RefreshReason = manual ? 'manual' : 'scheduled'): Promise<void> {
  const results = await Promise.allSettled([...PROVIDER_IDS.map(provider => refreshProvider(provider, manual, reason)), refreshCompanion()]);
  await snapshotSync.run().catch(()=>{});
  if (results.some(result => result.status === 'rejected')) await renderBadge().catch(() => undefined);
}

async function setProvider(provider: ProviderId, enabled: boolean): Promise<void> {
  const origin = providers[provider].origin;
  if (enabled && !await browser.permissions.contains({ origins: [origin] })) throw new Error('Approve Chrome site access before enabling this website.');
  coordinator.cancel(`website:${provider}`);
  await updateStore(store => ({ store: enableWebsite(store, provider, enabled), value: undefined }));
  const scriptId = `mylimits-observer-${provider}`;
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [scriptId] });
  if (registered.length) await browser.scripting.unregisterContentScripts({ ids: [scriptId] });
  if (enabled && observedProviders.includes(provider)) {
    await browser.scripting.registerContentScripts([{
      id: scriptId, matches: [origin], js: ['/content-scripts/observer.js'], runAt: 'document_start', persistAcrossSessions: true,
    }]);
    const tabs = await browser.tabs.query({ url: origin });
    await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.scripting.executeScript({ target: { tabId: tab.id! }, files: ['/content-scripts/observer.js'] })));
  }
  if (enabled) {await refreshProvider(provider, true);await reconcileWidgets();}
  else {
    await browser.permissions.remove({ origins: [origin] });
    await renderBadge();
  }
}

async function injectObserver(provider: ProviderId, tabId: number, channel: string): Promise<void> {
  if (!observedProviders.includes(provider)) return;
  await browser.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: (expectedProvider: string, targetChannel: string, expectedOrigin: string) => {
      if (location.origin !== expectedOrigin) return;
      type ObserverState = { provider: string; channel: string; original: typeof fetch; wrapped: typeof fetch; enabled: boolean };
      const host = window as Window & { __mylimitsObserver?: ObserverState };
      if (host.__mylimitsObserver) { host.__mylimitsObserver.channel = targetChannel; return; }
      const original = window.fetch;
      const state: ObserverState = { provider: expectedProvider, channel: targetChannel, original, wrapped: original, enabled: true };
      const paths: Record<string, RegExp> = {
        gemini: /^\/_\/BardChatUi\/data\/assistant\.lamda\.BardFrontendService\/StreamGenerate$/,
        grok: /^\/rest\/app-chat\/conversations\/(new|[^/]+\/responses)$/,
        perplexity: /^\/rest\/sse\/perplexity_ask$/,
      };
      const wrapper: typeof fetch = async function(this: unknown, input, init) {
        const response = await Reflect.apply(original, this, [input, init]);
        try {
          const url = new URL(input instanceof Request ? input.url : String(input), location.href);
          const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
          if (state.enabled && url.origin === location.origin && method.toUpperCase() === 'POST' && paths[state.provider]?.test(url.pathname) && response.ok) {
            window.postMessage({ mylimits: state.channel, type: 'request-observed', eventId: crypto.randomUUID() }, location.origin);
          }
        } catch { /* An observation must never interfere with the website's request. */ }
        return response;
      };
      state.wrapped = wrapper;
      host.__mylimitsObserver = state;
      window.fetch = wrapper;
      const stop = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== location.origin || event.data?.mylimits !== state.channel || event.data?.type !== 'stop-observer') return;
        state.enabled = false;
        if (window.fetch === wrapper) window.fetch = original;
        delete host.__mylimitsObserver;
        window.removeEventListener('message', stop);
      };
      window.addEventListener('message', stop);
    },
    args: [provider, channel, providers[provider].home],
  });
}

async function handle(command: Command, sender: { id?: string; url?: string; tab?: { id?: number };frameId?:number }): Promise<unknown> {
  if (sender.id !== browser.runtime.id) throw new Error('Unrecognised message sender.');
  if(command.type==='widget-state'||command.type==='widget-action'){
    if(!sender.url||providerForUrl(sender.url)!==command.provider||!sender.tab?.id||sender.frameId!==0)throw new Error('Widget sender does not match its website.');
    const view=await readWidget(command.provider);if(command.type==='widget-state'||!view.enabled)return view;
    if(command.action==='open'){await browser.tabs.create({url:browser.runtime.getURL('/dashboard.html')});return null}
    await updateWidgetSettings(s=>({...s,providers:command.action==='hide'?s.providers.filter(p=>p!==command.provider):s.providers,collapsed:command.action==='collapse'?true:command.action==='expand'?false:s.collapsed,position:command.position??s.position}));return null;
  }
  if (command.type === 'observer-ready' || command.type === 'observation') {
    if (!sender.url || providerForUrl(sender.url) !== command.provider || !sender.tab?.id) throw new Error('Website observation did not match its sender.');
    const state = await readStore();
    if (!state.providers[command.provider].enabled || !observedProviders.includes(command.provider)) return null;
  if (command.type === 'observer-ready') {
      await injectObserver(command.provider, sender.tab.id, command.channel);
      return null;
    }
    await updateStore(store => {
      const id = store.providers[command.provider].activeAccountId;
      return { store: id ? recordObservation(store, command.provider, id, command.eventId, Date.now()) : store, value: undefined };
    });
    return null;
  }
  if (!sender.url?.startsWith(browser.runtime.getURL('/'))) throw new Error('This action must come from the MyLimits dashboard.');
  switch (command.type) {
    case 'widget-settings': return command.settings?updateWidgetSettings(()=>command.settings!):widgetSettings();
    case 'state': return publicStore();
    case 'opened': void refreshAll(false, 'open').catch(() => {}); return publicStore();
    case 'reader-mode': {
      coordinator.cancel(`website:${command.provider}`);
      const enabled=await updateStore(store=>{const enabled=store.providers[command.provider].enabled,next=enableWebsite(store,command.provider,enabled);next.providers[command.provider].readingMode=command.mode;return {store:next,value:enabled}});
      if(enabled)await refreshProvider(command.provider,true);break;
    }
    case 'sync': {
      if(command.action==='status')return snapshotSync.status();
      if(command.action==='start')return snapshotSync.start(command.name);
      if(command.action==='poll'){const status=await snapshotSync.poll();if(status.enabled)await browser.alarms.create(SYNC_ALARM,{periodInMinutes:5});return status}
      if(command.action==='run')return snapshotSync.run(true);
      if(command.action==='push-preferences')return snapshotSync.pushPreferences();
      if(command.action==='pull-preferences'){
        const data=await snapshotSync.pullPreferences();
        if(data.settings?.desktopAlerts&&!await browser.permissions.contains({permissions:['notifications']}))data.settings={...data.settings,desktopAlerts:false};
        await updateStore(store=>({store:{...store,settings:data.settings??store.settings,accounts:store.accounts.map(a=>data.names[a.id]!==undefined?{...a,alias:data.names[a.id]!}:a)},value:undefined}));
        if(data.settings)await browser.alarms.create(REFRESH_ALARM,{periodInMinutes:data.settings.refreshMinutes});await renderBadge();return snapshotSync.status();
      }
      const status=command.action==='disconnect'?await snapshotSync.disconnect():command.action==='reset'?await snapshotSync.reset():await snapshotSync.enable(command.action==='resume');
      if(status.enabled)await browser.alarms.create(SYNC_ALARM,{periodInMinutes:5});else await browser.alarms.clear(SYNC_ALARM);return status;
    }
    case 'account-preferences': {
      const { type: _type, accountId, ...patch } = command;
      await updateStore(store => ({ store: accountPreferences(store, accountId, patch), value: undefined })); break;
    }
    case 'order': await updateStore(store => ({ store: orderAccounts(store, command.ids), value: undefined })); break;
    case 'workspace':
      coordinator.cancel(command.connectionId);
      await updateStore(store => ({ store: setWorkspace(store, command.connectionId, command.workspaceId), value: undefined }));
      await refreshProvider('claude', true); break;
    case 'disconnect': {
      const conn = (await readStore()).connections.find(c => c.id === command.connectionId);
      if (!conn) throw new Error('Connection is no longer saved.');
      if (conn.kind === 'website') await setProvider(conn.provider, false);
      else if (conn.kind === 'companion') { await companionRequest('remove', conn.profileId); await refreshCompanion(); }
      else await updateStore(store => ({ store: changeConnection(store, conn.id, { enabled:false,status:'disabled' }, true), value:undefined }));
      break;
    }

    case 'companion-status': return companionStatus();
    case 'companion-enable':
      if (command.enabled) await browser.alarms.create(COMPANION_ALARM, { periodInMinutes: 1 });
      else await browser.alarms.clear(COMPANION_ALARM);
      await enableCompanion(command.enabled);
      break;
    case 'companion-add': await addCompanionAccount(); break;
    case 'companion-remove': await companionRequest('remove', command.profile); await refreshCompanion(); break;
    case 'refresh': {
      const source = command.connectionId ? (await readStore()).connections.find(c => c.id === command.connectionId) : undefined;
      if(command.connectionId && !source) throw new Error('This connection is no longer available.');
      if(source?.kind === 'companion') { await companionRequest('refresh', source.profileId); await refreshCompanion(); }
      else if(source) await refreshProvider(source.provider, true);
      else if(command.provider) await refreshProvider(command.provider, true);
      else await refreshAll(true);
      break;
    }
    case 'enable': await setProvider(command.provider, command.enabled); break;
    case 'rename':
      await updateStore(store => ({ store: { ...store, accounts: store.accounts.map(account => account.id === command.accountId ? { ...account, alias: command.alias } : account) }, value: undefined }));
      break;
    case 'account-settings':
      await updateStore(store => ({ store: { ...store, accounts: store.accounts.map(account => account.id === command.accountId ? { ...account, alertRemaining: command.alertRemaining, alertsMuted: command.alertsMuted } : account) }, value: undefined }));
      break;
    case 'forget': {
      const store = await readStore();
      const account = store.accounts.find(item => item.id === command.accountId);
      if (account?.companionProfile) { await companionRequest('remove', account.companionProfile); await refreshCompanion(); }
      if (account && !account.companionProfile && store.providers[account.provider].activeAccountId === account.id) await setProvider(account.provider, false);
      await snapshotSync.forget(command.accountId);
      await updateStore(async current => { await removeHistory(command.accountId); await forgetLegacyAccount(command.accountId); return { store: forgetAccount(current, command.accountId), value: undefined }; });
      break;
    }
    case 'settings': {
      const settings = SettingsSchema.parse(command.settings);
      if (settings.desktopAlerts && !await browser.permissions.contains({ permissions: ['notifications'] })) throw new Error('Approve desktop notifications first.');
      if (settings.criticalRemaining > settings.warningRemaining) throw new Error('Critical alert must be at or below the warning threshold.');
      await updateStore(store => ({ store: { ...store, settings }, value: undefined }));
      await pruneHistory(settings.historyRetentionDays??30);
      await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: settings.refreshMinutes });
      await renderBadge();
      break;
    }
    case 'history': return readHistory(command.accountId);
    case 'history-insights': {
      const store=await readStore();if(command.accountIds.some(id=>!store.accounts.some(a=>a.id===id)))throw new Error('Account is no longer saved.');
      const pages=await Promise.all(command.accountIds.map(accountId=>readHistorySeries({accountId,from:command.from,to:command.to})));
      return analyzeHistory(pages.flatMap(p=>p.points),{now:Date.now(),refreshMinutes:store.settings.refreshMinutes,activeConnectionIds:store.connections.filter(c=>c.enabled&&(c.status==='active'||c.status==='checking')).map(c=>c.id),truncated:pages.some(p=>p.truncated)});
    }
    case 'history-page': return readHistoryPage(command);
    case 'export-history': {
      const store=await readStore();const accounts=command.accountId?store.accounts.filter(a=>a.id===command.accountId):store.accounts;
      if(command.accountId&&!accounts.length)throw new Error('This account is no longer saved.');
      if(command.from!==undefined&&command.to!==undefined&&command.from>command.to)throw new Error('Choose a valid date range.');
      return exportReadings(accounts,await historyExport(accounts.map(a=>a.id),command.from,command.to),command.format,Date.now());
    }
    case 'clear-history': await updateStore(async store=>{await clearHistory(command.accountId);return {store:{...store,historyIssue:null},value:undefined}}); break;

  }
  return publicStore();
}

export function startController(): void {
  listenWidgets();
  const storage=browser.storage.local as typeof browser.storage.local&{setAccessLevel?:(options:{accessLevel:'TRUSTED_CONTEXTS'})=>Promise<void>};
  void storage.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
  listenCompanion(async profiles => {
    const changes = await updateStore(store => {
      const next = profiles === null ? markCompanionUnavailable(store) : mergeCompanion(store, profiles, Date.now());
      const readings = next.accounts.filter(account => account.companionProfile && account.connection === 'active' && account.updatedAt > (store.accounts.find(prior => prior.id === account.id)?.updatedAt ?? 0));
      for (const account of next.accounts.filter(account => account.companionProfile)) AccountSchema.parse(account);
      const removed = store.accounts.filter(account => account.companionProfile && !next.accounts.some(current => current.id === account.id)).map(account => account.id);
      return { store: next, value: { readings, removed } };
    });
    await Promise.allSettled([...changes.readings.map(account => saveAcceptedHistory(account.id, `companion:${account.companionProfile}`)), ...changes.removed.map(removeHistory)]);
    await renderBadge(); await sendAlerts();
  });
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = CommandSchema.safeParse(raw);
    if (!parsed.success) { sendResponse({ ok: false, error: 'Invalid MyLimits request.' }); return false; }
    void handle(parsed.data, sender).then(data => sendResponse({ ok: true, data }), error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'The action could not be completed.' }));
    return true;
  });
  browser.alarms.onAlarm.addListener(alarm => { if(alarm.name===SYNC_ALARM)void snapshotSync.run().catch(()=>{});if (alarm.name === COMPANION_ALARM) void refreshCompanion().catch(() => {}); if (alarm.name === REFRESH_ALARM) void refreshAll().catch(() => undefined); });
  browser.permissions.onRemoved.addListener(permissions => {
    void (async () => {
      if (permissions.permissions?.includes('nativeMessaging')) await enableCompanion(false);
      if (permissions.permissions?.includes('notifications')) await updateStore(store => ({ store: { ...store, settings: { ...store.settings, desktopAlerts: false } }, value: undefined }));
      const widgets=await widgetSettings();const kept:ProviderId[]=[];for(const provider of widgets.providers)if(await browser.permissions.contains({origins:[providers[provider].origin]}))kept.push(provider);await updateWidgetSettings(s=>({...s,providers:kept}));
      for (const provider of PROVIDER_IDS) {
        const store = await readStore();
        if (store.providers[provider].enabled && !await browser.permissions.contains({ origins: [providers[provider].origin] })) await setProvider(provider, false);
      }
    })().catch(() => undefined);
  });
  browser.runtime.onStartup.addListener(() => { void refreshAll(false, 'startup').catch(() => undefined); });
  browser.tabs.onUpdated.addListener((_id, info, tab) => { if(info.status==='complete'&&tab.url){const provider=providerForUrl(tab.url);if(provider)void refreshProvider(provider,false,'tab').catch(()=>{});} });
  void (async () => {
    const store = await readStore();
    await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: store.settings.refreshMinutes });
    if ((await companionStatus()).enabled) await browser.alarms.create(COMPANION_ALARM, { periodInMinutes: 1 });
    if((await snapshotSync.status()).enabled)await browser.alarms.create(SYNC_ALARM,{periodInMinutes:5});
    await reconcileWidgets();
    await renderBadge();
    await refreshAll();
  })().catch(() => undefined);
}
