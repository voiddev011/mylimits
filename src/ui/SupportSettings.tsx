import { browser } from 'wxt/browser';
import { useState } from 'react';
import { command, type PublicStore } from '../platform/messages';
import { diagnostics } from '../core/presentation';
import type { RequestDiagnostic } from '../platform/diagnostics';
export function SupportSettings({store}:{store:PublicStore}) {
  const [copied,setCopied]=useState('');
  const version=browser.runtime.getManifest().version;
  async function copy(){
    let requests: { version: number; entries: RequestDiagnostic[] };
    try { requests = await command({type:'request-diagnostics'}); } catch { setCopied('Request diagnostics unavailable. Retry after reloading MyLimits.'); return; }
    try{await navigator.clipboard.writeText(JSON.stringify({...diagnostics(store,version,Date.now()),requests},null,2));setCopied('Diagnostics copied.');}catch{setCopied('Clipboard unavailable.');}
  }
  return <section className="panel support-panel"><h2>Help & updates</h2><p>MyLimits {version} · stored on this device</p><div className="inline-actions"><button className="button" onClick={()=>void copy()}>Copy safe diagnostics</button><a className="button" target="_blank" rel="noreferrer" href="https://github.com/voiddev011/mylimits/blob/main/docs/INSTALL.md">Install / update help</a><a className="text-button" target="_blank" rel="noreferrer" href="https://github.com/voiddev011/mylimits/issues">Report an issue</a></div><small>Includes connection states and up to 200 recent request results from this browser session. Names, credentials and quota readings are excluded.</small>{copied&&<p role="status">{copied}</p>}</section>;
}
