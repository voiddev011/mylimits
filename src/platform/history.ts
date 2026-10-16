import { publicHistory, type HistoryPoint, type HistoryPage, type HistoryQuery } from '../core/history-data';
export type { HistoryPoint, HistoryPage, HistoryQuery } from '../core/history-data';
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const request=indexedDB.open('mylimits-history',2);
 request.onupgradeneeded=()=>{
  const db=request.result;const store=db.objectStoreNames.contains('readings')?request.transaction!.objectStore('readings'):db.createObjectStore('readings',{keyPath:'id',autoIncrement:true});
  if(!store.indexNames.contains('account'))store.createIndex('account','accountId');if(!store.indexNames.contains('time'))store.createIndex('time','time');
  if(!store.indexNames.contains('snapshotKey'))store.createIndex('snapshotKey','snapshotKey',{unique:true});
  if(!store.indexNames.contains('account-time'))store.createIndex('account-time',['accountId','time']);
  const cursor=store.openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(row){if(!row.value.schemaVersion)row.update({...row.value,schemaVersion:2,observedAt:row.value.time,receivedAt:row.value.time,connectionId:'legacy',legacy:true});row.continue();}};
 };
 request.onblocked=()=>reject(new Error('Close other MyLimits tabs and retry the history upgrade.'));
 request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
 request.onerror=()=>reject(new Error('Local history could not be opened.'));
});}
export async function ensureHistory(){const db=await database();db.close();}
export async function saveHistory(point:HistoryPoint,retentionDays:30|90=30):Promise<void>{
 const safe=publicHistory(point);const cutoff=Date.now()-retentionDays*86400000;if(safe.time<cutoff)return;
 const db=await database();try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('readings','readwrite'),store=tx.objectStore('readings');
  const snapshotKey=point.snapshotKey??`${point.accountId}/${point.connectionId??'legacy'}/${point.time}/${JSON.stringify(safe.meters)}`;
  const get=store.index('snapshotKey').getKey(snapshotKey);get.onsuccess=()=>{if(get.result===undefined)store.add({...Object.fromEntries(Object.entries(safe).filter(([key])=>key!=='id')),snapshotKey});};
  const cursor=store.index('time').openCursor(IDBKeyRange.upperBound(cutoff,true));cursor.onsuccess=()=>{const row=cursor.result;if(row){row.delete();row.continue();}};
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Local history could not be saved.'));tx.onabort=()=>reject(new Error('History write interrupted.'));
 });}finally{db.close();}
}
export async function readHistoryPage(query:HistoryQuery):Promise<HistoryPage>{
 const limit=Math.max(1,Math.min(200,query.limit??48));const from=query.from??0,to=Math.min(query.to??8.64e15,query.before?.time??8.64e15);
 if(from>to)return {points:[],cursor:null,hasMore:false};
 const db=await database();try{return await new Promise<HistoryPage>((resolve,reject)=>{
  const points:HistoryPoint[]=[];const tx=db.transaction('readings','readonly');const request=tx.objectStore('readings').index('account-time').openCursor(IDBKeyRange.bound([query.accountId,from],[query.accountId,to]),'prev');
  request.onsuccess=()=>{const row=request.result;if(!row)return;const value=row.value as HistoryPoint;
   if(query.before&&value.time===query.before.time&&(Number(value.id)||0)>=query.before.id){row.continue();return}
   try { points.push(publicHistory(value)); if(points.length<=limit)row.continue(); } catch { tx.abort(); reject(new Error('A saved history row could not be validated.')); }};
  tx.oncomplete=()=>{const hasMore=points.length>limit;const page=points.slice(0,limit),last=page.at(-1);resolve({points:page,cursor:hasMore&&last?{time:last.time,id:last.id!}:null,hasMore})};
  tx.onerror=()=>reject(new Error('Local history could not be read.'));
 });}finally{db.close();}
}
export async function readHistory(accountId:string):Promise<HistoryPoint[]>{return (await readHistoryPage({accountId})).points.reverse();}
export async function clearHistory(accountId?:string):Promise<void>{
 const db=await database();try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('readings','readwrite'),store=tx.objectStore('readings');
  if(accountId){const cursor=store.index('account').openCursor(IDBKeyRange.only(accountId));cursor.onsuccess=()=>{const row=cursor.result;if(row){row.delete();row.continue();}};}else store.clear();
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Local history could not be removed.'));
 });}finally{db.close();}
}
export const removeHistory=clearHistory;
export async function historyExport(accountIds:string[],from?:number,to?:number):Promise<HistoryPoint[]>{
 const result:HistoryPoint[]=[];
 for(const accountId of accountIds){let before:HistoryQuery['before'];do{const page=await readHistoryPage({accountId,from,to,before,limit:200});result.push(...page.points);before=page.cursor??undefined;if(result.length>50000)throw new Error('Export is too large. Choose a shorter date range.');}while(before);}
 return result;
}

export async function readHistorySeries(query:HistoryQuery){
 const points:HistoryPoint[]=[];let before:HistoryQuery['before'];let hasMore=false;
 do{const page=await readHistoryPage({...query,before,limit:200});points.push(...page.points);before=page.cursor??undefined;hasMore=page.hasMore;}while(before&&points.length<5000);
 return {points,truncated:hasMore};
}
export async function pruneHistory(retentionDays:30|90){
 const db=await database();try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('readings','readwrite');const cursor=tx.objectStore('readings').index('time').openCursor(IDBKeyRange.upperBound(Date.now()-retentionDays*86400000,true));
  cursor.onsuccess=()=>{const row=cursor.result;if(row){row.delete();row.continue()}};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('History retention could not be applied.'));
 });}finally{db.close()}
}
