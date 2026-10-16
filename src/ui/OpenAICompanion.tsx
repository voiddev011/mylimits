import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { ExternalLink, Plus, RefreshCw, Unplug } from 'lucide-react';
import { command, type Command } from '../platform/messages';

export function OpenAICompanion({ run, busy, demo, notify, nickname = '' }: {
  run: (action: Command) => Promise<boolean>; busy: boolean; demo: boolean; notify: (message: string) => void; nickname?: string;
}) {
  const [status, setStatus] = useState({ enabled: false, connected: false });
  const [working, setWorking] = useState(false);
  async function check() {
    if (!demo) setStatus(await command<typeof status>({ type: 'companion-status' }));
  }
  useEffect(() => { void check().catch(() => {}); }, [demo, busy]);
  async function connect() {
    if (demo) { notify('Exit sample preview to connect an OpenAI account.'); return; }
    // Request optional native access directly from the user's click.
    const granted = await browser.permissions.request({ permissions: ['nativeMessaging'] });
    if (!granted) { notify('Companion access was not granted.'); return; }
    setWorking(true);
    try {
      if (await run({ type: 'companion-enable', enabled: true })) await run({ type: 'companion-add', nickname });
      await check();
    } finally { setWorking(false); }
  }
  if(__MYLIMITS_BROWSER__==='firefox')return <article className="website-card"><h3>Optional companion</h3><p>Native setup is currently packaged for desktop Chromium browsers on Windows/Linux. Use Firefox’s website tracking without a companion; Firefox native registration is not supplied.</p></article>;
  return <article className="website-card companion-card"><div className="website-top"><div><h3>OpenAI companion</h3><span className="small-note">Independent account connection · Windows / Linux setup · Chrome / Brave / Edge</span></div></div>
    <p>Optional separate OpenAI authorization for returned Work / Codex limits. Website logout, renewal and shared usage from other devices still need live verification. Basic website tracking works without this service.</p>
    <p className="small-note">Install the companion first using the setup guide. It refreshes about once a minute while your computer is awake and online. Other ChatGPT limits may not be available.</p>
    <div className="website-bottom"><span className="small-note">{demo ? 'Sample mode' : status.connected ? 'Companion connected' : status.enabled ? 'Companion unavailable — check installation' : 'Not connected'}</span></div>
    <div className="companion-actions"><button className="button button--primary" disabled={busy || working} onClick={() => void connect().catch(() => notify('Could not connect. Check the companion installation and Chrome permission.'))}><Plus size={14} />{status.enabled ? 'Add OpenAI account' : 'Connect OpenAI'}</button>
      <a className="text-button" href="https://github.com/voiddev011/mylimits/blob/v2/compact-accounts/docs/OPENAI-COMPANION.md" target="_blank" rel="noreferrer">Setup guide<ExternalLink size={12} /></a>
      {status.enabled && <><button className="text-button" disabled={busy || working} onClick={() => void run({ type: 'companion-enable', enabled: true }).then(check).catch(() => {})}><RefreshCw size={12} />Retry bridge</button><button className="text-button" disabled={busy || working} onClick={() => void run({ type: 'companion-enable', enabled: false }).then(check).catch(() => {})}><Unplug size={12} />Pause extension sync</button></>}
    </div><p className="small-note">Disconnect an individual account in its Overview details. Pausing sync leaves the companion running and its accounts connected.</p>
  </article>;
}
