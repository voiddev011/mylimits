import { remainingPercent,type Meter } from './model';
export function meterValue(m:Meter,mode:'used'|'remaining'='remaining'):string {
 if(m.unit==='currency'&&!m.currency)return 'Unknown currency';
 if(m.evidence==='observed')return `${m.used??0} observed`;
 const left=remainingPercent(m);if(left!==null)return `${Math.round(mode==='used'?100-left:left)}%`;
 const value=m.remaining;if(value!==null&&value!==undefined)return `${m.unit==='currency'?new Intl.NumberFormat(undefined,{style:'currency',currency:m.currency??'USD'}).format(value):value.toLocaleString()} left`;
 if(m.unit==='currency'&&m.used!==null)return `${new Intl.NumberFormat(undefined,{style:'currency',currency:m.currency??'USD'}).format(m.used)} spent`;
 return 'Unknown';
}
