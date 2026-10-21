import { browser } from 'wxt/browser';
import { useState } from 'react';
import type { PublicStore } from '../platform/messages';
import { diagnostics } from '../core/presentation';
export function SupportSettings({store}:{store:PublicStore}) {
  const [copied,setCopied]=useState('');
  const version=browser.runtime.getManifest().version;
  async function copy(){try{await navigator.clipboard.writeText(JSON.stringify(diagnostics(store,version,Date.now()),null,2));setCopied('Diagnostics copied.');}catch{setCopied('Clipboard unavailable.');}}
  return <section className="panel support-panel"><h2>Help & updates</h2><p>MyLimits {version} · stored on this device</p><div className="inline-actions"><button className="button" onClick={()=>void copy()}>Copy safe diagnostics</button><a className="button" target="_blank" rel="noreferrer" href="https://github.com/voiddev011/mylimits/blob/v3/redesign/docs/INSTALL.md">Install / update help</a><a className="text-button" target="_blank" rel="noreferrer" href="https://github.com/voiddev011/mylimits/issues">Report an issue</a></div><small>Diagnostics include connection states and counts. Names, credentials and quota readings are excluded.</small>{copied&&<p role="status">{copied}</p>}</section>;
}
