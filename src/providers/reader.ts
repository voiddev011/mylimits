import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';
import { object, parseClaude, parseChatGPT } from './parsers';
import { AdapterError } from './errors';
export interface ReaderOptions { workspaceRemoteId?: string | null; }
export type ReadJSON=(path:string,headers?:Record<string,string>)=>Promise<unknown>;
export async function readAccountProvider(provider:ProviderId,options:ReaderOptions,read:ReadJSON):Promise<Snapshot>{
 if(provider==='claude'){
  const account=await read('/api/account'); const organizations=await read('/api/organizations');
  const list=(Array.isArray(organizations)?organizations.map(object):[]).filter(o=>typeof o.uuid==='string'&&o.uuid.length>0&&o.uuid.length<=180&&(!Array.isArray(o.capabilities)||o.capabilities.includes('chat')));
  const organization=options.workspaceRemoteId?list.find(o=>o.uuid===options.workspaceRemoteId):list[0];
  if(!organization)throw new AdapterError('unavailable',options.workspaceRemoteId?'The selected workspace is unavailable. Choose Default workspace and refresh.':'No eligible Claude workspace could be verified.',null,'scope');
  try{parseClaude(account,organization,{})}catch{throw new AdapterError('unavailable','Claude account identity could not be verified.',null,'identity')}
  const usage=await read(`/api/organizations/${encodeURIComponent(String(organization.uuid))}/usage`);
  try{return {...parseClaude(account,organization,usage),workspace:{identity:String(organization.uuid),name:workspaceName(organization.name,1)},workspaces:list.map((o,i)=>({identity:String(o.uuid),name:workspaceName(o.name,i+1)}))};}
  catch{throw new AdapterError('unavailable','Claude usage format could not be verified.',null,'shape')}
 }
 if(provider==='chatgpt'){
  const session=object(await read('/api/auth/session'));
  if(typeof session.accessToken!=='string'||!session.accessToken)throw new AdapterError('signed-out','Sign in on ChatGPT, then reconnect.');
  const usage=await read('/backend-api/wham/usage',{Authorization:`Bearer ${session.accessToken}`});
  try{return parseChatGPT(session,usage)}catch{throw new AdapterError('unavailable','ChatGPT account identity or usage format could not be verified.',null,'shape')}
 }
 return {identity:'local-browser-activity',kind:'browser',displayName:`${providers[provider].name} · This browser`,plan:null,meters:[]};
}
function workspaceName(value:unknown,index:number){return typeof value==='string'&&value.trim()&&!value.includes('@')?value.trim().slice(0,120):`Workspace ${index}`;}
