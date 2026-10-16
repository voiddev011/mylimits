import type pg from 'pg';
import { SyncBatchSchema, type SyncItem } from '../../src/core/sync-contracts';
import { transaction,uuid,hash,type DB } from './db';
import { ApiError,opaque,requireWeb,type Principal } from './auth';

export async function registerDevice(db:DB,p:Principal,name:string){
 requireWeb(p);await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[p.owner]);const counts=(await db.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE revoked_at IS NULL)::int AS active FROM devices WHERE owner_id=$1',[p.owner])).rows[0];if(counts.total>=200||counts.active>=20)throw new ApiError(409,'device_capacity_reached');const id=uuid(),token=`ml_device_${opaque()}`;
 await db.query('INSERT INTO devices(id,owner_id,name,token_hash) VALUES($1,$2,$3,$4)',[id,p.owner,name,hash(token)]);
 return {id,token,name};
}
export async function upload(pool:pg.Pool,p:Principal,raw:unknown,now=Date.now()){
 const input=SyncBatchSchema.parse(raw);
 if(p.kind==='device'&&p.deviceId!==input.deviceId)throw new ApiError(403,'wrong_device');
 return transaction(pool,async db=>{
  await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[p.owner]);
  const device=await db.query('SELECT id FROM devices WHERE owner_id=$1 AND id=$2 AND revoked_at IS NULL FOR UPDATE',[p.owner,input.deviceId]);
  if(!device.rows.length)throw new ApiError(403,'unknown_device');
  const accepted:{snapshotId:string;accountId:string;connectionId:string;duplicate:boolean}[]=[];
  for(const item of input.items){
   const s=item.snapshot;
   if((await db.query('SELECT 1 FROM source_tombstones WHERE owner_id=$1 AND device_id=$2 AND source_id=$3',[p.owner,input.deviceId,s.accountId])).rows.length)throw new ApiError(410,'account_deleted');
   if(s.observedAt>now+60000||s.receivedAt>now+60000||s.observedAt<now-90*86400000)throw new ApiError(400,'invalid_reading_time');
   const known=(await db.query('SELECT id FROM accounts WHERE owner_id=$1 AND device_id=$2 AND source_id=$3',[p.owner,input.deviceId,s.accountId])).rows.length;
   if(!known){const counts=(await db.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE deleted_at IS NULL)::int AS active FROM accounts WHERE owner_id=$1',[p.owner])).rows[0];if(counts.total>=1000||counts.active>=100)throw new ApiError(409,'account_capacity_reached');}
   await db.query('INSERT INTO accounts(id,owner_id,device_id,source_id,provider,name,plan) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,device_id,source_id) DO NOTHING',[uuid(),p.owner,input.deviceId,s.accountId,s.providerId,item.account.name,item.account.plan]);
   const account=(await db.query('SELECT * FROM accounts WHERE owner_id=$1 AND device_id=$2 AND source_id=$3 FOR UPDATE',[p.owner,input.deviceId,s.accountId])).rows[0];
   if(account.deleted_at)throw new ApiError(410,'account_deleted');
   if(account.provider!==s.providerId)throw new ApiError(409,'source_identity_conflict');
   const sourceKnown=(await db.query('SELECT id FROM connections WHERE owner_id=$1 AND account_id=$2 AND device_id=$3 AND source_id=$4',[p.owner,account.id,input.deviceId,s.connectionId])).rows.length;
   if(!sourceKnown&&(await db.query('SELECT count(*)::int AS n FROM connections WHERE owner_id=$1',[p.owner])).rows[0].n>=2000)throw new ApiError(409,'source_capacity_reached');
   await db.query('INSERT INTO connections(id,owner_id,account_id,device_id,source_id,workspace_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_id,device_id,source_id,account_id) DO NOTHING',[uuid(),p.owner,account.id,input.deviceId,s.connectionId,s.workspaceId]);
   const conn=(await db.query('SELECT * FROM connections WHERE owner_id=$1 AND account_id=$2 AND device_id=$3 AND source_id=$4 FOR UPDATE',[p.owner,account.id,input.deviceId,s.connectionId])).rows[0];
   if(!conn.enabled)throw new ApiError(410,'connection_deleted');
   const previous=await db.query('SELECT payload,account_id,connection_id FROM snapshots WHERE owner_id=$1 AND device_id=$2 AND source_snapshot_id=$3',[p.owner,input.deviceId,s.snapshotId]);
   if(previous.rows.length){const old=previous.rows[0];if(old.account_id!==account.id||old.connection_id!==conn.id||hash(JSON.stringify(old.payload))!==hash(JSON.stringify(JSON.parse(JSON.stringify(s))))) {
     // jsonb reorders object keys; compare structurally, not by transport key order.
     const canonical=(v:unknown):string=>JSON.stringify(v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(canonical(x))])):Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v);
     if(old.account_id!==account.id||old.connection_id!==conn.id||canonical(old.payload)!==canonical(s))throw new ApiError(409,'snapshot_identity_conflict');
    }
    accepted.push({snapshotId:s.snapshotId,accountId:account.id,connectionId:conn.id,duplicate:true});continue;
   }
   await db.query('INSERT INTO snapshots(id,owner_id,account_id,connection_id,device_id,source_snapshot_id,observed_at,received_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[uuid(),p.owner,account.id,conn.id,input.deviceId,s.snapshotId,s.observedAt,now,JSON.stringify(s)]);
   accepted.push({snapshotId:s.snapshotId,accountId:account.id,connectionId:conn.id,duplicate:false});
  }
  await pruneSnapshots(db,p.owner,now);await boundSnapshots(db,p.owner);
  return {accepted,mode:'snapshot-only' as const};
 });
}
export async function accounts(db:DB,p:Principal){
 const result=await db.query(`SELECT a.id,a.provider,a.name,a.plan,d.name AS device_name,d.revoked_at,c.id AS connection_id,c.enabled,s.observed_at
 FROM accounts a JOIN devices d ON d.owner_id=a.owner_id AND d.id=a.device_id
 JOIN LATERAL (SELECT * FROM connections c WHERE c.owner_id=a.owner_id AND c.account_id=a.id ORDER BY c.enabled DESC,c.created_at DESC LIMIT 1) c ON true
 LEFT JOIN LATERAL (SELECT observed_at FROM snapshots s WHERE s.owner_id=a.owner_id AND s.account_id=a.id ORDER BY observed_at DESC,id DESC LIMIT 1) s ON true
 WHERE a.owner_id=$1 AND a.deleted_at IS NULL ORDER BY a.created_at,a.id`,[p.owner]);
 return result.rows.map(r=>({id:r.id,provider:r.provider,name:r.name,plan:r.plan,deviceName:r.device_name,connectionId:r.connection_id,observedAt:r.observed_at===null?null:Number(r.observed_at),status:r.enabled&&!r.revoked_at?'snapshot-only':'disabled'}));
}
export async function snapshots(db:DB,p:Principal,q:{accountId:string;limit:number;before?:{time:number;id:string};from?:number;to?:number}){
 const result=await db.query(`SELECT s.* FROM snapshots s JOIN accounts a ON a.owner_id=s.owner_id AND a.id=s.account_id
 WHERE s.owner_id=$1 AND s.account_id=$2 AND a.deleted_at IS NULL AND s.observed_at >= $3 AND s.observed_at <= $4
 AND (s.observed_at<$5 OR (s.observed_at=$5 AND s.id<$6::uuid)) ORDER BY s.observed_at DESC,s.id DESC LIMIT $7`,[p.owner,q.accountId,q.from??0,q.to??8.64e15,q.before?.time??8.64e15,q.before?.id??'ffffffff-ffff-ffff-ffff-ffffffffffff',q.limit+1]);
 const hasMore=result.rows.length>q.limit,rows=result.rows.slice(0,q.limit),last=rows.at(-1);
 return {points:rows.map(r=>({id:r.id,accountId:r.account_id,connectionId:r.connection_id,observedAt:Number(r.observed_at),serverReceivedAt:Number(r.received_at),snapshot:r.payload})),hasMore,cursor:hasMore&&last?{time:Number(last.observed_at),id:last.id}:null};
}
export async function deleteAccountInTransaction(db:DB,p:Principal,id:string){
  await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE',[p.owner]);
  const r=await db.query('SELECT device_id FROM accounts WHERE owner_id=$1 AND id=$2 FOR UPDATE',[p.owner,id]);
  if(!r.rows.length)throw new ApiError(404,'account_not_found');if(p.kind==='device'&&p.deviceId!==r.rows[0].device_id)throw new ApiError(403,'wrong_device');
  await db.query('UPDATE accounts SET deleted_at=now(),name=$3,plan=NULL WHERE owner_id=$1 AND id=$2',[p.owner,id,'Deleted account']);
  await db.query("UPDATE connections SET enabled=false,generation=generation+1,status='disabled' WHERE owner_id=$1 AND account_id=$2",[p.owner,id]);
  await db.query("DELETE FROM jobs WHERE owner_id=$1 AND connection_id IN (SELECT id FROM connections WHERE owner_id=$1 AND account_id=$2)",[p.owner,id]);
  for(const table of ['encrypted_credentials','connection_cleanup'])await db.query(`DELETE FROM ${table} WHERE owner_id=$1 AND connection_id IN (SELECT id FROM connections WHERE owner_id=$1 AND account_id=$2)`,[p.owner,id]);
  await db.query('DELETE FROM snapshots WHERE owner_id=$1 AND account_id=$2',[p.owner,id]);
  await db.query('UPDATE preferences SET data=jsonb_set(data,\'{names}\',COALESCE(data->\'names\',\'{}\')-$2::text),revision=revision+1 WHERE owner_id=$1',[p.owner,id]);
}
export async function deleteAccount(pool:pg.Pool,p:Principal,id:string){return transaction(pool,db=>deleteAccountInTransaction(db,p,id))}

// Preserve one last-known reading per source for the dashboard; prune older history.
export async function pruneSnapshots(db:DB,owner:string,now=Date.now()){
 const preference=(await db.query('SELECT data FROM preferences WHERE owner_id=$1',[owner])).rows[0]?.data;
 const days=preference?.settings?.historyRetentionDays===90?90:30;
 await db.query(`DELETE FROM snapshots s WHERE owner_id=$1 AND observed_at<$2
 AND EXISTS (SELECT 1 FROM snapshots newer WHERE newer.owner_id=s.owner_id AND newer.connection_id=s.connection_id
 AND (newer.observed_at>s.observed_at OR (newer.observed_at=s.observed_at AND newer.id>s.id)))`,[owner,now-days*86400000]);
}

export async function boundSnapshots(db:DB,owner:string){
 await db.query(`DELETE FROM snapshots WHERE id IN (SELECT s.id FROM snapshots s WHERE s.owner_id=$1
 AND EXISTS (SELECT 1 FROM snapshots newer WHERE newer.owner_id=s.owner_id AND newer.connection_id=s.connection_id AND (newer.observed_at>s.observed_at OR (newer.observed_at=s.observed_at AND newer.id>s.id)))
 ORDER BY observed_at DESC,id DESC OFFSET 20000)`,[owner]);
}
