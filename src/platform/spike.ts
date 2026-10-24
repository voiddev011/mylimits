import { PROVIDER_IDS, type ProviderId } from "../core/model";
import { providers } from "../providers/catalog";
import {
  readAccountProvider,
  type ReadJSON,
  type QuotaRequest,
} from "../providers/reader";
import { AdapterError, responseError, retryTime } from "../providers/errors";
import { readJsonResponse } from "../providers/response";
import { sanitizeDiagnostic, type RequestTrace } from "./diagnostics";
import {
  cookieFlags,
  cookieHeader,
  endpointAllowed,
  setCookieNames,
  spikeRule,
  tokenExpiry,
  SPIKE_RULE_ID,
  SPIKE_RULE_END,
  SPIKE_WAITS_KEY,
  type SpikeCommand,
  type ProbeCookie,
} from "../core/spike";

interface Tab {
  id?: number;
  incognito?: boolean;
  cookieStoreId?: string;
}
interface Store {
  id: string;
  tabIds: number[];
}
interface HeaderEvent {
  url: string;
  tabId: number;
  initiator?: string;
  statusCode: number;
  responseHeaders?: { name: string; value?: string }[];
}
export interface SpikePort {
  extensionId: string;
  now?: () => number;
  cookies: {
    getAllCookieStores(): Promise<Store[]>;
    getAll(details: {
      domain: string;
      storeId: string;
    }): Promise<ProbeCookie[]>;
  };
  tabs: { query(query: Record<string, never>): Promise<Tab[]> };
  windows: {
    create(properties: {
      url: string;
      incognito: true;
      type: "popup";
      width: number;
      height: number;
    }): Promise<{ id?: number; tabs?: Tab[] } | undefined>;
    remove(id: number): Promise<unknown>;
  };
  allowedPrivate(): Promise<boolean>;
  permitted(provider: ProviderId): Promise<boolean>;
  dnr: {
    getSessionRules(): Promise<{ id: number }[]>;
    updateSessionRules(options: {
      removeRuleIds: number[];
      addRules?: ReturnType<typeof spikeRule>[];
    }): Promise<void>;
    getMatchedRules?(options: {
      minTimeStamp: number;
    }): Promise<{ rulesMatchedInfo: { rule: { ruleId: number } }[] }>;
  };
  headers: {
    addListener(
      listener: (details: HeaderEvent) => undefined,
      filter: { urls: string[] },
      options: ("responseHeaders" | "extraHeaders")[],
    ): void;
    removeListener(listener: (details: HeaderEvent) => undefined): void;
  };
  storage: {
    get(key: string): Promise<Record<string, unknown>>;
    set(values: Record<string, unknown>): Promise<unknown>;
  };
  request(url: string, options: RequestInit): Promise<Response>;
  ambient(
    provider: ProviderId,
    signal: AbortSignal,
    trace: RequestTrace,
  ): ReadJSON;
  lock<T>(
    host: string,
    run: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T>;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (timer: unknown) => void;
}
export class SpikeError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
interface Capture {
  provider: ProviderId;
  storeId: string;
  cookies: ProbeCookie[];
  capturedAt: number;
}
function fail(code: string): never {
  throw new SpikeError(code);
}

/** All credential material is private closure memory, never returned, persisted or logged. */
export function createSpikeSession(port: SpikePort) {
  const now = port.now ?? Date.now,
    schedule =
      port.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel =
    port.cancel ??
    ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let captured: Capture | undefined,
    token: string | undefined,
    tokenExp: number | null = null,
    operation: AbortController | undefined,
    closed = false,
    usable = true;
  let privateWindow: number | undefined,
    privateTab: number | undefined,
    observing: ProviderId | undefined,
    observerTimer: unknown;
  let events: { path: string; status: number; at: number; names: string[] }[] =
    [];
  let ready: Promise<void> | undefined;
  let settled: Promise<void> = Promise.resolve();
  let memoryWaits: Partial<Record<ProviderId, number>> = {};
  function checkActive(signal: AbortSignal) {
    if (closed || signal.aborted) fail("cancelled");
  }
  async function initialize() {
    ready ??= (async () => {
      try {
        const ids = (await port.dnr.getSessionRules())
          .filter((r) => r.id >= SPIKE_RULE_ID && r.id <= SPIKE_RULE_END)
          .map((r) => r.id);
        if (ids.length)
          await port.dnr.updateSessionRules({ removeRuleIds: ids });
      } catch {
        usable = false;
        fail("rule-cleanup-failed");
      }
    })();
    return ready;
  }
  async function stores() {
    const [tabs, list] = await Promise.all([
      port.tabs.query({}),
      port.cookies.getAllCookieStores(),
    ]);
    return list.map((store) => {
      const linked = tabs.filter(
        (t) => t.id !== undefined && store.tabIds.includes(t.id),
      );
      const normal = linked.some(
        (t) =>
          t.incognito === false &&
          (!t.cookieStoreId || t.cookieStoreId === "firefox-default"),
      );
      const privateOnly =
        linked.length > 0 && linked.every((t) => t.incognito === true);
      return {
        ...store,
        context:
          normal && !linked.some((t) => t.incognito !== false)
            ? "normal"
            : privateOnly
              ? "private"
              : "unknown",
      };
    });
  }
  async function catalog(provider: ProviderId) {
    const list = await stores();
    const normal = list.filter((s) => s.context === "normal");
    const rows = [];
    for (const store of list) {
      const cookies = await port.cookies.getAll({
        domain: new URL(providers[provider].home).hostname,
        storeId: store.id,
      });
      for (const cookie of cookies
        .filter((c) => c.storeId === store.id)
        .slice(0, 100))
        rows.push({
          storeId: store.id,
          context: store.context,
          ...cookieFlags(cookie),
        });
    }
    return {
      defaultStore: normal.length === 1 ? normal[0]!.id : null,
      stores: list.map((s) => ({
        storeId: s.id,
        context: s.context,
        tabCount: s.tabIds.length,
      })),
      rows,
    };
  }
  function captureInfo() {
    return captured
      ? {
          provider: captured.provider,
          storeId: captured.storeId,
          names: captured.cookies.map((c) => c.name),
          capturedAt: captured.capturedAt,
        }
      : null;
  }
  async function waits() {
    try {
      const raw = (await port.storage.get(SPIKE_WAITS_KEY))[SPIKE_WAITS_KEY];
      if (
        raw !== undefined &&
        (!raw ||
          typeof raw !== "object" ||
          Array.isArray(raw) ||
          Object.entries(raw).some(
            ([p, t]) =>
              !PROVIDER_IDS.includes(p as ProviderId) ||
              typeof t !== "number" ||
              !Number.isSafeInteger(t) ||
              t < 0 ||
              t > 8.64e15,
          ))
      )
        fail("cooldown-storage-unavailable");
      return {
        ...((raw ?? {}) as Partial<Record<ProviderId, number>>),
        ...memoryWaits,
      };
    } catch {
      fail("cooldown-storage-unavailable");
    }
  }
  async function waitForProvider(provider: ProviderId) {
    const time = (await waits())[provider];
    if (typeof time === "number" && Number.isFinite(time) && time > now())
      fail("cooldown");
  }
  async function rememberWait(provider: ProviderId, at: number) {
    const saved = await waits();
    memoryWaits[provider] = Math.max(
      saved[provider] ?? 0,
      Math.min(now() + 86400000, at),
    );
    try {
      await port.storage.set({
        [SPIKE_WAITS_KEY]: { ...saved, ...memoryWaits },
      });
    } catch {
      fail("cooldown-storage-unavailable");
    }
  }
  async function metadataWait(
    provider: ProviderId,
    code: number,
    header?: string | null,
  ) {
    const at = retryTime(header ?? null, now());
    if (code === 429 || at !== null)
      await rememberWait(
        provider,
        Math.max(at ?? 0, now() + (code === 429 ? 60000 : 0)),
      );
  }
  async function raw(
    provider: ProviderId,
    path: string,
    variant: "headers" | "replay" | "bearer",
    signal: AbortSignal,
    headers: Record<string, string>,
    request: QuotaRequest | undefined,
    rows: unknown[],
  ) {
    if (!endpointAllowed(provider, path)) fail("endpoint-unavailable");
    await waitForProvider(provider);
    const host = new URL(providers[provider].home).hostname;
    return port.lock(
      host,
      async () => {
        if (!usable) fail("rule-cleanup-failed");
        let added = false,
          attempted = false,
          recorded = false;
        let matched: "matched" | "not-observed" | "unavailable" = "unavailable";
        const start = now();
        try {
          if (variant !== "bearer") {
            let cookie: string | undefined;
            if (variant === "replay") {
              if (!captured || captured.provider !== provider)
                fail("capture-required");
              try {
                cookie = cookieHeader(provider, path, captured.cookies, now());
              } catch {
                fail("capture-invalid");
              }
            }
            added = true;
            try {
              await port.dnr.updateSessionRules({
                removeRuleIds: [SPIKE_RULE_ID],
                addRules: [spikeRule(provider, port.extensionId, cookie)],
              });
            } catch {
              fail("rule-unavailable");
            }
          }
          attempted = true;
          const fetched = await port.request(
            new URL(path, providers[provider].home).href,
            {
              credentials: variant === "headers" ? "include" : "omit",
              redirect: "error",
              signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
              method: request?.method ?? "GET",
              headers: {
                ...headers,
                ...(request ? { "Content-Type": "application/json" } : {}),
              },
              body: request ? JSON.stringify(request.body) : undefined,
            },
          );
          const response =
            variant === "bearer"
              ? {
                  status: fetched.status,
                  body: null,
                  contentType: fetched.headers.get("content-type"),
                  cfMitigated: fetched.headers.get("cf-mitigated"),
                  retryAfter: fetched.headers.get("retry-after"),
                }
              : await readJsonResponse(fetched);
          if (variant === "bearer")
            await fetched.body?.cancel().catch(() => {});
          if (added && port.dnr.getMatchedRules)
            try {
              matched = (
                await port.dnr.getMatchedRules({ minTimeStamp: start })
              ).rulesMatchedInfo.some((m) => m.rule.ruleId === SPIKE_RULE_ID)
                ? "matched"
                : "not-observed";
            } catch {
              /* Feedback may require unavailable browser permission. */
            }
          const safe = sanitizeDiagnostic(
            {
              provider,
              path,
              transport: variant === "replay" ? "vault" : "background",
              ...response,
            },
            now(),
          )!;
          rows.push({
            variant,
            path: safe.path,
            status: safe.status,
            contentType: safe.contentType,
            cfMitigated: safe.cfMitigated,
            retryAfter: safe.retryAfter,
            ...(variant === "bearer"
              ? {}
              : {
                  initiatorScoped: true,
                  ruleMatch: matched,
                  requestSucceeded:
                    response.status >= 200 && response.status < 300,
                }),
          });
          recorded = true;
          await metadataWait(provider, response.status, response.retryAfter);
          const error = responseError(
            response,
            providers[provider].name,
            now(),
          );
          if (error) throw error;
          return response.body;
        } catch (error) {
          if (attempted && !recorded)
            rows.push({
              variant,
              path: sanitizeDiagnostic(
                { provider, path, transport: "background", status: 0 },
                now(),
              )!.path,
              status: 0,
              error: signal.aborted ? "cancelled" : "request-failed",
            });
          if (
            !(error instanceof AdapterError) &&
            !(error instanceof SpikeError)
          )
            fail(signal.aborted ? "cancelled" : "request-failed");
          throw error;
        } finally {
          if (added)
            try {
              await port.dnr.updateSessionRules({
                removeRuleIds: [SPIKE_RULE_ID],
              });
            } catch {
              usable = false;
              fail("rule-cleanup-failed");
            }
        }
      },
      signal,
    );
  }
  function observer(details: HeaderEvent): undefined {
    if (
      !observing ||
      details.tabId !== -1 ||
      details.initiator !== `chrome-extension://${port.extensionId}`
    )
      return;
    let url: URL;
    try {
      url = new URL(details.url);
    } catch {
      return;
    }
    if (
      url.origin !== providers[observing].home ||
      !endpointAllowed(observing, url.pathname)
    )
      return;
    const safe = sanitizeDiagnostic(
      {
        provider: observing,
        path: url.pathname,
        transport: "vault",
        status: details.statusCode,
      },
      now(),
    )!;
    const names = setCookieNames(details.responseHeaders ?? []);
    if (names.length)
      events = [
        ...events,
        { path: safe.path, status: safe.status, at: now(), names },
      ].slice(-200);
  }
  function stopObserver() {
    port.headers.removeListener(observer);
    if (observerTimer !== undefined) cancel(observerTimer);
    observing = undefined;
    observerTimer = undefined;
  }
  async function closePrivate() {
    const id = privateWindow;
    privateWindow = undefined;
    privateTab = undefined;
    if (id !== undefined) await port.windows.remove(id).catch(() => {});
  }
  async function execute(command: SpikeCommand): Promise<unknown> {
    if (closed) fail("closed");
    if (command.type === "cancel") {
      operation?.abort();
      return { cancelled: true };
    }
    if (command.type === "clear") {
      operation?.abort();
      captured = undefined;
      token = undefined;
      tokenExp = null;
      stopObserver();
      events = [];
      await initialize();
      await settled;
      captured = undefined;
      token = undefined;
      tokenExp = null;
      await closePrivate();
      if (!usable)
        try {
          const ids = (await port.dnr.getSessionRules())
            .filter((r) => r.id >= SPIKE_RULE_ID && r.id <= SPIKE_RULE_END)
            .map((r) => r.id);
          if (ids.length)
            await port.dnr.updateSessionRules({ removeRuleIds: ids });
          usable = true;
        } catch {
          fail("rule-cleanup-failed");
        }
      return { cleared: true };
    }
    await initialize();
    if (!usable) fail("rule-cleanup-failed");
    if (command.type === "ping")
      return { capture: captureInfo(), observing: observing ?? null };
    if (command.type === "observe" && command.action !== "start") {
      if (command.action === "stop") stopObserver();
      return { active: !!observing, rows: structuredClone(events) };
    }
    if (operation) fail("busy");
    const controller = new AbortController();
    operation = controller;
    let finish!: () => void;
    settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    try {
      const provider = "provider" in command ? command.provider : "chatgpt";
      if (!(await port.permitted(provider))) fail("site-access-required");
      checkActive(controller.signal);
      if (command.type === "cookies") return catalog(provider);
      if (command.type === "capture") {
        if (!(await stores()).some((s) => s.id === command.storeId))
          fail("store-unavailable");
        checkActive(controller.signal);
        const cookies = (
          await port.cookies.getAll({
            domain: new URL(providers[provider].home).hostname,
            storeId: command.storeId,
          })
        ).filter(
          (c) =>
            c.storeId === command.storeId &&
            command.names.includes(c.name) &&
            c.partitionKey === undefined &&
            (c.expirationDate === undefined || c.expirationDate > now() / 1000),
        );
        checkActive(controller.signal);
        try {
          cookieHeader(
            provider,
            "/",
            cookies.map((c) => ({ ...c, path: "/" })),
            now(),
          );
        } catch {
          fail("capture-invalid");
        }
        // Capture includes only the selected fields; no browser Cookie object escapes.
        captured = {
          provider,
          storeId: command.storeId,
          capturedAt: now(),
          cookies: cookies.map((c) => ({ ...c })),
        };
        token = undefined;
        tokenExp = null;
        return { capture: captureInfo() };
      }
      if (command.type === "compare") {
        await waitForProvider(provider);
        const rows: unknown[] = [],
          summaries = [];
        for (const variant of ["ambient", "headers", "replay"] as const) {
          if (controller.signal.aborted) fail("cancelled");
          if (variant === "replay" && captured?.provider !== provider) {
            summaries.push({ variant, result: "capture-required" });
            continue;
          }
          try {
            const trace: RequestTrace = {
              lastSuccessAt: null,
              record: async (input) => {
                const safe = sanitizeDiagnostic(input, now());
                if (safe) {
                  rows.push({
                    variant: "ambient",
                    path: safe.path,
                    status: safe.status,
                    contentType: safe.contentType,
                    cfMitigated: safe.cfMitigated,
                    retryAfter: safe.retryAfter,
                    transport: safe.transport,
                  });
                  await metadataWait(provider, safe.status, safe.retryAfter);
                }
              },
            };
            const ambient =
              variant === "ambient"
                ? port.ambient(provider, controller.signal, trace)
                : undefined;
            const read: ReadJSON = async (path, headers = {}, request) => {
              if (!endpointAllowed(provider, path))
                fail("endpoint-unavailable");
              await waitForProvider(provider);
              return ambient
                ? ambient(path, headers, request)
                : raw(
                    provider,
                    path,
                    variant as "headers" | "replay",
                    controller.signal,
                    headers,
                    request,
                    rows,
                  );
            };
            await readAccountProvider(provider, {}, read);
            summaries.push({ variant, result: "reader-validated" });
          } catch (error) {
            summaries.push({
              variant,
              result:
                error instanceof SpikeError
                  ? error.code
                  : error instanceof AdapterError
                    ? error.code
                    : "unverified-response",
            });
          }
        }
        await rememberWait(provider, now() + 15000);
        return {
          rows,
          summaries,
          capture: captureInfo(),
          nextEligibleAt: (await waits())[provider] ?? null,
        };
      }
      if (command.type === "token") {
        await waitForProvider("chatgpt");
        const rows: unknown[] = [];
        const read =
          command.source === "replay"
            ? (path: string) =>
                raw(
                  "chatgpt",
                  path,
                  "replay",
                  controller.signal,
                  {},
                  undefined,
                  rows,
                )
            : port.ambient("chatgpt", controller.signal, {
                lastSuccessAt: null,
                record: async (input) => {
                  const safe = sanitizeDiagnostic(input, now());
                  if (safe) {
                    rows.push({ path: safe.path, status: safe.status });
                    await metadataWait("chatgpt", safe.status, safe.retryAfter);
                  }
                },
              });
        const data = (await read("/api/auth/session")) as {
          accessToken?: unknown;
        } | null;
        checkActive(controller.signal);
        if (
          typeof data?.accessToken !== "string" ||
          !data.accessToken ||
          data.accessToken.length > 20000 ||
          /[\x00-\x20\x7F]/.test(data.accessToken)
        )
          fail("token-unavailable");
        token = data.accessToken;
        tokenExp = tokenExpiry(token);
        try {
          await raw(
            "chatgpt",
            "/backend-api/wham/usage",
            "bearer",
            controller.signal,
            { Authorization: `Bearer ${token}` },
            undefined,
            rows,
          );
        } catch (error) {
          if (!(error instanceof AdapterError)) throw error;
        }
        await rememberWait("chatgpt", now() + 15000);
        return {
          rows,
          exp: tokenExp,
          remainingSeconds:
            tokenExp === null
              ? null
              : Math.max(0, Math.floor((tokenExp - now()) / 1000)),
          signatureVerified: false,
        };
      }
      if (command.type === "bearer") {
        if (!token || (tokenExp !== null && tokenExp <= now()))
          fail("token-unavailable");
        const rows: { status: number }[] = [];
        try {
          await raw(
            "chatgpt",
            "/backend-api/wham/usage",
            "bearer",
            controller.signal,
            { Authorization: `Bearer ${token}` },
            undefined,
            rows,
          );
        } catch (error) {
          if (!rows.length) throw error;
        }
        await rememberWait("chatgpt", now() + 15000);
        return { status: rows[0]?.status ?? 0 };
      }
      if (command.type === "observe") {
        stopObserver();
        events = [];
        observing = provider;
        try {
          port.headers.addListener(
            observer,
            { urls: [providers[provider].origin] },
            ["responseHeaders", "extraHeaders"],
          );
        } catch {
          observing = undefined;
          fail("observation-unavailable");
        }
        observerTimer = schedule(stopObserver, 60000);
        return { active: true, seconds: 60 };
      }
      if (command.type === "private") {
        const allowed = await port.allowedPrivate();
        if (command.action === "close") await closePrivate();
        if (command.action === "open") {
          if (!allowed) fail("incognito-access-required");
          if (
            privateWindow !== undefined ||
            (await port.tabs.query({})).some((t) => t.incognito === true)
          )
            fail("private-window-exists");
          checkActive(controller.signal);
          const window = await port.windows.create({
            url: providers[provider].home,
            incognito: true,
            type: "popup",
            width: 520,
            height: 740,
          });
          if (window?.id === undefined) fail("private-window-unavailable");
          if (closed || controller.signal.aborted) {
            await port.windows.remove(window.id).catch(() => {});
            fail("cancelled");
          }
          privateWindow = window.id;
          privateTab = window.tabs?.[0]?.id;
        }
        const list = await catalog(provider);
        const owned = (await stores()).find(
          (s) => privateTab !== undefined && s.tabIds.includes(privateTab),
        );
        return {
          allowed,
          ownedWindow: privateWindow !== undefined,
          ownedStore: owned?.id ?? null,
          ...list,
        };
      }
      return null;
    } finally {
      if (operation === controller) operation = undefined;
      finish();
    }
  }
  async function dispose() {
    closed = true;
    operation?.abort();
    captured = undefined;
    token = undefined;
    tokenExp = null;
    stopObserver();
    events = [];
    await settled;
    captured = undefined;
    token = undefined;
    tokenExp = null;
    await closePrivate();
  }
  return { initialize, execute, dispose };
}
