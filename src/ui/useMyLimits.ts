import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { command, type Command, type PublicStore } from '../platform/messages';
import { demoState } from './demo';

/** One live projection for both the quick popup and the full dashboard. */
export function useMyLimits() {
  const [store, setStore] = useState<PublicStore | null>(null);
  const [demo, setDemo] = useState(location.hash === '#demo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, notify] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (demo) { setStore(demoState()); setError(''); return; }
    let active = true;
    const load = (opened = false) => void command({ type: opened ? 'opened' : 'state' }).then(
      s => { if (active) setStore(s); }, e => { if (active) setError(e instanceof Error ? e.message : 'Could not load MyLimits.'); });
    load(true);
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && changes['mylimits:state:v2']) load();
    };
    browser.storage.onChanged.addListener(listener);
    return () => { active = false; browser.storage.onChanged.removeListener(listener); };
  }, [demo]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => notify(''), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { document.documentElement.dataset.theme = store?.settings.theme ?? 'system'; }, [store?.settings.theme]);
  async function run(action: Command): Promise<boolean> {
    if (demo) {
      setStore(current => {
        if (!current) return current;
        if (action.type === 'rename') return { ...current, accounts: current.accounts.map(a => a.id === action.accountId ? { ...a, alias: action.alias } : a) };
        if (action.type === 'settings') return { ...current, settings: action.settings };
        if (action.type === 'account-preferences') { const { type: _type, accountId, ...patch } = action; return { ...current, accounts: current.accounts.map(a => a.id === accountId ? { ...a, ...patch } : a) }; }
        if (action.type === 'account-settings') return { ...current, accounts: current.accounts.map(a => a.id === action.accountId ? { ...a, alertRemaining: action.alertRemaining, alertsMuted: action.alertsMuted } : a) };
        return current;
      });
      notify('Preview changes stay in this preview.'); return true;
    }
    setBusy(true); setError('');
    try { setStore(await command(action)); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Action could not be completed.'); return false; }
    finally { setBusy(false); }
  }
  return { store, demo, setDemo, busy, error, setError, toast, notify, now, run };
}
