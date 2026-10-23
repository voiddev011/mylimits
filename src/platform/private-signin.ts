import type { AccountSetup,ProviderId,Store } from '../core/model';
import { websiteConnection } from '../core/model';
import { accountId,applySnapshot,type Snapshot } from '../core/engine';
import { startAccountSetup } from '../core/account-setup';
import { enableWebsite } from '../core/actions';
import { vaultId } from '../core/connection-id';
import { AccountSchema,MeterSchema } from '../core/schema';
import { PRIVATE_JOURNAL,PrivateJournalSchema,type PrivateJournal } from '../core/private-signin';
import { VaultError,validateVaultPayload,vaultNotAfter,type VaultPayload } from '../core/vault-contracts';
import { providers } from '../providers/catalog';
import { AdapterError } from '../providers/errors';
interface Tab {id?:number;windowId?:number;incognito?:boolean;cookieStoreId?:string;}
interface Cookie {name:string;value:string;domain:string;path:string;storeId:string;expirationDate?:number;partitionKey?:unknown;}
interface Window {id?:number;incognito?:boolean;tabs?:Tab[];}
interface Attempt extends PrivateJournal {abort:AbortController;task?:Promise<void>;payload?:VaultPayload;snapshot?:Snapshot;verifiedAt?:number;accountId?:string;committing:boolean;committed:boolean;}
export interface PrivateSignInPort {
 readStore():Promise<Store>;updateStore<T>(fn:(s:Store)=>{store:Store;value:T}):Promise<T>;
 enabled(p:ProviderId):boolean;allowlist(p:ProviderId):readonly string[];permitted(p:ProviderId):Promise<boolean>;allowedPrivate():Promise<boolean>;
 tabs:{query(q:Record<string,never>):Promise<Tab[]>};
 windows:{create(p:{url:string;incognito:true;type:'popup';width:number;height:number}):Promise<Window|undefined>;get(id:number,options:{populate:true}):Promise<Window>;remove(id:number):Promise<unknown>};
 cookies:{getAllCookieStores():Promise<{id:string;tabIds:number[]}[]>;getAll(p:{url:string;storeId:string}):Promise<Cookie[]>};
 session:{get(k:string):Promise<Record<string,unknown>>;set(v:Record<string,unknown>):Promise<unknown>;remove(k:string):Promise<unknown>};
 arm(expiresAt:number):Promise<void>;disarm():Promise<unknown>;uuid():string;now():number;
 verify(provider:ProviderId,slot:string,signal:AbortSignal):Promise<Snapshot>;
 put(slot:string,provider:ProviderId,payload:VaultPayload):Promise<unknown>;delete(slot:string):Promise<unknown>;
 accepted(accountId:string,connectionId:string):Promise<void>;
}
const currentWarning='Signing out of the website will probably end this connection.';
function message(code:string){return code==='duplicate-account'?'This account already has a saved connection.':code==='cooldown'||code==='rate-limit'?'The provider asked us to wait before checking again.':code==='challenge'?'Complete the browser check, then check again.':code==='wrong-account'?'The account changed. Check it again before saving.':'Saved sign-in could not be verified. Check again or cancel.';}
/** The only cookie values/payloads live here until explicit confirmation. Browser APIs are injected. */
export function createPrivateSignIn(port:PrivateSignInPort){
 let active:Attempt|undefined,failed:Attempt|undefined,initializing:Promise<void>|undefined,retiring:Promise<void>|undefined;
 const alive=(a:Attempt)=>active===a&&!a.abort.signal.aborted&&port.now()<a.expiresAt;
 function check(a:Attempt){if(!alive(a))throw new VaultError('cancelled');}
 async function patch(a:Attempt,fields:Partial<AccountSetup>){await port.updateStore(s=>({store:s.accountSetup?.id===a.id?{...s,accountSetup:{...s.accountSetup,...fields}}:s,value:undefined}));}
 async function close(a:PrivateJournal){if(a.windowId===undefined||a.tabId===undefined)return;try{const w=await port.windows.get(a.windowId,{populate:true});if(w.incognito===true&&w.tabs?.some(t=>t.id===a.tabId))await port.windows.remove(a.windowId);}catch{/* Already closed or ownership cannot be proved. */}}
 async function clearJournal(a:PrivateJournal){const saved=(await port.session.get(PRIVATE_JOURNAL))[PRIVATE_JOURNAL];const parsed=PrivateJournalSchema.safeParse(saved,{jitless:true});if(parsed.success&&parsed.data.id===a.id)await port.session.remove(PRIVATE_JOURNAL);}
 function retire(a:Attempt):Promise<void>{
  if(retiring)return retiring;
  if(!a.committing){a.abort.abort();if(active===a)active=undefined;}
  return retiring=(async()=>{
   try{
    await a.task?.catch(()=>{});if(active===a)active=undefined;a.abort.abort();a.payload=undefined;a.snapshot=undefined;
    let error=false;
    if(!a.committed)try{await port.delete(a.slot);await port.updateStore(s=>({store:{...s,connections:s.connections.filter(c=>c.id!==vaultId(a.provider,a.slot)),accountSetup:s.accountSetup?.id===a.id?null:s.accountSetup},value:undefined}));}catch{error=true;}
    await close(a);try{await port.disarm();if(!error)await clearJournal(a);}catch{error=true;}
    if(error){failed=a;throw new VaultError('setup-recovery-required');}failed=undefined;
   }finally{retiring=undefined;}
  })();
 }
 async function storeFor(a:Attempt):Promise<string>{
  const [tabs,stores]=await Promise.all([port.tabs.query({}),port.cookies.getAllCookieStores()]);check(a);
  if(a.method==='current'){
   const normal=tabs.filter(t=>t.id!==undefined&&t.incognito===false&&(!t.cookieStoreId||t.cookieStoreId==='firefox-default'));
   const matches=stores.filter(s=>s.tabIds.some(id=>normal.some(t=>t.id===id)));
   if(matches.length!==1)throw new VaultError('store-unavailable');return matches[0]!.id;
  }
  const own=tabs.find(t=>t.id===a.tabId&&t.windowId===a.windowId&&t.incognito===true);
  const matches=stores.filter(s=>s.tabIds.includes(a.tabId??-1));
  if(!own||matches.length!==1)throw new VaultError('store-unavailable');const store=matches[0]!;
  if(store.tabIds.some(id=>{const tab=tabs.find(t=>t.id===id);return !tab||tab.incognito!==true||tab.windowId!==a.windowId;}))throw new VaultError('private-window-in-use');
  return store.id;
 }
 async function capture(a:Attempt):Promise<VaultPayload|null>{
  if(!port.enabled(a.provider)||!await port.permitted(a.provider))throw new VaultError('disabled');check(a);
  const storeId=await storeFor(a),cookies=await port.cookies.getAll({url:providers[a.provider].home,storeId});check(a);
  const names=port.allowlist(a.provider),host=new URL(providers[a.provider].home).hostname;
  const selected=cookies.filter(c=>names.includes(c.name));
  if(selected.some(c=>c.storeId!==storeId||c.path!=='/'||c.partitionKey!==undefined||!(host===c.domain.replace(/^\./,'')||host.endsWith('.'+c.domain.replace(/^\./,'')))))throw new VaultError('capture-unavailable');
  const valid=selected.filter(c=>c.expirationDate===undefined||c.expirationDate>port.now()/1000);
  if(!valid.length)return null;
  return validateVaultPayload(a.provider,{v:1,origin:providers[a.provider].home,cookies:valid.map(c=>({name:c.name,value:c.value,...(c.expirationDate===undefined?{}:{expirationDate:c.expirationDate})}))},names);
 }
 async function runCheck(a:Attempt){
  check(a);if(a.task)return a.task;
  const task=(async()=>{
   a.payload=undefined;a.snapshot=undefined;a.accountId=undefined;
   try{
    await patch(a,{candidate:undefined,phase:'verifying',message:a.method==='current'?currentWarning:null});
    const payload=await capture(a);check(a);
    if(!payload){await patch(a,{phase:'signing-in'});return;}a.payload=payload;
    const snapshot=await port.verify(a.provider,a.slot,a.abort.signal);check(a);
    if(snapshot.kind!=='account'||!snapshot.identity)throw new VaultError('identity');
    const s=await port.readStore(),id=await accountId(a.provider,snapshot.identity,s.installSalt);check(a);
    if(s.connections.some(c=>c.kind==='vault'&&c.profileId!==a.slot&&c.accountId===id))throw new VaultError('duplicate-account');
    snapshot.meters=snapshot.meters.map(m=>MeterSchema.parse(m,{jitless:true}));
    a.snapshot=snapshot;a.accountId=id;a.verifiedAt=port.now();
    await patch(a,{phase:'awaiting-confirmation',candidate:{accountId:id,name:snapshot.displayName.slice(0,120),plan:snapshot.plan?.slice(0,80)??null,verifiedAt:a.verifiedAt},message:a.method==='current'?currentWarning:null});
   }catch(e){a.payload=undefined;a.snapshot=undefined;a.accountId=undefined;if(alive(a))await patch(a,{candidate:undefined,phase:'error',message:message(e instanceof VaultError||e instanceof AdapterError?e.code:'unavailable')});}
  })();a.task=task;try{await task;}finally{if(a.task===task)a.task=undefined;}
 }
 async function initialize(){return initializing??=(async()=>{
  const raw=(await port.session.get(PRIVATE_JOURNAL))[PRIVATE_JOURNAL];
  if(raw===undefined){
   // Browser exit clears storage.session but not the local pending setup. No window ownership remains.
   const s=await port.readStore(),setup=s.accountSetup;
   if(setup?.method==='private'&&setup.phase&&setup.slotId){
    const id=vaultId(setup.provider,setup.slotId),c=s.connections.find(c=>c.id===id);
    if(!c?.accountId)await port.delete(setup.slotId);
    await port.updateStore(current=>({store:current.accountSetup?.id!==setup.id?current:{...current,accountSetup:null,
     connections:current.connections.filter(c=>c.id!==id||!!c.accountId)},value:undefined}));
    await port.disarm();
   }
   return;
  }
  const parsed=PrivateJournalSchema.safeParse(raw,{jitless:true});if(!parsed.success)throw new VaultError('setup-recovery-required');
  const j=parsed.data,s=await port.readStore(),c=s.connections.find(c=>c.id===vaultId(j.provider,j.slot));
  const a:Attempt={...j,abort:new AbortController(),committing:false,committed:!!(c?.enabled&&c.accountId&&s.accountSetup?.id!==j.id)};active=a;
  if(a.committed||s.accountSetup?.id!==a.id||!port.enabled(a.provider)||port.now()>=a.expiresAt){await retire(a);return;}
  try{await storeFor(a);await port.arm(a.expiresAt);await patch(a,{candidate:undefined,phase:'signing-in'});void runCheck(a).catch(()=>{});}
  catch{await retire(a);}
 })();}
 async function start(provider:ProviderId,method:'private'|'current',nickname:string){
  await initialize();if(failed)throw new VaultError('setup-recovery-required');if(active||retiring)throw new VaultError('setup-in-progress');if(!port.enabled(provider)||!port.allowlist(provider).length)throw new VaultError('disabled');
  const a:Attempt={version:1,id:port.uuid(),slot:port.uuid(),provider,method,expiresAt:port.now()+600000,abort:new AbortController(),committing:false,committed:false};active=a;
  const task=(async()=>{
   if(!await port.permitted(provider))throw new VaultError('site-access-required');check(a);
   if((await port.readStore()).accountSetup)throw new VaultError('setup-in-progress');
   if(method==='private'){
    if(!await port.allowedPrivate())throw new VaultError('incognito-access-required');check(a);
    if((await port.tabs.query({})).some(t=>t.incognito===true))throw new VaultError('private-window-in-use');check(a);
    const w=await port.windows.create({url:providers[provider].home,incognito:true,type:'popup',width:520,height:740});
    if(w?.id===undefined||w.tabs?.[0]?.id===undefined)throw new VaultError('window-unavailable');a.windowId=w.id;a.tabId=w.tabs[0].id;check(a);
   }
   await storeFor(a);check(a);
   const journal={version:1 as const,id:a.id,slot:a.slot,provider,method,expiresAt:a.expiresAt,...(a.windowId===undefined?{}:{windowId:a.windowId,tabId:a.tabId})};
   await port.session.set({[PRIVATE_JOURNAL]:journal});check(a);await port.arm(a.expiresAt);check(a);
   await port.updateStore(s=>{
    check(a);if(s.accountSetup)throw new VaultError('setup-in-progress');
    const c={...websiteConnection(provider),id:vaultId(provider,a.slot),kind:'vault' as const,profileId:a.slot,status:'checking' as const};
    const next=startAccountSetup({...s,connections:[...s.connections,c]},provider,'detect',nickname,a.id,port.now(),{method:'private',slotId:a.slot});
    next.accountSetup={...next.accountSetup!,captureMethod:method,phase:'signing-in',message:method==='current'?currentWarning:null};return {store:next,value:undefined};
   });
  })();a.task=task;
  try{await task;a.task=undefined;check(a);void runCheck(a).catch(()=>{});return a.id;}
  catch(e){a.task=undefined;await retire(a);if(e instanceof VaultError)throw e;throw new VaultError('setup-unavailable');}
 }
 async function save(id:string,selectedId:string,consent:boolean,nickname?:string){
  await initialize();const a=active;if(!a||a.id!==id||!consent||!a.snapshot||!a.payload||a.accountId!==selectedId||a.task)throw new VaultError('confirmation-required');check(a);
  const task=(async()=>{
   const fresh=await capture(a);check(a);if(JSON.stringify(fresh)!==JSON.stringify(a.payload)){a.payload=undefined;a.snapshot=undefined;await patch(a,{candidate:undefined,phase:'error',message:message('wrong-account')});throw new VaultError('wrong-account');}
   await port.put(a.slot,a.provider,a.payload!);check(a);
   const snapshot=a.snapshot!,notAfter=vaultNotAfter(a.payload!),choices=await Promise.all((snapshot.workspaces??[]).map(async w=>({id:await accountId(a.provider,`workspace:${w.identity}`,(await port.readStore()).installSalt),provider:a.provider,remoteId:w.identity,name:w.name})));check(a);
   const accepted=await port.updateStore(s=>{
    check(a);if(s.accountSetup?.id!==a.id||s.connections.some(c=>c.kind==='vault'&&c.profileId!==a.slot&&c.accountId===selectedId))throw new VaultError('duplicate-account');
    const c=s.connections.find(c=>c.id===vaultId(a.provider,a.slot));if(!c||c.enabled||c.generation!==0)throw new VaultError('cancelled');a.committing=true;
    const workspaceId=choices.find(w=>w.remoteId===snapshot.workspace?.identity)?.id??null;
    let base:Store={...s,accountSetup:null,workspaces:[...s.workspaces.filter(w=>!choices.some(v=>v.id===w.id)),...choices],connections:s.connections.map(v=>v.id===c.id?{...v,enabled:true,workspaceIds:choices.map(w=>w.id),savedSignIn:{method:a.method,notAfter}}:v)};
    // Convert only a matching verified identity; another browser account remains untouched.
    if(s.connections.some(v=>v.kind==='website'&&v.provider===a.provider&&v.accountId===selectedId))base=enableWebsite(base,a.provider,false);
    let next=applySnapshot(base,a.provider,selectedId,snapshot,port.now(),{connectionId:c.id,workspaceId,observedAt:a.verifiedAt,generation:c.generation});
    next={...next,accounts:next.accounts.map(v=>v.id===selectedId?{...v,alias:(nickname??s.accountSetup!.nickname).trim()||v.alias}:v)};AccountSchema.parse(next.accounts.find(v=>v.id===selectedId),{jitless:true});return {store:next,value:true};
   });a.committed=accepted;
  })();a.task=task;
  try{await task;await retire(a);await port.accepted(selectedId,vaultId(a.provider,a.slot)).catch(()=>{});}
  catch(e){await retire(a);if(e instanceof VaultError)throw e;throw new VaultError('confirmation-failed');}
 }
 return {initialize,start,save,
  async check(id:string){await initialize();const a=active;if(!a||a.id!==id)throw new VaultError('setup-unavailable');await runCheck(a);},
  async cancel(id:string){await initialize();if(active?.id===id)await retire(active);else if(failed?.id===id)await retire(failed);else if(retiring)await retiring;},
  async expire(){await initialize();if(active&&port.now()>=active.expiresAt)await retire(active);},
  async cookieChanged(event:{removed:boolean;cookie:Cookie}){
   await initialize();const a=active;if(!a||a.task||a.committing||!port.allowlist(a.provider).includes(event.cookie.name))return;
   const domain=event.cookie.domain.replace(/^\./,''),host=new URL(providers[a.provider].home).hostname;if(host!==domain&&!host.endsWith('.'+domain))return;
   try{if(event.cookie.storeId!==await storeFor(a))return;if(event.removed){a.payload=undefined;a.snapshot=undefined;await patch(a,{candidate:undefined,phase:'signing-in'});}else await runCheck(a);}catch{/* A changed/closed store cannot authorize a capture. */}
  },
  async windowRemoved(id:number){await initialize();if(active?.windowId===id)await retire(active);},
  /** Worker-internal only; never return this through runtime messages. */
  pendingPayload(slot:string){const a=active;return a&&alive(a)&&a.slot===slot?a.payload:undefined;},
 };
}
