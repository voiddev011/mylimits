import { browser } from 'wxt/browser';
import type { ProviderId } from '../core/model';
import type { Snapshot } from '../core/engine';
import { providers } from './catalog';

import { AdapterError, retryTime } from './errors';
import { readAccountProvider, type ReaderOptions,type QuotaRequest } from './reader';
import { responseMetadata, type RequestTrace } from '../platform/diagnostics';
export { AdapterError } from './errors';

async function pageJSON(provider: ProviderId, path: string, headers: Record<string, string>,request?:QuotaRequest,trace?:RequestTrace): Promise<{ status: number; body: unknown; retryAfter?: string | null }> {
  let observed = false;
  let tabAvailable: boolean | null = null;
  try {
  const tabs = await browser.tabs.query({ url: providers[provider].origin });
  const tab = tabs.find(item => item.active) ?? tabs[0];
  tabAvailable = !!tab?.id;
  if (!tab?.id) throw new AdapterError('waiting-for-tab', `Open ${providers[provider].name} in this browser to refresh its existing session.`);
  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id }, world: 'MAIN',
    func: async (targetPath: string, requestHeaders: Record<string, string>, expectedOrigin: string,quotaRequest:QuotaRequest|null) => {
      if (location.origin !== expectedOrigin || !targetPath.startsWith('/') || targetPath.startsWith('//')) return { status: 400, body: null };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(new URL(targetPath, expectedOrigin), {
          credentials: 'include', headers: requestHeaders, signal: controller.signal, redirect: 'error',method:quotaRequest?.method??'GET',body:quotaRequest?JSON.stringify(quotaRequest.body):undefined,
        });
        let body: unknown = null; let parseFailed = false;
        if (response.ok) try { body = await response.json(); } catch { parseFailed = true; }
        return { status: response.status, body, parseFailed, contentType: response.headers.get('content-type'), cfMitigated: response.headers.get('cf-mitigated'), retryAfter: response.headers.get('retry-after') };
      } finally { clearTimeout(timer); }
    },
    args: [path, headers, providers[provider].home,request??null],
  });
  const result = results[0]?.result;
  if (!result) throw new AdapterError('error', 'The website could not return usage information.');
  observed = true;
  await trace?.record({ provider, path, transport: 'page', status: result.status,
    contentType: 'contentType' in result ? result.contentType : null,
    cfMitigated: 'cfMitigated' in result ? result.cfMitigated : null,
    retryAfter: 'retryAfter' in result ? result.retryAfter : null,
    pageFallbackRan: true, tabAvailable, lastSuccessAt: trace.lastSuccessAt });
  if ('parseFailed' in result && result.parseFailed) throw new Error('The website returned invalid usage JSON.');
  return result;
  } catch (error) {
    if (!observed) await trace?.record({ provider, path, transport: 'page', status: 0, pageFallbackRan: true, tabAvailable, lastSuccessAt: trace.lastSuccessAt });
    throw error;
  }
}

async function readJSON(provider: ProviderId, path: string, headers: Record<string, string> = {}, signal?: AbortSignal,request?:QuotaRequest,trace?:RequestTrace): Promise<unknown> {
  if(request)headers={...headers,'Content-Type':'application/json'};
  if (signal?.aborted) throw new AdapterError('error', 'Refresh was cancelled.', null, 'cancelled');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AdapterError('offline', 'You are offline. Your previous reading is saved.');
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 12_000);
  let result: { status: number; body: unknown; retryAt?: number | null; retryAfter?: string | null };
  let metadata: ReturnType<typeof responseMetadata> | undefined;
  let tabAvailable: boolean | null = null;
  if (trace) try { tabAvailable = (await browser.tabs.query({ url: providers[provider].origin })).some(tab => !!tab.id); } catch { /* Optional metadata must not affect the request. */ }
  try {
    const response = await fetch(new URL(path, providers[provider].home), {
      credentials: 'include', headers, signal: controller.signal, redirect: 'error',method:request?.method??'GET',body:request?JSON.stringify(request.body):undefined,
    });
    metadata = responseMetadata(response);
    result = { status: response.status, body: response.ok ? await response.json() : null, retryAt: retryTime(response.headers.get('retry-after')) };
  } catch {
    result = { status: 0, body: null };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  await trace?.record({ provider, path, transport: 'background', ...(metadata ?? { status: 0 }),
    pageFallbackRan: !signal?.aborted && [0, 401, 403].includes(result.status), tabAvailable, lastSuccessAt: trace.lastSuccessAt });
  if (signal?.aborted) throw new AdapterError('error', 'Refresh was cancelled.', null, 'cancelled');
  // Some sites only expose session data from an already-open page context.
  // This fallback never creates a tab or opens a login window.
  if ([0, 401, 403].includes(result.status)) {
    try { result = await pageJSON(provider, path, headers,request,trace); }
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

export async function readProvider(provider: ProviderId, options: ReaderOptions = {}, signal?: AbortSignal,trace?:RequestTrace): Promise<Snapshot> {
  return readAccountProvider(provider, options, (path, headers,request) => readJSON(provider, path, headers, signal,request,trace));
}
