import { PROVIDER_IDS, type ProviderId } from '../core/model';

export const REQUEST_DIAGNOSTICS_KEY = 'mylimits:request-diagnostics:v1';
export const REQUEST_DIAGNOSTICS_LIMIT = 200;
export type RequestTransport = 'background' | 'page' | 'temp-tab' | 'vault';
export interface RequestDiagnostic {
  at: number; provider: ProviderId; path: string; transport: RequestTransport;
  status: number; contentType: string | null; cfMitigated: 'challenge' | null; retryAfter: string | null;
  pageFallbackRan: boolean; tabAvailable: boolean | null;
  sessionCookieState: 'present' | 'absent' | 'unknown'; cookieNames: string[];
  timeSinceLastSuccessMs: number | null;
}
export interface DiagnosticInput {
  provider: ProviderId; path: string; transport: RequestTransport; status: number;
  contentType?: string | null; cfMitigated?: string | null; retryAfter?: string | null;
  pageFallbackRan?: boolean; tabAvailable?: boolean | null;
  sessionCookieState?: 'present' | 'absent' | 'unknown'; cookieNames?: string[];
  lastSuccessAt?: number | null;
}
export interface DiagnosticStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<unknown>;
}
export interface RequestTrace {
  record(input: DiagnosticInput): Promise<void>;
  lastSuccessAt: number | null;
}

const paths: Partial<Record<ProviderId, readonly string[]>> = {
  chatgpt: ['/api/auth/session', '/backend-api/wham/usage'],
  claude: ['/api/account', '/api/organizations'],
  grok: ['/rest/subscriptions', '/rest/rate-limits'],
  perplexity: ['/api/auth/session', '/rest/rate-limit/all'],
  cursor: ['/api/auth/me', '/api/usage-summary'],
};
function safePath(provider: ProviderId, value: unknown): string {
  if (typeof value !== 'string') return '/redacted';
  const path = value.split(/[?#]/, 1)[0]!;
  if (provider === 'claude' && /^\/api\/organizations\/[^/]+\/usage$/.test(path)) return '/api/organizations/:organization/usage';
  if (provider === 'claude' && path === '/api/organizations/:organization/usage') return path;
  return paths[provider]?.includes(path) ? path : '/redacted';
}
function retryAfter(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{1,10}$/.test(value)) return String(Number(value));
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toUTCString() : null;
}
function time(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

export function responseMetadata(response: Pick<Response, 'status' | 'headers'>) {
  return { status: response.status, contentType: response.headers.get('content-type'),
    cfMitigated: response.headers.get('cf-mitigated'), retryAfter: response.headers.get('retry-after') };
}

/** All fields are reconstructed from an allowlist. Never copy a response, error, URL or headers object. */
export function sanitizeDiagnostic(value: unknown, at: number): RequestDiagnostic | null {
  if (!value || typeof value !== 'object' || !time(at)) return null;
  const input = value as Record<string, unknown>;
  if (!PROVIDER_IDS.includes(input.provider as ProviderId) || !['background', 'page', 'temp-tab', 'vault'].includes(input.transport as string)) return null;
  const provider = input.provider as ProviderId;
  const mime = typeof input.contentType === 'string' ? input.contentType.split(';', 1)[0]!.trim().toLowerCase() : null;
  const contentType = mime === null ? null : ['application/json', 'text/html', 'text/plain', 'application/problem+json'].includes(mime) ? mime : 'other';
  const allowedCookie = provider === 'chatgpt' ? /^__Secure-next-auth\.session-token(?:\.\d{1,2})?$/ : provider === 'claude' ? /^sessionKey$/ : /$a/;
  return {
    at, provider, path: safePath(provider, input.path), transport: input.transport as RequestTransport,
    status: typeof input.status === 'number' && Number.isInteger(input.status) && input.status >= 0 && input.status <= 599 ? input.status : 0,
    contentType, cfMitigated: input.cfMitigated === 'challenge' ? 'challenge' : null, retryAfter: retryAfter(input.retryAfter),
    pageFallbackRan: input.pageFallbackRan === true, tabAvailable: typeof input.tabAvailable === 'boolean' ? input.tabAvailable : null,
    sessionCookieState: ['present', 'absent'].includes(input.sessionCookieState as string) ? input.sessionCookieState as 'present' | 'absent' : 'unknown',
    cookieNames: Array.isArray(input.cookieNames) ? [...new Set(input.cookieNames.filter((n): n is string => typeof n === 'string' && allowedCookie.test(n)))].slice(0, 20) : [],
    timeSinceLastSuccessMs: time(input.lastSuccessAt) && input.lastSuccessAt > 0 && input.lastSuccessAt <= at ? at - input.lastSuccessAt
      : time(input.timeSinceLastSuccessMs) ? input.timeSinceLastSuccessMs : null,
  };
}

/** Session-only bounded buffer. Storage unavailability must never fail a quota request. */
export function createRequestDiagnostics(port: { storage?: DiagnosticStorage; now?: () => number } = {}) {
  let storage = port.storage;
  let loaded = false;
  let entries: RequestDiagnostic[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  const now = port.now ?? Date.now;
  async function load() {
    if (loaded) return;
    loaded = true;
    if (!storage) return;
    try {
      const saved = (await storage.get(REQUEST_DIAGNOSTICS_KEY))[REQUEST_DIAGNOSTICS_KEY];
      if (Array.isArray(saved)) entries = saved.slice(-REQUEST_DIAGNOSTICS_LIMIT).flatMap(raw => {
        const entry = sanitizeDiagnostic(raw, raw?.at);
        return entry ? [entry] : [];
      });
    } catch { storage = undefined; }
  }
  function serial<T>(run: () => Promise<T>): Promise<T> {
    const task = queue.then(run); queue = task.catch(() => undefined); return task;
  }
  return {
    record(input: DiagnosticInput): Promise<void> {
      const entry = sanitizeDiagnostic(input, now());
      if (!entry) return Promise.resolve();
      return serial(async () => {
        await load();
        entries = [...entries, entry].slice(-REQUEST_DIAGNOSTICS_LIMIT);
        if (storage) try { await storage.set({ [REQUEST_DIAGNOSTICS_KEY]: entries }); } catch { storage = undefined; }
      });
    },
    list(): Promise<RequestDiagnostic[]> { return serial(async () => { await load(); return structuredClone(entries); }); },
  };
}
