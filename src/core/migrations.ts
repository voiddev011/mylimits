import { emptyStore, type Store, type ConnectionStatus } from './model';
import { StoreSchema } from './schema';
import { V1StoreSchema } from './v1-schema';
export const STATE_V1='mylimits:state:v1';
export const STATE_V2='mylimits:state:v2';
export const ACTIVE_SCHEMA='mylimits:active-schema';
export const BACKUP_V1='mylimits:backup:v1';
export const MIGRATION='mylimits:migration:v2';
export interface StoragePort { get(keys: string | string[]): Promise<Record<string, unknown>>; set(items: Record<string,unknown>): Promise<void>; }
const lifecycle: Record<string,ConnectionStatus>={active:'active',inactive:'disabled','signed-out':'needs-auth','waiting-for-tab':'needs-tab',unavailable:'unavailable',error:'error',disabled:'disabled',checking:'checking'};
export function migrateV1(raw: unknown): Store {
 const old=V1StoreSchema.parse(raw); const base=emptyStore(old.installSalt);
 const next:Store={...base,...old,version:2,settings:{...base.settings,...old.settings},connections:base.connections,
  accounts:old.accounts.map((a,i)=>({...a,order:i,pinned:false,pinnedMeterIds:[],snoozedUntil:null,workspaceId:null})), snapshots:[],workspaces:[],historyIssue:null};
 next.connections=next.connections.map(c=>{const p=old.providers[c.provider];return {...c,enabled:p.enabled,status:lifecycle[p.status]??'unavailable',accountId:p.activeAccountId,
  lastAttemptAt:p.checkedAt,lastSuccessAt:old.accounts.find(a=>a.id===p.activeAccountId)?.updatedAt??null,nextRetryAt:p.nextRetryAt,failures:p.failures,message:p.message};});
 for(const a of next.accounts){
  const id=a.companionProfile?`companion:${a.companionProfile}`:`website:${a.provider}`;
  if(a.companionProfile)next.connections.push({id,provider:a.provider,kind:'companion',accountId:a.id,workspaceId:null,workspaceIds:[],profileId:a.companionProfile,
   enabled:a.connection!=='inactive',status:lifecycle[a.connection]??'unavailable',generation:0,lastAttemptAt:null,lastSuccessAt:a.updatedAt,nextRetryAt:null,failures:0,message:null});
  if(a.updatedAt>0)next.snapshots.push({schemaVersion:2,snapshotId:`legacy:${a.id}`,providerId:a.provider,accountId:a.id,connectionId:id,workspaceId:null,
   observedAt:a.updatedAt,receivedAt:a.updatedAt,connectorVersion:'legacy-v1',meters:a.meters.map(m=>({...m,observedAt:a.updatedAt,connectionId:id}))});
 }
 return StoreSchema.parse(next);
}
// Browser storage and IndexedDB have separate transactions. A durable journal
// retries each idempotent step; the active pointer is the final commit marker.
export async function initializeV2(storage:StoragePort, migrateHistory:()=>Promise<void>, salt:()=>string):Promise<void>{
 const saved=await storage.get([ACTIVE_SCHEMA,STATE_V1,STATE_V2,MIGRATION,BACKUP_V1]);
 if(saved[ACTIVE_SCHEMA]!==undefined&&saved[ACTIVE_SCHEMA]!==1&&saved[ACTIVE_SCHEMA]!==2)throw new Error('This MyLimits data version is newer than this extension. Update before opening it.');
 if(saved[ACTIVE_SCHEMA]===2){StoreSchema.parse(saved[STATE_V2]);await migrateHistory();return;}
 const legacy=saved[STATE_V1];
 if(legacy!==undefined)V1StoreSchema.parse(legacy); // Never replace malformed saved data.
 const next=saved[STATE_V2]!==undefined?StoreSchema.parse(saved[STATE_V2]):legacy===undefined?emptyStore(salt()):migrateV1(legacy);
 if(legacy!==undefined&&saved[BACKUP_V1]===undefined)await storage.set({[BACKUP_V1]:structuredClone(legacy)});
 await storage.set({[MIGRATION]:{stage:'prepared',version:2}});
 await storage.set({[STATE_V2]:StoreSchema.parse(next),[MIGRATION]:{stage:'state-written',version:2}});
 await migrateHistory();
 await storage.set({[MIGRATION]:{stage:'history-ready',version:2}});
 const durable=await storage.get(STATE_V2);StoreSchema.parse(durable[STATE_V2]);
 await storage.set({[ACTIVE_SCHEMA]:2,[MIGRATION]:{stage:'completed',version:2}});
}
