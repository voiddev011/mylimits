import { browser } from 'wxt/browser';
import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';
import { object, parseClaude, parseChatGPT } from './parsers';

export class AdapterError extends Error {
  constructor(public readonly status: 'signed-out' | 'waiting-for-tab' | 'unavailable' | 'error', message: string) {
    super(message);
  }
}

async function pageJSON(provider: ProviderId, path: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const tabs = await browser.tabs.query({ url: providers[provider].origin });
  const tab = tabs.find(item => item.active) ?? tabs[0];
  if (!tab?.id) throw new AdapterError('waiting-for-tab', `Open ${providers[provider].name} in this browser to refresh its existing session.`);
  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id }, world: 'MAIN',
    func: async (targetPath: string, requestHeaders: Record<string, string>, expectedOrigin: string) => {
      if (location.origin !== expectedOrigin || !targetPath.startsWith('/') || targetPath.startsWith('//')) return { status: 400, body: null };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(new URL(targetPath, expectedOrigin), {
          credentials: 'include', headers: requestHeaders, signal: controller.signal, redirect: 'error',
        });
        return { status: response.status, body: response.ok ? await response.json() : null };
      } finally { clearTimeout(timer); }
    },
    args: [path, headers, providers[provider].home],
  });
  const result = results[0]?.result;
  if (!result) throw new AdapterError('error', 'The website could not return usage information.');
  return result;
}

async function readJSON(provider: ProviderId, path: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let result: { status: number; body: unknown };
  try {
    const response = await fetch(new URL(path, providers[provider].home), {
      credentials: 'include', headers, signal: controller.signal, redirect: 'error',
    });
    result = { status: response.status, body: response.ok ? await response.json() : null };
  } catch {
    result = { status: 0, body: null };
  } finally { clearTimeout(timer); }
  // Some sites only expose session data from an already-open page context.
  // This fallback never creates a tab or opens a login window.
  if ([0, 401, 403].includes(result.status)) {
    try { result = await pageJSON(provider, path, headers); }
    catch (error) {
      if (error instanceof AdapterError && result.status !== 401) throw error;
      if (result.status === 401) throw new AdapterError('signed-out', `Sign in on the ${providers[provider].name} website, then refresh.`);
      throw new AdapterError('error', 'Usage could not be read. Try again with the website open.');
    }
  }
  if (result.status === 401) throw new AdapterError('signed-out', `Sign in on the ${providers[provider].name} website, then refresh.`);
  if (result.status === 403) throw new AdapterError('unavailable', 'The website declined this usage request.');
  if (result.status === 429) throw new AdapterError('error', 'The website asked us to slow down. Automatic refresh will back off.');
  if (result.status < 200 || result.status >= 300) throw new AdapterError('unavailable', 'This usage interface is currently unavailable.');
  return result.body;
}

export async function readProvider(provider: ProviderId): Promise<Snapshot> {
  if (provider === 'claude') {
    const account = await readJSON(provider, '/api/account');
    const organizations = await readJSON(provider, '/api/organizations');
    const list = Array.isArray(organizations) ? organizations.map(object) : [];
    // Initial version follows the first eligible workspace; see support matrix.
    const organization = list.find(item => Array.isArray(item.capabilities) && item.capabilities.includes('chat')) ?? list[0];
    if (!organization || typeof organization.uuid !== 'string') throw new AdapterError('unavailable', 'No Claude workspace could be verified.');
    const usage = await readJSON(provider, `/api/organizations/${encodeURIComponent(organization.uuid)}/usage`);
    try { return parseClaude(account, organization, usage); }
    catch { throw new AdapterError('unavailable', 'Claude account identity or usage format could not be verified.'); }
  }
  if (provider === 'chatgpt') {
    const session = object(await readJSON(provider, '/api/auth/session'));
    if (typeof session.accessToken !== 'string' || !session.accessToken) throw new AdapterError('signed-out', 'Sign in on ChatGPT, then refresh.');
    // Session token stays in this request's memory and never enters storage or UI messages.
    const usage = await readJSON(provider, '/backend-api/wham/usage', { Authorization: `Bearer ${session.accessToken}` });
    try { return parseChatGPT(session, usage); }
    catch { throw new AdapterError('unavailable', 'ChatGPT account identity or usage format could not be verified.'); }
  }
  return {
    identity: 'local-browser-activity', kind: 'browser', displayName: `${providers[provider].name} · This browser`, plan: null, meters: [],
  };
}
