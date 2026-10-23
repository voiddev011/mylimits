// CDP-only fixture: actual watchdog, browser storage/alarms; fictional account/clock/notification sink.
import type { browser as BrowserAPI } from 'wxt/browser';
import { createExpiryWatchdog } from '../../src/platform/expiry-watchdog';
import { emptyStore,websiteConnection,type Store } from '../../src/core/model';
import { applySnapshot } from '../../src/core/engine';
import { vaultId } from '../../src/core/connection-id';
import { EXPIRY_ALARM,type ExpiryAlert } from '../../src/core/signin-expiry';
export async function expiryFixture(browser:typeof BrowserAPI){
 const key='mylimits:c12-fixture-only',now=1800000000000,slot='10000000-0000-4000-8000-000000000001',id=vaultId('chatgpt',slot);
 let initial=emptyStore('fictional-expiry'),clock=now;const sent:ExpiryAlert[]=[];
 initial.connections.push({...websiteConnection('chatgpt'),id,kind:'vault',profileId:slot,enabled:true,status:'active',savedSignIn:{method:'private',notAfter:now+47*3600000}});
 initial=applySnapshot(initial,'chatgpt','expiry-account',{kind:'account',displayName:'PRIVATE FIXTURE ALIAS',plan:'plus',meters:[]},now,{connectionId:id});
 initial.settings.desktopAlerts=true;initial.settings.privacyMode=true;
 if(!(await browser.storage.local.get(key))[key])await browser.storage.local.set({[key]:initial});
 const read=async()=>structuredClone((await browser.storage.local.get(key))[key] as Store);
 let queue:Promise<unknown>=Promise.resolve();
 const port={readStore:read,updateStore<T>(fn:(s:Store)=>Promise<{store:Store;value:T}>):Promise<T>{
  const run=queue.then(async()=>{const r=await fn(await read());await browser.storage.local.set({[key]:r.store});return r.value});queue=run.catch(()=>{});return run;
 },enabled:()=>true,now:()=>clock,permitted:async()=>true,alarms:browser.alarms,notify:async(a:ExpiryAlert)=>{sent.push(a)}};
 let watch=createExpiryWatchdog(port);
 return {read,sent,check:()=>watch.check(),restart:()=>{watch=createExpiryWatchdog(port)},advance:(hours:number)=>{clock+=hours*3600000},
  alarm:()=>browser.alarms.get(EXPIRY_ALARM),async disconnect(){await browser.storage.local.set({[key]:{...await read(),connections:initial.connections.filter(c=>c.id!==id)}});}};
}
