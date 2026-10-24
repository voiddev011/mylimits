import { browser } from 'wxt/browser';
import { WidgetSettingsSchema,widgetDefaults,widgetView,type WidgetSettings } from '../core/widget';
import { PROVIDER_IDS,type ProviderId } from '../core/model';
import { providers } from '../providers/catalog';
const key='mylimits:widget:v1';let queue:Promise<unknown>=Promise.resolve();
export async function widgetSettings(){const raw=(await browser.storage.local.get(key))[key];return raw===undefined?widgetDefaults():WidgetSettingsSchema.parse(raw)}
async function notify(provider:ProviderId,type='mylimits-widget-refresh'){
 const tabs=await browser.tabs.query({url:providers[provider].origin});await Promise.allSettled(tabs.filter(t=>t.id).map(t=>browser.tabs.sendMessage(t.id!,{type})));
}
export async function reconcileWidgets(){
 const settings=await widgetSettings();
 for(const provider of PROVIDER_IDS.filter(p=>p!=='copilot')){const id=`mylimits-widget-${provider}`,enabled=settings.providers.includes(provider)&&await browser.permissions.contains({origins:[providers[provider].origin]});const registered=await browser.scripting.getRegisteredContentScripts({ids:[id]});
  if(!enabled){if(registered.length)await browser.scripting.unregisterContentScripts({ids:[id]});await notify(provider,'mylimits-widget-stop');continue}
  if(!registered.length)await browser.scripting.registerContentScripts([{id,matches:[providers[provider].origin],js:['/content-scripts/widget.js'],runAt:'document_idle',persistAcrossSessions:true}]);
  const tabs=await browser.tabs.query({url:providers[provider].origin});await Promise.allSettled(tabs.filter(t=>t.id).map(t=>browser.scripting.executeScript({target:{tabId:t.id!},files:['/content-scripts/widget.js']})));await notify(provider);
 }
}
export function updateWidgetSettings(update:(prior:WidgetSettings)=>WidgetSettings){
 const task=queue.then(async()=>{const next=WidgetSettingsSchema.parse(update(await widgetSettings()));for(const id of next.providers)if(!await browser.permissions.contains({origins:[providers[id].origin]}))throw new Error('Enable website access before adding its widget.');await browser.storage.local.set({[key]:next});await reconcileWidgets();return next});queue=task.catch(()=>{});return task;
}
export async function readWidget(provider:ProviderId){if(!await browser.permissions.contains({origins:[providers[provider].origin]}))return {enabled:false as const};return widgetView(provider,await widgetSettings())}
