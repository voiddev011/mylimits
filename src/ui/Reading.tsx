import { isFresh, remainingPercent, type Account, type Meter, type Settings } from '../core/model';
import { meterValue } from '../core/meter-display';
import { age, countdown } from './format';
export function Reading({account,meter,settings,now,compact=false,showResetClock=false}:{account:Account;meter:Meter;settings:Settings;now:number;compact?:boolean;showResetClock?:boolean}){
 const label=meter.label.replace('Work / Codex · ','').replace(' · all models','');
 const displayLabel=compact?label.replace(/^Session · /,'').replace(/^Codex · /,''):label;
 const remaining=remainingPercent(meter);const fresh=isFresh(account,meter,now,settings.refreshMinutes)&&meter.evidence==='reported';
 const percent=settings.displayMode==='used'&&remaining!==null?100-remaining:remaining;
 const low=fresh&&remaining!==null&&remaining<=(account.alertRemaining??settings.warningRemaining);
 return <div className={`meter-chip ${!fresh?'meter-chip--dated':''} ${low?'meter-chip--low':''}`} title={`${meter.label}. ${meter.source}. ${fresh?'Current reading':`Last reading ${age(meter.observedAt??account.updatedAt,now)}`}`}>
  <div className="meter-top"><span>{displayLabel}</span><strong>{meterValue(meter,settings.displayMode)}</strong></div>
  {remaining!==null&&meter.evidence==='reported'?<div className="meter-track"><span style={{width:`${Math.max(0,Math.min(100,percent??0))}%`}}/></div>:<div className="meter-track meter-track--unknown"/>}
  <small>{showResetClock && meter.resetsAt ? `Reset ${new Date(meter.resetsAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ` : ''}{meter.evidence==='observed'?'This browser only':remaining===null?(meter.remaining!==null&&meter.remaining!==undefined?'Reset not reported':meter.unit==='currency'?'Cap not reported':'Quota not reported'):`${fresh?'':'Last · '}${countdown(meter.resetsAt,now)}`}</small>
 </div>
}
