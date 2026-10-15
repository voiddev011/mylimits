import { browser } from 'wxt/browser';
import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';

import { AdapterError, retryTime } from './errors';
import { readAccountProvider, type ReaderOptions } from './reader';
export { AdapterError } from './errors';

async function pageJSON(provider: ProviderId, path: string, headers: Record<string, string>): Promise<{ status: number; body: unknown; retryAfter?: string | null }> {
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
        return { status: response.status, body: response.ok ? await response.json() : null, retryAfter: response.headers.get('retry-after') };
      } finally { clearTimeout(timer); }
    },
    args: [path, headers, providers[provider].home],
  });
  const result = results[0]?.result;
  if (!result) throw new AdapterError('error', 'The website could not return usage information.');
  return result;
}

async function readJSON(provider: ProviderId, path: string, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new AdapterError('error', 'Refresh was cancelled.', null, 'cancelled');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AdapterError('offline', 'You are offline. Your previous reading is saved.');
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 12_000);
  let result: { status: number; body: unknown; retryAt?: number | null; retryAfter?: string | null };
  try {
    const response = await fetch(new URL(path, providers[provider].home), {
      credentials: 'include', headers, signal: controller.signal, redirect: 'error',
    });
    result = { status: response.status, body: response.ok ? await response.json() : null, retryAt: retryTime(response.headers.get('retry-after')) };
  } catch {
    result = { status: 0, body: null };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  if (signal?.aborted) throw new AdapterError('error', 'Refresh was cancelled.', null, 'cancelled');
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
  if (result.status === 429) throw new AdapterError('error', 'The website asked us to slow down. Refresh will wait before retrying.', result.retryAt ?? retryTime(result.retryAfter ?? null), 'rate-limit');
  if (result.status < 200 || result.status >= 300) throw new AdapterError('unavailable', 'This usage interface is currently unavailable.');
  return result.body;
}

export async function readProvider(provider: ProviderId, options: ReaderOptions = {}, signal?: AbortSignal): Promise<Snapshot> {
  return readAccountProvider(provider, options, (path, headers) => readJSON(provider, path, headers, signal));
}
