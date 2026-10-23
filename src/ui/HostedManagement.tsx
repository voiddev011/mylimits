import { useState } from 'react';
import type { PublicStore,Command } from '../platform/messages';
import { accountName } from '../core/model';
import { remoteHostedId } from '../core/hosted';
import { HostedAccounts } from './HostedAccounts';
export function HostedManagement({store,demo,busy,run}:{store:PublicStore;demo:boolean;busy:boolean;run:(c:Command)=>Promise<boolean>}){
 const [reconnect,setReconnect]=useState<string|null>(null);
 const accounts=store.accounts.filter(a=>remoteHostedId(a.id));
 if(!accounts.length)return null;
 return <section className="panel"><h2>Independent accounts</h2>{accounts.map(a=><div key={a.id}><div className="setting-line"><strong>{accountName(a)}</strong><div className="inline-actions"><button className="button" disabled={busy||demo} onClick={()=>setReconnect(reconnect===a.id?null:a.id)}>Reconnect</button><button className="text-button" disabled={busy||demo} onClick={()=>void run({type:'hosted-action',id:remoteHostedId(a.id)!,action:'disconnect'})}>Disconnect</button></div></div>{reconnect===a.id&&<HostedAccounts initialAlias={a.alias} provider={a.provider==='chatgpt'?'openai':'claude'} reconnectId={remoteHostedId(a.id)!} demo={demo} privacy={!!store.settings.privacyMode}/>}</div>)}</section>;
}
