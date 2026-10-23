import type { ProviderId,Store } from '../core/model';
import { collectExpiryAlerts,expiringSources,EXPIRY_ALARM,EXPIRY_PERIOD,type ExpiryAlert } from '../core/signin-expiry';
interface Port {
 readStore():Promise<Store>;
 updateStore<T>(fn:(s:Store)=>Promise<{store:Store;value:T}>):Promise<T>;
 enabled(provider:ProviderId):boolean;now():number;permitted():Promise<boolean>;
 notify(alert:ExpiryAlert):Promise<unknown>;
 alarms:{get(name:string):Promise<{periodInMinutes?:number}|undefined>;create(name:string,options:{periodInMinutes:number;delayInMinutes:number}):Promise<unknown>;clear(name:string):Promise<unknown>};
}
/** Uses only public expiry metadata; never opens the vault or contacts a provider. */
export function createExpiryWatchdog(port:Port){
 let running:Promise<void>|undefined,again=false;
 async function check(){
  const before=await port.readStore(),permitted=await port.permitted();
  const wanted=before.settings.desktopAlerts&&permitted&&expiringSources(before,port.now(),port.enabled).length>0;
  const alarm=await port.alarms.get(EXPIRY_ALARM);
  if(wanted&&alarm?.periodInMinutes!==EXPIRY_PERIOD)await port.alarms.create(EXPIRY_ALARM,{periodInMinutes:EXPIRY_PERIOD,delayInMinutes:EXPIRY_PERIOD});
  else if(!wanted&&alarm)await port.alarms.clear(EXPIRY_ALARM);
  if(!wanted)return;
  // Shared Store serialization covers concurrent quota refresh, reconnect and deletion.
  await port.updateStore(async store=>{
   const result=collectExpiryAlerts(store,port.now(),port.enabled);
   for(const alert of result.alerts)try{await port.notify(alert);}catch{
    const prior=store.alertLedger[alert.ledgerKey];
    if(prior)result.store.alertLedger[alert.ledgerKey]=prior;else delete result.store.alertLedger[alert.ledgerKey];
   }
   return {store:result.store,value:undefined};
  });
 }
 return {check(){
  if(running){again=true;return running;}
  // A setting/disconnect arriving during a check needs one trailing reconciliation.
  return running=(async()=>{do{again=false;await check()}while(again)})().finally(()=>{running=undefined});
 }};
}
