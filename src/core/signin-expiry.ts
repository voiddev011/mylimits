import { accountName,type ConnectionRecord,type ProviderId,type Store } from './model';
import { parseConnectionId } from './connection-id';
import { isQuiet } from './alert-policy';
import { privateAccountName } from './presentation';
export const EXPIRY_ALARM='mylimits:signin-expiry';
export const EXPIRY_PERIOD=1440;
const HOUR=3600000;
export interface ExpiryAlert {id:string;accountId:string;ledgerKey:string;title:string;message:string;}
/** Metadata only. A known cookie expiry is a bound, not proof of session validity. */
export function expiringSources(store:Store,now:number,enabled:(p:ProviderId)=>boolean):ConnectionRecord[]{
 return store.connections.filter(c=>{
  const id=parseConnectionId(c.id),expiry=c.savedSignIn?.notAfter;
  return c.kind==='vault'&&c.enabled&&!['disabled','needs-auth'].includes(c.status)&&enabled(c.provider)
   &&id?.kind==='vault'&&id.provider===c.provider&&id.slot===c.profileId
   &&expiry!=null&&Number.isFinite(expiry)&&expiry>now
   &&store.accounts.some(a=>a.id===c.accountId&&a.provider===c.provider);
 });
}
export function collectExpiryAlerts(store:Store,now:number,enabled:(p:ProviderId)=>boolean):{store:Store;alerts:ExpiryAlert[]}{
 if(!store.settings.desktopAlerts||isQuiet(store.settings,now))return {store,alerts:[]};
 const ledger=structuredClone(store.alertLedger),alerts:ExpiryAlert[]=[];
 for(const c of expiringSources(store,now,enabled)){
  const account=store.accounts.find(a=>a.id===c.accountId)!,expiry=c.savedSignIn!.notAfter!,left=expiry-now;
  if(account.alertsMuted||(account.snoozedUntil??0)>now||left>48*HOUR)continue;
  const threshold=left<=24*HOUR?24:48,key=`${account.id}/saved-sign-in/${c.id}`,window=String(expiry);
  const prior=ledger[key],sent=prior?.window===window?[...prior.sent]:[];
  if(sent.includes(threshold))continue;
  const name=store.settings.privacyMode?privateAccountName(store.accounts,account.id):accountName(account);
  alerts.push({id:`signin-expiry:${c.id}:${window}:${threshold}`,accountId:account.id,ledgerKey:key,
   title:`${name}: sign-in expiring`,message:`Saved sign-in expires within ${threshold} hours. Open MyLimits to reconnect this account.`});
  // On late wake, send the urgent warning only; never replay the missed 48h one.
  ledger[key]={window,sent:[...new Set([...sent,...(threshold===24?[48,24]:[48])])]};
 }
 return {store:alerts.length?{...store,alertLedger:Object.fromEntries(Object.entries(ledger).slice(-6000))}:store,alerts};
}
