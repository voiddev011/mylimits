import { browser } from 'wxt/browser';
import { cleanupVaultRules } from './vault-transport';
import { setHostLockStartup,hostLockStartup,withHostLock,blockHost } from './host-lock';
import { createSavedSessions } from './saved-sessions';
import { PRIVATE_ALARM,privateSenderAllowed } from '../core/private-signin';
import { VaultError } from '../core/vault-contracts';
import { PROVIDER_IDS, type ProviderId } from '../core/model';
import { AccountSchema, SettingsSchema } from '../core/schema';
import { badge, collectAlerts, recordObservation,markConnection } from '../core/engine';
import { providers, providerForUrl } from '../providers/catalog';
import { AdapterError, readProvider,ambientTransport } from '../providers/adapters';
import { enableWebsite, setWorkspace, accountPreferences, orderAccounts, forgetAccount,providerAccessInUse } from '../core/actions';
import { RefreshCoordinator, shouldRefresh, nextRetry, type RefreshReason } from '../core/scheduler';
import { changeConnection } from '../core/connections';
import { analyzeHistory } from '../core/insights';
import { historyPoint, exportReadings } from '../core/history-data';
import { readStore, publicStore, updateStore, forgetLegacyAccount } from './repository';
import { readHistory, readHistoryPage, readHistorySeries, pruneHistory, historyExport, clearHistory, removeHistory, saveHistory } from './history';
import { CommandSchema, type Command } from './messages';
import { mergeCompanion, markCompanionUnavailable } from '../core/companion';
import { addCompanionAccount, companionRequest, companionStatus, enableCompanion, listenCompanion, refreshCompanion } from './companion';
import { widgetSettings,updateWidgetSettings,reconcileWidgets,readWidget } from './widget';
import { snapshotSync } from './sync';
import { refreshHosted,hostedStatus,startHosted,hostedAttempt,hostedAction } from './hosted';
import { remoteHostedId } from '../core/hosted';
import { createRequestDiagnostics } from './diagnostics';
import { createSessionCookies } from './session-cookies';
import { createTabRecovery } from './bootstrap-tab';
import { isNormalTab } from '../core/browser-tabs';
import { applySyncedSettings } from '../core/sync-contracts';
import { createConnectionRefresh } from './connection-refresh';
import { websiteId } from '../core/connection-id';
import { EXPIRY_ALARM } from '../core/signin-expiry';
import { vaultEnabled } from '../core/vault-policy';
import { createExpiryWatchdog } from './expiry-watchdog';

const coordinator = new RefreshCoordinator(2);
const requestDiagnostics = createRequestDiagnostics({ storage: browser.storage.session });
const tabRecovery=createTabRecovery({tabs:browser.tabs,windows:browser.windows,local:browser.storage.local,session:browser.storage.session});
const sessionCookies = createSessionCookies({ cookies: browser.cookies, tabs: browser.tabs, permissions: browser.permissions,
  status: async provider => { const c=(await readStore()).connections.find(c=>c.id===`website:${provider}`);return c?.enabled?c.status:null; } });
const observedProviders: readonly ProviderId[] = ['gemini', 'grok', 'perplexity'];
const REFRESH_ALARM = 'mylimits:refresh';
const COMPANION_ALARM = 'mylimits:companion';
const SYNC_ALARM='mylimits:sync';
const expiryWatchdog=createExpiryWatchdog({readStore,updateStore,now:()=>Date.now(),enabled:p=>__MYLIMITS_BROWSER__!=='firefox'&&vaultEnabled(p),
  alarms:browser.alarms,permitted:()=>browser.permissions.contains({permissions:['notifications']}),
  notify:alert=>browser.notifications.create(alert.id,{type:'basic',iconUrl:browser.runtime.getURL('/icon/128.png'),title:alert.title,message:alert.message})});
const savedSessions=createSavedSessions({browser,crypto,indexedDB,locks:navigator.locks,supported:__MYLIMITS_BROWSER__!=='firefox',dnr:browser.declarativeNetRequest,
  request:(url,options)=>fetch(url,options),readStore,updateStore,accepted:async(id,source)=>{await saveAcceptedHistory(id,source);await renderBadge();await sendAlerts();},
  lock:withHostLock,ready:hostLockStartup,blockHost,cancelRefresh:id=>coordinator.cancel(id),now:()=>Date.now(),uuid:()=>crypto.randomUUID(),trace:{lastSuccessAt:null,record:input=>requestDiagnostics.record(input)}});

async function renderBadge(): Promise<void> {
  const value = badge(await readStore(), Date.now());
  await browser.action.setBadgeText({ text: value.text });
  await browser.action.setBadgeBackgroundColor({ color: value.color });
  await browser.action.setTitle({ title: value.text ? `MyLimits · ${value.text} ${(await readStore()).settings.displayMode === 'used' ? 'used' : 'left'} in the most constrained reported allowance` : 'MyLimits · your usage, in one place' });
}

async function sendAlerts(): Promise<void> {
  await expiryWatchdog.check().catch(()=>{});
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

const collectConnection=createConnectionRefresh({readStore,updateStore,coordinator,
  permitted:connection=>browser.permissions.contains({origins:[providers[connection.provider].origin]}),
  permissionMissing:async connection=>{
    if(connection.kind==='website')await setProvider(connection.provider,false);
    else await updateStore(store=>({store:changeConnection(store,connection.id,{enabled:false,status:'disabled',message:'Allow site access before reconnecting this source.'},true),value:undefined}));
  },
  read:async(connection,options,signal,onRecoveryStart)=>{
    if(connection.kind==='vault')return savedSessions.readConnection(connection,options,signal,{lastSuccessAt:connection.lastSuccessAt,record:input=>requestDiagnostics.record(input)});
    if(connection.kind!=='website')throw new AdapterError('unavailable','This connection has no usage reader.');
    await tabRecovery.initialize();
    const sessionInfo=await sessionCookies.inspect(connection.provider);
    return readProvider(connection.provider,options,signal,ambientTransport(connection.provider,signal,
      {record:input=>requestDiagnostics.record({...input,sessionCookieState:sessionInfo.state,cookieNames:sessionInfo.names}),lastSuccessAt:connection.lastSuccessAt},
      {access:tabRecovery,options:{enabled:async()=>((await readStore()).settings.autoRecoverTab??true),cookieState:sessionInfo.state,signal,onStart:onRecoveryStart}}));
  },
  cookieState:connection=>sessionCookies.sessionCookieState(connection.provider),
  saveHistory:saveAcceptedHistory,updated:async()=>{await renderBadge();await sendAlerts();},
});

export async function refreshConnection(connectionId:string,manual=false,reason:RefreshReason=manual?'manual':'scheduled'):Promise<void>{
  const source=(await readStore()).connections.find(c=>c.id===connectionId);
  if(!source)return;
  if(source.kind==='website'||source.kind==='vault')return collectConnection(connectionId,reason);
  if(source.kind==='snapshot-import')return; // Imported readings have no live provider authorization.
  return coordinator.run(connectionId,async signal=>{
    const store=await readStore(),current=store.connections.find(c=>c.id===connectionId);
    if(!current||!shouldRefresh(current,reason,Date.now(),store.settings.refreshMinutes)||signal.aborted)return;
    try{
      if(current.kind==='cloud'&&remoteHostedId(current.id)){
        if(manual)await hostedAction(remoteHostedId(current.id)!,'refresh');else await refreshHosted();
      }else if(current.kind==='companion'&&current.profileId){
        await companionRequest('refresh',current.profileId);await refreshCompanion();
      }else throw new AdapterError('unavailable','No refresh transport is available for this connection.');
    }catch(error){
      if(signal.aborted)return;
      await updateStore(latest=>{
        const live=latest.connections.find(c=>c.id===connectionId&&c.enabled&&c.generation===current.generation);if(!live)return {store:latest,value:undefined};
        const next=markConnection(latest,connectionId,'unavailable','This connection could not refresh. Its last reading is retained.',Date.now());
        next.connections=next.connections.map(c=>c.id===connectionId?{...c,failures:c.failures+1,nextRetryAt:nextRetry(Date.now(),c.failures+1,latest.settings.refreshMinutes,null)}:c);
        return {store:next,value:undefined};
      });
    }
    await renderBadge();await sendAlerts();
  });
}
export async function refreshProvider(provider:ProviderId,manual=false,reason:RefreshReason=manual?'manual':'scheduled'):Promise<void>{
  const connections=(await readStore()).connections.filter(c=>c.provider===provider&&c.enabled);
  await Promise.allSettled(connections.map(c=>refreshConnection(c.id,manual,reason)));
}
async function refreshAll(manual=false,reason:RefreshReason=manual?'manual':'scheduled'):Promise<void>{
  const setup=(await readStore()).accountSetup;
  if(setup&&setup.method!=='private')await updateStore(store=>({store:store.accountSetup?.id===setup.id?{...store,accountSetup:null}:store,value:undefined}));
  await expiryWatchdog.check().catch(()=>{});
  // Discovery must not hold website collection behind an unavailable helper/API.
  const discovery=Promise.allSettled([refreshCompanion(),refreshHosted()]);
  const connections=(await readStore()).connections.filter(c=>c.enabled);
  const results=await Promise.allSettled([...connections.map(c=>refreshConnection(c.id,manual,reason)),discovery]);
  await snapshotSync.run().catch(()=>{});
  if(results.some(result=>result.status==='rejected'))await renderBadge().catch(()=>{});
}

async function releaseUnusedProviderAccess(provider:ProviderId){
  if(!providerAccessInUse(await readStore(),provider))await browser.permissions.remove({origins:[providers[provider].origin]});
}
async function setProvider(provider: ProviderId, enabled: boolean): Promise<void> {
  const origin = providers[provider].origin;
  if (enabled && !await browser.permissions.contains({ origins: [origin] })) throw new Error('Approve Chrome site access before enabling this website.');
  coordinator.cancel(`website:${provider}`);
  await updateStore(store => ({ store: enableWebsite(store, provider, enabled), value: undefined }));
  await reconcileObserver(provider);
  if (enabled) {await refreshConnection(websiteId(provider), true);await reconcileWidgets();}
  else {
    await releaseUnusedProviderAccess(provider);
    await renderBadge();
  }
}

async function reconcileObserver(provider:ProviderId){
  const origin=providers[provider].origin;
  const scriptId = `mylimits-observer-${provider}`;
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [scriptId] });
  if (registered.length) await browser.scripting.unregisterContentScripts({ ids: [scriptId] });
  const state=await readStore(),enabled=state.providers[provider].enabled&&(provider==='gemini'||state.providers[provider].readingMode==='activity')&&await browser.permissions.contains({origins:[origin]});
  const existingTabs=await browser.tabs.query({url:providers[provider].origin});await Promise.allSettled(existingTabs.filter(tab=>tab.id).map(tab=>browser.tabs.sendMessage(tab.id!,{type:'mylimits-observer-stop'})));
  if (enabled && observedProviders.includes(provider)) {
    await browser.scripting.registerContentScripts([{
      id: scriptId, matches: [origin], js: ['/content-scripts/observer.js'], runAt: 'document_start', persistAcrossSessions: true,
    }]);
    const tabs = await browser.tabs.query({ url: origin });
    await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.scripting.executeScript({ target: { tabId: tab.id! }, files: ['/content-scripts/observer.js'] })));
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

async function handle(command: Command, sender: { id?: string; url?: string; tab?: { id?: number;incognito?:boolean };frameId?:number }): Promise<unknown> {
  if (sender.id !== browser.runtime.id) throw new Error('Unrecognised message sender.');
  if(command.type==='widget-state'||command.type==='widget-action'){
    if(!sender.url||providerForUrl(sender.url)!==command.provider||!sender.tab?.id||sender.frameId!==0)throw new Error('Widget sender does not match its website.');
    const view=await readWidget(command.provider);if(command.type==='widget-state'||!view.enabled)return view;
    await updateWidgetSettings(s=>({...s,providers:command.action==='hide'?s.providers.filter(p=>p!==command.provider):s.providers,position:command.position??s.position}));return null;
  }
  if (command.type === 'observer-ready' || command.type === 'observation') {
    if (!sender.url || providerForUrl(sender.url) !== command.provider || !sender.tab?.id) throw new Error('Website observation did not match its sender.');
    const state = await readStore();
    if (!state.providers[command.provider].enabled || !observedProviders.includes(command.provider)||(command.provider!=='gemini'&&state.providers[command.provider].readingMode!=='activity')) return null;
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
  if(command.type.startsWith('vault-signin-')){
    if(!privateSenderAllowed(sender,browser.runtime.id,browser.runtime.getURL('/')))throw new Error('Saved sign-in actions require the normal MyLimits dashboard.');
    if(command.type==='vault-signin-start')await savedSessions.start(command.provider,command.method,command.nickname);
    else if(command.type==='vault-signin-save')await savedSessions.save(command.setupId,command.accountId,command.consent,command.nickname);
    else if(command.type==='vault-signin-cancel')await savedSessions.cancel(command.setupId);
    else if(command.type==='vault-signin-check')await savedSessions.check(command.setupId);
    return publicStore();
  }
  switch (command.type) {
    case 'widget-settings': return command.settings?updateWidgetSettings(()=>command.settings!):widgetSettings();
    case 'state': return publicStore();
    case 'request-diagnostics': return { version: 1, entries: await requestDiagnostics.list() };
    case 'hosted-status': return hostedStatus();
    case 'hosted-link': return command.action==='start'?snapshotSync.start('MyLimits hosted accounts'):snapshotSync.poll(false);
    case 'hosted-start': return startHosted(command.provider,command.reconnectId);
    case 'hosted-attempt': return hostedAttempt(command.id,!!command.cancel);
    case 'hosted-list': await refreshHosted();return publicStore();
    case 'hosted-action': await hostedAction(command.id,command.action,command.alias);return publicStore();
    case 'account-setup-cancel':
      if((await readStore()).accountSetup?.method==='private')throw new Error('Use saved sign-in cancellation for this setup.');
      await updateStore(store => ({store:store.accountSetup?.id===command.setupId?{...store,accountSetup:null}:store,value:undefined})); break;
    case 'opened': void refreshAll(false, 'open').catch(() => {}); return publicStore();
    case 'reader-mode': {
      coordinator.cancel(`website:${command.provider}`);
      const enabled=await updateStore(store=>{const enabled=store.providers[command.provider].enabled,next=enableWebsite(store,command.provider,enabled);next.providers[command.provider].readingMode=command.mode;return {store:next,value:enabled}});
      await reconcileObserver(command.provider);if(enabled)await refreshConnection(websiteId(command.provider),true);break;
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
        await updateStore(store=>({store:{...store,settings:applySyncedSettings(store.settings,data.settings),accounts:store.accounts.map(a=>data.names[a.id]!==undefined?{...a,alias:data.names[a.id]!}:a)},value:undefined}));
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
      await refreshConnection(command.connectionId, true); break;
    case 'disconnect': {
      const conn = (await readStore()).connections.find(c => c.id === command.connectionId);
      if (!conn) throw new Error('Connection is no longer saved.');
      if(conn.kind==='cloud'&&remoteHostedId(conn.id))await hostedAction(remoteHostedId(conn.id)!,'disconnect');
      else if(conn.kind==='vault'){await savedSessions.disconnect(conn.id);await releaseUnusedProviderAccess(conn.provider);}
      else if (conn.kind === 'website') await setProvider(conn.provider, false);
      else if (conn.kind === 'companion') { await companionRequest((await companionStatus()).compatible ? 'disconnect' : 'remove', conn.profileId); await refreshCompanion(); }
      else {coordinator.cancel(conn.id);await updateStore(store => ({ store: changeConnection(store, conn.id, { enabled:false,status:'disabled' }, true), value:undefined }));}
      break;
    }

    case 'companion-status': return companionStatus();
    case 'companion-enable':
      if (command.enabled) await browser.alarms.create(COMPANION_ALARM, { periodInMinutes: 1 });
      else await browser.alarms.clear(COMPANION_ALARM);
      await enableCompanion(command.enabled);
      break;
    case 'companion-add': {
      const profile = await addCompanionAccount(command.provider, command.nickname);
      await refreshCompanion();
      if (command.nickname) await updateStore(store=>({store:{...store,accounts:store.accounts.map(a=>a.companionProfile===profile?{...a,alias:command.nickname!}:a)},value:undefined}));
      break;
    }
    case 'companion-confirm': await companionRequest('confirm', command.profile, { generation:command.generation,alias:command.alias }); await refreshCompanion(); break;
    case 'companion-action': await companionRequest(command.action, command.profile); await refreshCompanion(); break;
    case 'companion-remove': await companionRequest('remove', command.profile); await refreshCompanion(); break;
    case 'refresh': {
      const source = command.connectionId ? (await readStore()).connections.find(c => c.id === command.connectionId) : undefined;
      if(command.connectionId && !source) throw new Error('This connection is no longer available.');
      if(source) await refreshConnection(source.id,true);
      else if(command.provider) await refreshProvider(command.provider, true);
      else await refreshAll(true);
      break;
    }
    case 'enable': await setProvider(command.provider, command.enabled); break;
    case 'rename': {
      const account = (await readStore()).accounts.find(a => a.id === command.accountId);
      if(remoteHostedId(command.accountId))await hostedAction(remoteHostedId(command.accountId)!,'rename',command.alias);
      if (account?.companionProfile) {
        const status = await companionStatus();
        if (status.compatible) await companionRequest('rename', account.companionProfile, { alias: command.alias });
      }
      await updateStore(store => ({ store: { ...store, accounts: store.accounts.map(account => account.id === command.accountId ? { ...account, alias: command.alias } : account) }, value: undefined }));
      break;
    }
    case 'account-settings':
      await updateStore(store => ({ store: { ...store, accounts: store.accounts.map(account => account.id === command.accountId ? { ...account, alertRemaining: command.alertRemaining, alertsMuted: command.alertsMuted } : account) }, value: undefined }));
      break;
    case 'forget': {
      const store = await readStore();
      const account = store.accounts.find(item => item.id === command.accountId);
      const vaultProviders=[...new Set(store.connections.filter(c=>c.kind==='vault'&&c.accountId===command.accountId).map(c=>c.provider))];
      await savedSessions.forget(command.accountId);
      if(remoteHostedId(command.accountId))await hostedAction(remoteHostedId(command.accountId)!,'forget');
      if (account?.companionProfile) { await companionRequest('remove', account.companionProfile); await refreshCompanion(); }
      if (account && !account.companionProfile && store.providers[account.provider].activeAccountId === account.id) await setProvider(account.provider, false);
      await snapshotSync.forget(command.accountId);
      await updateStore(async current => { await removeHistory(command.accountId); await forgetLegacyAccount(command.accountId); return { store: forgetAccount(current, command.accountId), value: undefined }; });
      for(const provider of vaultProviders)await releaseUnusedProviderAccess(provider);
      break;
    }
    case 'settings': {
      const settings = SettingsSchema.parse(command.settings);
      if (settings.desktopAlerts && !await browser.permissions.contains({ permissions: ['notifications'] })) throw new Error('Approve desktop notifications first.');
      if (settings.criticalRemaining > settings.warningRemaining) throw new Error('Critical alert must be at or below the warning threshold.');
      await updateStore(store => ({ store: { ...store, settings }, value: undefined }));
      if(settings.autoRecoverTab===false)tabRecovery.cancelAll();
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
  if(['settings','disconnect','forget','account-settings','account-preferences'].includes(command.type))await expiryWatchdog.check().catch(()=>{});
  return publicStore();
}

export function startController(): void {
  setHostLockStartup(__MYLIMITS_BROWSER__==='firefox'?Promise.resolve():cleanupVaultRules({dnr:browser.declarativeNetRequest,
    permitted:()=>browser.permissions.contains({permissions:['declarativeNetRequestWithHostAccess']})}));
  savedSessions.bind();
  let stopSessionCookies=()=>{};
  const listenSessionCookies=()=>{stopSessionCookies();stopSessionCookies=sessionCookies.listenSessionCookies(provider=>refreshConnection(websiteId(provider),false,'cookie'));};
  listenSessionCookies();
  browser.permissions.onAdded.addListener(listenSessionCookies);
  browser.permissions.onAdded.addListener(()=>savedSessions.bind());
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
    void handle(parsed.data, sender).then(data => sendResponse({ ok: true, data }), error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'The action could not be completed.',
      ...(parsed.data.type.startsWith('vault-signin-')&&error instanceof VaultError?{code:error.code}:{}) }));
    return true;
  });
  browser.alarms.onAlarm.addListener(alarm => {if(alarm.name===EXPIRY_ALARM)void expiryWatchdog.check().catch(()=>{});if(alarm.name===PRIVATE_ALARM)void savedSessions.expire().catch(()=>{});if(alarm.name===SYNC_ALARM)void snapshotSync.run().catch(()=>{});if (alarm.name === COMPANION_ALARM) void refreshCompanion().catch(() => {}); if (alarm.name === REFRESH_ALARM) void refreshAll().catch(() => undefined); });
  browser.permissions.onRemoved.addListener(permissions => {
    listenSessionCookies();
    void (async () => {
      await savedSessions.permissionsChanged();
      if((permissions as {data_collection?:string[]}).data_collection?.length)await snapshotSync.enable(false);
      if (permissions.permissions?.includes('nativeMessaging')) await enableCompanion(false);
      if (permissions.permissions?.includes('notifications')) await updateStore(store => ({ store: { ...store, settings: { ...store.settings, desktopAlerts: false } }, value: undefined }));
      await expiryWatchdog.check().catch(()=>{});
      const widgets=await widgetSettings();const kept:ProviderId[]=[];for(const provider of widgets.providers)if(await browser.permissions.contains({origins:[providers[provider].origin]}))kept.push(provider);await updateWidgetSettings(s=>({...s,providers:kept}));
      for (const provider of PROVIDER_IDS) {
        const store = await readStore();
        if (store.providers[provider].enabled && !await browser.permissions.contains({ origins: [providers[provider].origin] })) await setProvider(provider, false);
      }
    })().catch(() => undefined);
  });
  browser.runtime.onStartup.addListener(() => { void refreshAll(false, 'startup').catch(() => undefined); });
  browser.idle.onStateChanged.addListener(state=>{if(state==='active')void refreshAll(false,'idle').catch(()=>{});});
  browser.tabs.onUpdated.addListener((id, info, tab) => { if(isNormalTab(tab)&&!tabRecovery.owns(id)&&info.status==='complete'&&tab.url){const provider=providerForUrl(tab.url);if(provider)void refreshConnection(websiteId(provider),false,'tab').catch(()=>{});} });
  void (async () => {
    // A broken saved-setup journal must not stop ordinary website tracking.
    await savedSessions.initialize().catch(()=>{});
    await tabRecovery.initialize();
    const store = await readStore();
    await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: store.settings.refreshMinutes });
    if ((await companionStatus()).enabled) await browser.alarms.create(COMPANION_ALARM, { periodInMinutes: 1 });
    if((await snapshotSync.status()).enabled)await browser.alarms.create(SYNC_ALARM,{periodInMinutes:5});
    await reconcileWidgets();for(const provider of observedProviders)await reconcileObserver(provider);
    await renderBadge();
    await refreshAll();
  })().catch(() => undefined);
}
