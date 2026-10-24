import { useEffect, useRef, useState } from 'react';
import { HistoryCharts } from './HistoryCharts';
import type { HistoryInsights } from '../core/insights';
import { meterValue } from '../core/meter-display';
import type { Meter } from '../core/model';
import { Download } from 'lucide-react';
import { command, type PublicStore } from '../platform/messages';
import { accountName } from '../core/model';
import type { HistoryCursor, HistoryPage, HistoryPoint } from '../core/history-data';
function bound(value:string,end=false):number|undefined{
 if(!value)return undefined;const date=new Date(`${value}T00:00:00`);if(end)date.setDate(date.getDate()+1);return date.getTime()-(end?1:0);
}
export function HistoryView({store,demo}:{store:PublicStore;demo:boolean}){
 const [id,setId]=useState(store.accounts[0]?.id??'');const [points,setPoints]=useState<HistoryPoint[]>([]);const [before,setBefore]=useState<HistoryCursor|null>(null);
 const [from,setFrom]=useState('');const [to,setTo]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [revision,setRevision]=useState(0);const [confirm,setConfirm]=useState(false);
 const [comparison,setComparison]=useState('');const [insights,setInsights]=useState<HistoryInsights|null>(null);
 const generation=useRef(0);
 useEffect(()=>{if(id&&!store.accounts.some(a=>a.id===id))setId(store.accounts[0]?.id??'')},[store.accounts,id]);
 useEffect(()=>{const stamp=++generation.current;setError('');setInsights(null);setPoints([]);setBefore(null);setConfirm(false);if(!id||demo||store.settings.privacyMode)return;
  if(from&&to&&from>to){setError('Choose a valid date range.');return}
  void command<HistoryInsights>({type:'history-insights',accountIds:[id,...(comparison&&comparison!==id&&store.accounts.some(a=>a.id===comparison)?[comparison]:[])],from:bound(from),to:bound(to,true)}).then(data=>{if(stamp===generation.current)setInsights(data)},()=>{if(stamp===generation.current)setError('History insights could not be loaded.')});
  setLoading(true);void command<HistoryPage>({type:'history-page',accountId:id,from:bound(from),to:bound(to,true),limit:48}).then(page=>{if(stamp===generation.current){setPoints(page.points);setBefore(page.cursor)}},()=>{if(stamp===generation.current)setError('Local history could not be read. Your account settings are preserved.')}).finally(()=>{if(stamp===generation.current)setLoading(false)});
  return()=>{generation.current++};
 },[id,comparison,from,to,demo,revision,store.settings.privacyMode]);
 async function more(){if(!before||store.settings.privacyMode)return;const stamp=generation.current;setLoading(true);try{const page=await command<HistoryPage>({type:'history-page',accountId:id,from:bound(from),to:bound(to,true),limit:48,before});if(stamp===generation.current){setPoints(old=>[...old,...page.points]);setBefore(page.cursor)}}catch{setError('More readings could not be loaded.')}finally{if(stamp===generation.current)setLoading(false)}}
 async function download(format:'json'|'csv'){
  if(store.settings.privacyMode)return;
  setError('');try{const file=await command<{name:string;mime:string;text:string}>({type:'export-history',accountId:id,from:bound(from),to:bound(to,true),format});const url=URL.createObjectURL(new Blob([file.text],{type:file.mime}));const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e instanceof Error?e.message:'Export failed.')}
 }
 async function clear(){try{await command({type:'clear-history',accountId:id});setRevision(n=>n+1)}catch{setError('History could not be cleared.')}}
 return <section className="panel history-panel"><h2>Reading history</h2><p className="muted">Provider readings are snapshots, not a complete activity log. Blank periods stay unknown.</p><label>Account<select aria-label="History account" value={id} onChange={e=>setId(e.target.value)}><option value="">Choose account</option>{store.accounts.map(a=><option key={a.id} value={a.id}>{accountName(a)}</option>)}</select></label><label>Compare with<select aria-label="Compare history account" value={comparison} onChange={e=>setComparison(e.target.value)}><option value="">No comparison</option>{store.accounts.filter(a=>a.id!==id).map(a=><option key={a.id} value={a.id}>{accountName(a)}</option>)}</select></label><div className="form-grid"><label>From<input type="date" aria-label="History from" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input type="date" aria-label="History through" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
  <div className="inline-actions"><button className="button button--small" disabled={!id||demo||loading||store.settings.privacyMode} onClick={()=>void download('json')}><Download size={12}/>Export JSON</button><button className="button button--small" disabled={!id||demo||loading||store.settings.privacyMode} onClick={()=>void download('csv')}>Export CSV</button>{confirm?<><span className="small-note">Clear this account’s history? Tracking stays on.</span><button className="text-button danger" disabled={loading} onClick={()=>void clear()}>Confirm clear history</button><button className="text-button" onClick={()=>setConfirm(false)}>Cancel</button></>:<button className="text-button danger" disabled={!id||demo||loading||store.settings.privacyMode} onClick={()=>setConfirm(true)}>Clear history</button>}</div>
  {error&&<p className="notice" role="alert">{error}</p>}{!store.settings.privacyMode&&insights&&<HistoryCharts insights={insights} names={Object.fromEntries(store.accounts.map(a=>[a.id,accountName(a)]))}/>}
  {!store.settings.privacyMode&&points.length?<div className="history-table"><table><thead><tr><th>Observed</th><th>Source / scope</th><th>Values used</th></tr></thead><tbody>{points.map((p,i)=><tr key={`${p.id??i}`}><td>{new Date(p.observedAt??p.time).toLocaleString()}</td><td>{p.legacy?'Legacy · scope not recorded':p.connectionId?.startsWith('vault:')?'Saved sign-in':'Website'}<br/>{[...new Set(p.meters.map(m=>m.scope??'unknown'))].join(', ')}</td><td>{p.meters.map(m=><div key={m.id}>{m.label??m.id}: {meterValue(m as Meter,'used')}{m.evidence==='observed'?' · local observation':''}</div>)}</td></tr>)}</tbody></table></div>:<div className="empty-small">{store.settings.privacyMode?'Turn privacy mode off to view or export history.':loading?'Loading readings…':demo?'Preview does not create history.':'No saved readings in this date range.'}</div>}{before&&<button className="button" disabled={loading} onClick={()=>void more()}>{loading?'Loading…':'Load older readings'}</button>}<p className="history-footnote">{store.settings.historyRetentionDays??30}-day local retention. Clearing history keeps account nicknames and tracking preferences.</p>
 </section>
}
