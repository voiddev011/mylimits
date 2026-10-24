import type { Meter } from '../core/model';
import type { Snapshot } from '../core/engine';
import { MeterSchema } from '../core/schema';
import { object } from './parsers';
const identity=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>180)throw new Error('Account identity is unavailable.');return value};
function count(value:unknown):number|null{if(value===undefined||value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Invalid reported count.');return value}
const label=(value:unknown)=>typeof value==='string'&&value.trim()?value.slice(0,80):null;
function timestamp(value:unknown){if(typeof value!=='string')return null;const at=Date.parse(value);return Number.isFinite(at)&&at>0?at:null}
function wrap(identity:string,displayName:string,plan:string|null,meters:Meter[]):Snapshot{return {identity,displayName,plan,kind:'account',meters:meters.map(m=>MeterSchema.parse(m))}}
export function cursorIdentity(raw:unknown){return identity(object(raw).sub)}
export function parseCursor(account:unknown,raw:unknown):Snapshot{
 const data=object(raw),individual=object(data.individualUsage),plan=object(individual.plan),onDemand=object(individual.onDemand),meters:Meter[]=[],reset=timestamp(data.billingCycleEnd),window=typeof data.billingCycleStart==='string'?`${data.billingCycleStart}/${data.billingCycleEnd??'unknown'}`:null;
 for(const [key,name]of [['autoPercentUsed','Cursor models'],['apiPercentUsed','Other models']] as const){const used=count(plan[key]);if(used!==null)meters.push({id:`cursor:${key}`,label:name,scope:'subscription',evidence:'reported',unit:'percent',used:null,total:null,usedPercent:used,resetsAt:reset,windowId:window,source:'Cursor reported coding-plan model pool'})}
 const used=count(plan.used),cap=count(plan.limit),reported=count(plan.totalPercentUsed);
 if(reported!==null||used!==null)meters.unshift({id:'cursor:included',label:'Coding plan · included',scope:'subscription',evidence:'reported',unit:'currency',currency:'USD',used:used===null?null:used/100,total:cap!==null&&cap>0?cap/100:null,remaining:count(plan.remaining)===null?null:count(plan.remaining)!/100,usedPercent:reported??(used!==null&&cap!==null&&cap>0?used/cap*100:null),resetsAt:reset,windowId:window,source:'Cursor reported included coding-plan credits (cents converted to USD)'});
 if(onDemand.enabled===true){const spent=count(onDemand.used),limit=count(onDemand.limit);if(spent!==null)meters.push({id:'cursor:on-demand',label:'On-demand spend',scope:'api',evidence:'reported',unit:'currency',currency:'USD',used:spent/100,total:limit!==null&&limit>0?limit/100:null,usedPercent:limit!==null&&limit>0?spent/limit*100:null,resetsAt:reset,windowId:window,source:'Cursor reported on-demand usage; not the subscription fee'})}
 return wrap(`account:${cursorIdentity(account)}`,'Cursor',label(data.membershipType),meters);
}
