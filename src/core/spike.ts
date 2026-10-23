import { z } from 'zod';
import { ProviderSchema } from './schema';
import type { ProviderId } from './model';
import { providers } from '../providers/catalog';
export const SPIKE_MARKER='MYLIMITS_PRIVATE_SESSION_SPIKE';
export const SPIKE_PORT='mylimits-spike-v1';
export const SPIKE_RULE_ID=940001;
export const SPIKE_RULE_END=940009;
export const SPIKE_WAITS_KEY='mylimits:spike:waits:v1';
const name=z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/);
export const SpikeCommandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('cookies'),provider:ProviderSchema}).strict(),
 z.object({type:z.literal('capture'),provider:ProviderSchema,storeId:z.string().min(1).max(80),names:z.array(name).min(1).max(40),consent:z.literal(true)}).strict(),
 z.object({type:z.literal('compare'),provider:ProviderSchema}).strict(),
 z.object({type:z.literal('token'),source:z.enum(['ambient','replay'])}).strict(),
 z.object({type:z.literal('bearer')}).strict(),
 z.object({type:z.literal('observe'),provider:ProviderSchema,action:z.enum(['start','read','stop'])}).strict(),
 z.object({type:z.literal('private'),provider:ProviderSchema,action:z.enum(['open','inspect','close'])}).strict(),
 z.object({type:z.literal('clear')}).strict(),
 z.object({type:z.literal('cancel')}).strict(),
 z.object({type:z.literal('ping')}).strict(),
]);
export type SpikeCommand=z.infer<typeof SpikeCommandSchema>;
export function spikeSenderAllowed(sender:{id?:string;url?:string;tab?:{incognito?:boolean}},id:string,url:string){
 return sender.id===id&&sender.url===url&&sender.tab?.incognito!==true;
}
export interface ProbeCookie {name:string;value:string;domain:string;path:string;storeId:string;httpOnly:boolean;secure:boolean;session:boolean;expirationDate?:number;partitionKey?:unknown;}
export function cookieFlags(cookie:ProbeCookie){
 return {name:name.safeParse(cookie.name).success?cookie.name:'(invalid name)',httpOnly:cookie.httpOnly===true,secure:cookie.secure===true,session:cookie.session===true,
  expirationDate:typeof cookie.expirationDate==='number'&&Number.isFinite(cookie.expirationDate)?cookie.expirationDate:null,partitioned:cookie.partitionKey!==undefined};
}
export function setCookieNames(headers:{name:string;value?:string}[]):string[]{
 return [...new Set(headers.filter(h=>h.name.toLowerCase()==='set-cookie').flatMap(h=>{
  const candidate=h.value?.split('=',1)[0]?.trim();return name.safeParse(candidate).success?[candidate!]:[];
 }))].slice(0,40);
}
export function cookieHeader(provider:ProviderId,path:string,cookies:ProbeCookie[],now:number):string{
 const host=new URL(providers[provider].home).hostname;
 const list=cookies.filter(c=>{
  const domain=c.domain.replace(/^\./,'').toLowerCase();
  return c.partitionKey===undefined&&(host===domain||host.endsWith('.'+domain))&&c.path.startsWith('/')
   &&(path===c.path||path.startsWith(c.path)&&(c.path.endsWith('/')||path[c.path.length]==='/'))
   &&(c.expirationDate===undefined||c.expirationDate>now/1000);
 }).sort((a,b)=>b.path.length-a.path.length);
 if(list.some(c=>!name.safeParse(c.name).success||/[^\x21-\x3A\x3C-\x7E]|;/.test(c.value)))throw Error('invalid-cookie');
 const value=list.map(c=>`${c.name}=${c.value}`).join('; ');
 if(!value||new TextEncoder().encode(value).length>16384)throw Error('invalid-cookie');
 return value;
}
export function spikeRule(provider:ProviderId,extensionId:string,cookie?:string){
 if(!/^[a-p]{32}$/.test(extensionId))throw Error('unsupported-extension-origin');
 const origin=providers[provider].home;
 return {id:SPIKE_RULE_ID,priority:2,action:{type:'modifyHeaders' as const,requestHeaders:[
  ...(cookie?[{header:'cookie',operation:'set' as const,value:cookie}]:[]),
  {header:'origin',operation:'set' as const,value:origin},{header:'referer',operation:'set' as const,value:origin+'/'}]},
  condition:{requestDomains:[new URL(origin).hostname],initiatorDomains:[extensionId],resourceTypes:['xmlhttprequest' as const],tabIds:[-1]}};
}
export function tokenExpiry(token:string):number|null{
 try{const segment=token.split('.')[1];if(!segment||token.length>20000)return null;
  const raw=atob(segment.replace(/-/g,'+').replace(/_/g,'/'));const payload=JSON.parse(raw);
  return typeof payload.exp==='number'&&Number.isSafeInteger(payload.exp)&&payload.exp>0&&payload.exp<8.64e12?payload.exp*1000:null;
 }catch{return null;}
}
export function endpointAllowed(provider:ProviderId,path:string):boolean{
 const paths:Partial<Record<ProviderId,string[]>>={chatgpt:['/api/auth/session','/backend-api/wham/usage'],claude:['/api/account','/api/organizations'],
  grok:['/rest/subscriptions','/rest/rate-limits'],perplexity:['/api/auth/session','/rest/rate-limit/all'],cursor:['/api/auth/me','/api/usage-summary']};
 return paths[provider]?.includes(path)===true||provider==='claude'&&/^\/api\/organizations\/[A-Za-z0-9_-]{1,180}\/usage$/.test(path);
}
