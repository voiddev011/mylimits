import type { ProviderId } from './model';
/** User deferred G0/G1 for coding only. No provider is activated by C9. */
export const VAULT_POLICY:Readonly<Record<ProviderId,'off'|'experimental'>>=Object.freeze({claude:'off',chatgpt:'off',cursor:'off',copilot:'off'});
/** Must come from E3, never guessed from fixtures or provider branding. */
const empty:readonly string[]=Object.freeze([]);
export const VAULT_COOKIE_ALLOWLIST:Readonly<Record<ProviderId,readonly string[]>>=Object.freeze({claude:empty,chatgpt:empty,cursor:empty,copilot:empty});
export function vaultEnabled(provider:ProviderId){return VAULT_POLICY[provider]==='experimental'&&VAULT_COOKIE_ALLOWLIST[provider].length>0;}
