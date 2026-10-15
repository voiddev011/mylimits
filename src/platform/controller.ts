import { browser } from 'wxt/browser';
import { PROVIDER_IDS, type ProviderId } from '../core/model';
import { AccountSchema, MeterSchema, SettingsSchema } from '../core/schema';
import { accountId, applySnapshot, badge, collectAlerts, markProvider, recordObservation } from '../core/engine';
import { providers, providerForUrl } from '../providers/catalog';
import { AdapterError, readProvider } from '../providers/adapters';
import { enableWebsite, setWorkspace, accountPreferences, orderAccounts, forgetAccount } from '../core/actions';
import { changeConnection } from '../core/connections';
import { readStore, publicStore, updateStore } from './repository';
import { readHistory, removeHistory, saveHistory } from './history';
import { CommandSchema, type Command } from './messages';
import { mergeCompanion, markCompanionUnavailable } from '../core/companion';
import { addCompanionAccount, companionRequest, companionStatus, enableCompanion, listenCompanion, refreshCompanion } from './companion';

const running = new Map<ProviderId, Promise<void>>();
const generation: Record<ProviderId, number> = { claude: 0, chatgpt: 0, gemini: 0, grok: 0, perplexity: 0 };
const observedProviders: readonly ProviderId[] = ['gemini', 'grok', 'perplexity'];
const REFRESH_ALARM = 'mylimits:refresh';
const COMPANION_ALARM = 'mylimits:companion';

async function renderBadge(): Promise<void> {
  const value = badge(await readStore(), Date.now());
  await browser.action.setBadgeText({ text: value.text });
  await browser.action.setBadgeBackgroundColor({ color: value.color });
  await browser.action.setTitle({ title: value.text ? `MyLimits · ${value.text} left in the most constrained reported allowance` : 'MyLimits · your usage, in one place' });
}

async function sendAlerts(): Promise<void> {
  if (!await browser.permissions.contains({ permissions: ['notifications'] })) return;
  // Serialize the decision and delivery, so overlapping refreshes cannot alert twice.
  await updateStore(async store => {
    const result = collectAlerts(store, Date.now());
    const failedMeters = new Set<string>();
    for (const alert of result.alerts) {
      try {
        await browser.notifications.create(alert.id, {
          type: 'basic', iconUrl: browser.runtime.getURL('/icon/128.png'), title: alert.title, message: alert.message,
        });
      } catch { failedMeters.add(`${alert.accountId}/${alert.meterId}`); }
    }
    // Failed deliveries can retry next refresh; a failure must not silently consume an alert.
    for (const key of failedMeters) {
      if (store.alertLedger[key]) result.store.alertLedger[key] = store.alertLedger[key];
      else delete result.store.alertLedger[key];
    }
    return { store: result.store, value: undefined };
  });
}

export async function refreshProvider(provider: ProviderId, manual = false): Promise<void> {
  const existing = running.get(provider);
  if (existing) return existing;
  const task = (async () => {
    const before = await readStore();
    const state = before.providers[provider];
    if (!state.enabled) return;
    const now = Date.now();
    if (!manual && state.nextRetryAt !== null && state.nextRetryAt > now) return;
    if (manual && state.checkedAt !== null && now - state.checkedAt < 15_000) return;
    const stamp = generation[provider];
    if (!await browser.permissions.contains({ origins: [providers[provider].origin] })) {
      await setProvider(provider, false);
      return;
    }
    await updateStore(store => ({ store: { ...store, providers: { ...store.providers, [provider]: { ...store.providers[provider], status: 'checking' } } }, value: undefined }));
    try {
      const connection = before.connections.find(c => c.id === `website:${provider}`);
      const selected = before.workspaces.find(w => w.id === connection?.workspaceId);
      const snapshot = await readProvider(provider, { workspaceRemoteId: selected?.remoteId });
      const choices = await Promise.all((snapshot.workspaces ?? []).map(async w => ({ id: await accountId(provider, `workspace:${w.identity}`, before.installSalt), provider, remoteId: w.identity, name: w.name })));
      const selectedId = choices.find(w => w.remoteId === snapshot.workspace?.identity)?.id ?? null;
      const meters = snapshot.meters.map(meter => MeterSchema.parse(meter));
      const id = await accountId(provider, snapshot.identity, before.installSalt);
      const accepted = await updateStore(store => {
        if (!store.providers[provider].enabled || generation[provider] !== stamp) return { store, value: false };
        const enriched = { ...store, workspaces: [...store.workspaces.filter(w => !choices.some(n => n.id === w.id)), ...choices], connections: store.connections.map(c => c.id === `website:${provider}` ? { ...c, workspaceIds: choices.map(w=>w.id) } : c) };
        const next = applySnapshot(enriched, provider, id, { ...snapshot, meters }, Date.now(), { workspaceId: selectedId });
        // Persist only the normalised fields. Transient identity and auth never reach storage.
        AccountSchema.parse(next.accounts.find(account => account.id === id));
        return { store: next, value: true };
      });
      if (accepted && meters.length) {
        await saveHistory({ accountId: id, time: Date.now(), meters: meters.map(meter => ({ id: meter.id, usedPercent: meter.usedPercent })) }).catch(() => undefined);
      }
    } catch (error) {
      const status = error instanceof AdapterError ? error.status : 'error';
      const message = error instanceof AdapterError ? error.message : 'The website returned information MyLimits could not verify.';
      await updateStore(store => {
        if (!store.providers[provider].enabled || generation[provider] !== stamp) return { store, value: undefined };
        const marked = markProvider(store, provider, status, message, Date.now());
        const failures = store.providers[provider].failures + 1;
        marked.providers[provider].failures = failures;
        marked.providers[provider].nextRetryAt = Date.now() + Math.min(60, store.settings.refreshMinutes * 2 ** Math.min(failures, 5)) * 60_000;
        return { store: marked, value: undefined };
      });
    }
    await renderBadge();
    await sendAlerts();
  })();
  running.set(provider, task);
  try { await task; } finally { running.delete(provider); }
}

async function refreshAll(manual = false): Promise<void> {
  const results = await Promise.allSettled([...PROVIDER_IDS.map(provider => refreshProvider(provider, manual)), refreshCompanion()]);
  if (results.some(result => result.status === 'rejected')) await renderBadge().catch(() => undefined);
}

async function setProvider(provider: ProviderId, enabled: boolean): Promise<void> {
  const origin = providers[provider].origin;
  if (enabled && !await browser.permissions.contains({ origins: [origin] })) throw new Error('Approve Chrome site access before enabling this website.');
  generation[provider]++;
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
  if (enabled) await refreshProvider(provider, true);
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

async function handle(command: Command, sender: { id?: string; url?: string; tab?: { id?: number } }): Promise<unknown> {
  if (sender.id !== browser.runtime.id) throw new Error('Unrecognised message sender.');
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
    case 'state': return publicStore();
    case 'account-preferences': {
      const { type: _type, accountId, ...patch } = command;
      await updateStore(store => ({ store: accountPreferences(store, accountId, patch), value: undefined })); break;
    }
    case 'order': await updateStore(store => ({ store: orderAccounts(store, command.ids), value: undefined })); break;
    case 'workspace':
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
    case 'refresh': command.provider ? await refreshProvider(command.provider, true) : await refreshAll(true); break;
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
      await updateStore(current => ({ store: forgetAccount(current, command.accountId), value: undefined }));
      await removeHistory(command.accountId);
      break;
    }
    case 'settings': {
      const settings = SettingsSchema.parse(command.settings);
      if (settings.desktopAlerts && !await browser.permissions.contains({ permissions: ['notifications'] })) throw new Error('Approve desktop notifications first.');
      if (settings.criticalRemaining > settings.warningRemaining) throw new Error('Critical alert must be at or below the warning threshold.');
      await updateStore(store => ({ store: { ...store, settings }, value: undefined }));
      await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: settings.refreshMinutes });
      await renderBadge();
      break;
    }
    case 'history': return readHistory(command.accountId);
  }
  return publicStore();
}

export function startController(): void {
  listenCompanion(async profiles => {
    const changes = await updateStore(store => {
      const next = profiles === null ? markCompanionUnavailable(store) : mergeCompanion(store, profiles, Date.now());
      const readings = next.accounts.filter(account => account.companionProfile && account.connection === 'active' && account.updatedAt > (store.accounts.find(prior => prior.id === account.id)?.updatedAt ?? 0));
      for (const account of next.accounts.filter(account => account.companionProfile)) AccountSchema.parse(account);
      const removed = store.accounts.filter(account => account.companionProfile && !next.accounts.some(current => current.id === account.id)).map(account => account.id);
      return { store: next, value: { readings, removed } };
    });
    await Promise.allSettled([...changes.readings.map(account => saveHistory({ accountId: account.id, time: account.updatedAt, meters: account.meters.map(meter => ({ id: meter.id, usedPercent: meter.usedPercent })) })), ...changes.removed.map(removeHistory)]);
    await renderBadge(); await sendAlerts();
  });
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = CommandSchema.safeParse(raw);
    if (!parsed.success) { sendResponse({ ok: false, error: 'Invalid MyLimits request.' }); return false; }
    void handle(parsed.data, sender).then(data => sendResponse({ ok: true, data }), error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'The action could not be completed.' }));
    return true;
  });
  browser.alarms.onAlarm.addListener(alarm => { if (alarm.name === COMPANION_ALARM) void refreshCompanion().catch(() => {}); if (alarm.name === REFRESH_ALARM) void refreshAll().catch(() => undefined); });
  browser.permissions.onRemoved.addListener(permissions => {
    void (async () => {
      if (permissions.permissions?.includes('nativeMessaging')) await enableCompanion(false);
      if (permissions.permissions?.includes('notifications')) await updateStore(store => ({ store: { ...store, settings: { ...store.settings, desktopAlerts: false } }, value: undefined }));
      for (const provider of PROVIDER_IDS) {
        const store = await readStore();
        if (store.providers[provider].enabled && !await browser.permissions.contains({ origins: [providers[provider].origin] })) await setProvider(provider, false);
      }
    })().catch(() => undefined);
  });
  browser.runtime.onStartup.addListener(() => { void refreshAll().catch(() => undefined); });
  void (async () => {
    const store = await readStore();
    await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: store.settings.refreshMinutes });
    if ((await companionStatus()).enabled) await browser.alarms.create(COMPANION_ALARM, { periodInMinutes: 1 });
    await renderBadge();
    await refreshAll();
  })().catch(() => undefined);
}
