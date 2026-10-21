import { websiteConnection, type Account, type Meter, type Store } from './model';
import { applySnapshot } from './engine';
import { projectAccounts } from './connections';
import type { NativeProfile } from './independent';
export interface CompanionProfile { possibleDuplicate?: boolean; independent?: Omit<NativeProfile, 'id'|'status'|'updatedAt'|'meters'|'plan'|'displayIdentity'>; id:string;status:'active'|'signed-out'|'unavailable';plan:string|null;updatedAt:number;meters:Meter[]; }
export function mergeCompanion(store:Store,profiles:CompanionProfile[],now:number):Store {
 const keep=new Set(profiles.map(p=>`openai-companion:${p.id}`));
 const removed=store.accounts.filter(a=>a.companionProfile&&!keep.has(a.id)).map(a=>a.id);
 let next:Store={...store,connections:store.connections.map(c=>c.kind==='companion'&&removed.includes(c.accountId??'')?{...c,enabled:false,status:'disabled',generation:c.enabled?c.generation+1:c.generation,message:'Disconnected; saved reading retained.'}:c)};

 for(const profile of profiles){
  const id=`openai-companion:${profile.id}`,connectionId=`companion:${profile.id}`;
  if(next.connections.some(c=>c.id===connectionId&&!c.enabled&&c.status==='disabled'&&c.accountId===null))continue;
  let prior=next.accounts.find(a=>a.id===id);
  if(!prior){prior={id,provider:'chatgpt',kind:'account',companionProfile:profile.id,alias:'',defaultName:`OpenAI ${profile.id.slice(0,4)}`,plan:profile.plan,connection:'unavailable',meters:[],createdAt:now,updatedAt:0,alertRemaining:null,alertsMuted:false};next={...next,accounts:[...next.accounts,prior]};}
  if(!next.connections.some(c=>c.id===connectionId))next={...next,connections:[...next.connections,{...websiteConnection('chatgpt'),id:connectionId,kind:'companion',accountId:id,profileId:profile.id,enabled:true,status:'unavailable'}]};
  if(profile.status==='active') next={...next,connections:next.connections.map(c=>c.id===connectionId?{...c,enabled:true}:c)};
  const conn=next.connections.find(c=>c.id===connectionId)!;
  const independent=profile.independent;
  if (independent?.alias && !prior.alias) next={...next,accounts:next.accounts.map(a=>a.id===id?{...a,alias:independent.alias}:a)};
  if(profile.status==='active'&&profile.updatedAt>0&&profile.updatedAt<=now+60000&&profile.updatedAt>prior.updatedAt){
   next=applySnapshot(next,'chatgpt',id,{kind:'account',displayName:prior.defaultName,plan:profile.plan??prior.plan,meters:profile.meters},now,{connectionId,observedAt:profile.updatedAt,generation:conn.generation});
   next={...next,accounts:next.accounts.map(a=>a.id===id?{...a,companionProfile:profile.id}:a)};
  }
  const disconnected=independent?.authState==='disconnected';
  const status=disconnected?'disabled':profile.status==='signed-out'?'needs-auth':profile.status;
  next={...next,connections:next.connections.map(c=>c.id===connectionId?{...c,status,enabled:!disconnected,independent,lastAttemptAt:independent?.lastAttemptAt??now,nextRetryAt:independent?.nextRetryAt??null,failures:independent?.failures??0,message:profile.possibleDuplicate?'Same email as another connection. Verify the intended account; workspace identity is unavailable. Profiles are not merged.':independent?.authState==='signing-in'?'Complete sign-in in the separate browser window.':independent?.authState==='verifying'?'Verifying account identity.':independent?.authState==='disconnected'?'Disconnected; saved reading retained.':independent?.errorCode==='quota-unavailable'?'Account verified; quota unavailable. Previous reading retained.':status==='active'?null:'The helper needs attention. Check Accounts.'}:c),accounts:next.accounts.map(a=>a.id===id?{...a,connection:disconnected?'inactive':profile.status}:a)};
 }
 return projectAccounts(next);
}
export function markCompanionUnavailable(store:Store):Store {
 return projectAccounts({...store,connections:store.connections.map(c=>c.kind==='companion'?{...c,status:'unavailable',message:'Companion unavailable. Website tracking is unaffected.'}:c),accounts:store.accounts.map(a=>a.companionProfile?{...a,connection:'unavailable'}:a)});
}
