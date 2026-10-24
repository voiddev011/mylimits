import type { ProviderId } from './model';
import { vaultEnabled } from './vault-policy';
export function offerSavedSignIn(provider:ProviderId,browserName:string){return browserName!=='firefox'&&vaultEnabled(provider);}
export function signInExpiry(notAfter:number|null|undefined,now:number){
 if(notAfter==null)return null;
 const days=Math.max(1,Math.ceil((notAfter-now)/86400000));
 return notAfter<=now?'Saved sign-in has expired':`Sign-in expires in ${days} ${days===1?'day':'days'}`;
}
export function privateSignInHelp(code?:string){
 return code==='incognito-access-required'?'Allow MyLimits in private windows, then retry.':code==='private-window-in-use'?'Close other private windows before starting this sign-in.':code==='site-access-required'?'Allow site and saved-sign-in access, then retry.':code==='disabled'?'Saved sign-in is not enabled for this provider. Use current browser login.':code==='setup-recovery-required'?'Cancel the pending setup to retry cleanup. Saved sign-in needs recovery.':code==='cooldown'?'The provider asked us to wait. Check again after its wait.':'Could not complete saved sign-in. Check again or cancel.';
}
