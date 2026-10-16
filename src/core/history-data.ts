import type { Account, Meter, UsageSnapshot } from './model';
export interface HistoryPoint {
 id?:number; schemaVersion?:2; accountId:string; time:number; observedAt?:number; receivedAt?:number;
 connectionId?:string; workspaceId?:string|null; snapshotKey?:string; legacy?:boolean;
 meters:({id:string;usedPercent:number|null}&Partial<Omit<Meter,'id'|'usedPercent'>>)[];
}
export interface HistoryCursor {time:number;id:number;}
export interface HistoryQuery {accountId:string;from?:number;to?:number;before?:HistoryCursor;limit?:number;}
export interface HistoryPage {points:HistoryPoint[];cursor:HistoryCursor|null;hasMore:boolean;}
export function historyPoint(s:UsageSnapshot):HistoryPoint{
 return {schemaVersion:2,accountId:s.accountId,time:s.observedAt,observedAt:s.observedAt,receivedAt:s.receivedAt,connectionId:s.connectionId,workspaceId:s.workspaceId,snapshotKey:s.snapshotId,
  meters:s.meters.map(m=>({id:m.id,label:m.label,scope:m.scope,evidence:m.evidence,unit:m.unit,used:m.used,total:m.total,remaining:m.remaining,usedPercent:m.usedPercent,resetsAt:m.resetsAt,source:m.source,currency:m.currency,windowId:m.windowId,observedAt:m.observedAt,connectionId:m.connectionId}))};
}
// Explicit allowlist also normalizes legacy rows, never exporting arbitrary IDB fields.
export function publicHistory(raw:HistoryPoint):HistoryPoint{
 const validTime=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=8.64e15;
 if(!validTime(raw.time)||typeof raw.accountId!=='string'||!Array.isArray(raw.meters))throw new Error('Invalid saved history reading.');
 return {id:raw.id,schemaVersion:2,accountId:raw.accountId,time:raw.time,observedAt:validTime(raw.observedAt)?raw.observedAt:raw.time,
  receivedAt:validTime(raw.receivedAt)?raw.receivedAt:raw.time,connectionId:raw.connectionId??'legacy',workspaceId:raw.workspaceId??null,legacy:raw.legacy??!raw.connectionId,
  meters:raw.meters.map(m=>({id:String(m.id).slice(0,120),label:typeof m.label==='string'?m.label.slice(0,120):undefined,scope:m.scope,evidence:m.evidence,unit:m.unit,
   used:validTime(m.used)?m.used:null,total:validTime(m.total)&&m.total>0?m.total:null,remaining:validTime(m.remaining)?m.remaining:null,usedPercent:typeof m.usedPercent==='number'&&Number.isFinite(m.usedPercent)&&m.usedPercent>=0&&m.usedPercent<=1000?m.usedPercent:null,
   resetsAt:validTime(m.resetsAt)?m.resetsAt:null,source:typeof m.source==='string'?m.source.slice(0,160):undefined,currency:typeof m.currency==='string'&&/^[A-Z]{3}$/.test(m.currency)?m.currency:null,windowId:typeof m.windowId==='string'?m.windowId.slice(0,240):null,observedAt:validTime(m.observedAt)?m.observedAt:undefined,connectionId:typeof m.connectionId==='string'?m.connectionId.slice(0,240):undefined}))};
}
export function csvCell(value:unknown):string{
 let s=value==null?'':String(value);if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';
}
export function exportReadings(accounts:Account[],points:HistoryPoint[],format:'json'|'csv',now:number){
 const safeAccounts=accounts.map(a=>({id:a.id,name:a.alias||a.defaultName,provider:a.provider,plan:a.plan}));
 const safe=points.map(publicHistory);
 const text=format==='json'?JSON.stringify({schemaVersion:2,exportedAt:new Date(now).toISOString(),accounts:safeAccounts,readings:safe},null,2):[
  ['account','provider','observed_at','received_at','source','scope','evidence','meter','used_percent','used','total','remaining','unit','currency','reset_at'].map(csvCell).join(','),
  ...safe.flatMap(p=>p.meters.map(m=>{const a=safeAccounts.find(a=>a.id===p.accountId);return [a?.name??p.accountId,a?.provider??'',new Date(p.observedAt??p.time).toISOString(),new Date(p.receivedAt??p.time).toISOString(),m.source??(p.legacy?'Legacy reading; scope not recorded':''),m.scope??'',m.evidence??'unverified legacy',m.label??m.id,m.usedPercent,m.used,m.total,m.remaining,m.unit,m.currency,m.resetsAt?new Date(m.resetsAt).toISOString():''].map(csvCell).join(',')})),
 ].join('\r\n');
 return {name:`mylimits-readings-${new Date(now).toISOString().slice(0,10)}.${format}`,mime:format==='json'?'application/json':'text/csv;charset=utf-8',text};
}
