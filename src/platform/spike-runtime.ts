import type { browser as BrowserAPI } from "wxt/browser";
import { z } from "zod";
import {
  SpikeCommandSchema,
  SPIKE_PORT,
  SPIKE_MARKER,
  spikeSenderAllowed,
} from "../core/spike";
import { createSpikeSession, SpikeError, type SpikePort } from "./spike";
import { ambientTransport } from "../providers/adapters";
import { providers } from "../providers/catalog";
import { withHostLock } from "./host-lock";
import { AdapterError } from "../providers/errors";

const Packet = z
  .object({
    id: z.number().int().min(1).max(1000000000),
    command: SpikeCommandSchema,
  })
  .strict();
/** Only the opt-in spike entrypoint imports this module. Production has no listener. */
export async function startSpikeRuntime(
  browser: Pick<
    typeof BrowserAPI,
    | "runtime"
    | "cookies"
    | "tabs"
    | "windows"
    | "extension"
    | "permissions"
    | "declarativeNetRequest"
    | "webRequest"
    | "storage"
  >,
  request: (url: string, options: RequestInit) => Promise<Response>,
) {
  void SPIKE_MARKER;
  const port: SpikePort = {
    extensionId: browser.runtime.id,
    now: () => Date.now(),
    cookies: browser.cookies,
    tabs: browser.tabs,
    windows: browser.windows,
    allowedPrivate: () => browser.extension.isAllowedIncognitoAccess(),
    permitted: (p) =>
      browser.permissions.contains({ origins: [providers[p].origin] }),
    dnr: browser.declarativeNetRequest,
    headers: browser.webRequest.onHeadersReceived,
    storage: browser.storage.session,
    request,
    ambient: (provider, signal, trace) =>
      ambientTransport(provider, signal, trace),
    lock: withHostLock,
  };
  const startup = createSpikeSession(port);
  await startup.initialize();
  await startup.dispose();
  let owner: ReturnType<typeof browser.runtime.connect> | undefined;
  browser.runtime.onConnect.addListener((connection) => {
    if (
      connection.name !== SPIKE_PORT ||
      owner ||
      !spikeSenderAllowed(
        connection.sender ?? {},
        browser.runtime.id,
        browser.runtime.getURL("/") + "spike.html",
      )
    ) {
      connection.disconnect();
      return;
    }
    owner = connection;
    let attached = true;
    const session = createSpikeSession(port);
    connection.onMessage.addListener((raw) => {
      const packet = Packet.safeParse(raw);
      if (!packet.success) {
        connection.postMessage({
          id: Number.isSafeInteger(raw?.id) ? raw.id : 0,
          ok: false,
          code: "invalid-request",
        });
        return;
      }
      void session.execute(packet.data.command).then(
        (data) => {
          if (attached)
            connection.postMessage({ id: packet.data.id, ok: true, data });
        },
        (error) => {
          if (attached)
            connection.postMessage({
              id: packet.data.id,
              ok: false,
              code:
                error instanceof SpikeError
                  ? error.code
                  : error instanceof AdapterError
                    ? "provider-rejected"
                    : "probe-unavailable",
            });
        },
      );
    });
    connection.onDisconnect.addListener(() => {
      attached = false;
      void session
        .dispose()
        .catch(() => {})
        .finally(() => {
          if (owner === connection) owner = undefined;
        });
    });
    connection.postMessage({ type: "ready" });
  });
}
