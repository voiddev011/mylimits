import { PROVIDER_IDS, type ProviderId } from './model';
const slotPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function websiteId(provider:ProviderId){return `website:${provider}`;}
export function vaultId(provider:ProviderId,slot:string){
 if(!slotPattern.test(slot))throw new Error('Invalid saved sign-in slot.');
 return `vault:${provider}:${slot}`;
}
export function parseConnectionId(id:string):{kind:'website';provider:ProviderId}|{kind:'vault';provider:ProviderId;slot:string}|null{
 const [kind,provider,slot,...rest]=id.split(':');
 if(!PROVIDER_IDS.includes(provider as ProviderId)||rest.length)return null;
 if(kind==='website'&&slot===undefined)return {kind,provider:provider as ProviderId};
 if(kind==='vault'&&slot&&slotPattern.test(slot))return {kind,provider:provider as ProviderId,slot};
 return null;
}
