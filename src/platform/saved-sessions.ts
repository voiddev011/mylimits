import type { browser as BrowserAPI } from "wxt/browser";
import { z } from "zod";
import { ProviderSchema } from "../core/schema";
import { VAULT_COOKIE_ALLOWLIST, vaultEnabled } from "../core/vault-policy";
import { VaultError } from "../core/vault-contracts";
import { PRIVATE_ALARM } from "../core/private-signin";
import {
  PROVIDER_IDS,
  type ConnectionRecord,
  type ProviderId,
  type Store,
} from "../core/model";
import { parseConnectionId } from "../core/connection-id";
import { providers } from "../providers/catalog";
import { readAccountProvider, type ReaderOptions } from "../providers/reader";
import { AdapterError } from "../providers/errors";
import { createVault } from "./vault";
import { createIndexedDBVaultKeys } from "./vault-key-store";
import { createVaultTransport } from "./vault-transport";
import { createPrivateSignIn } from "./private-signin";
import { createVaultLifecycle } from "./vault-lifecycle";
import type { RequestTrace } from "./diagnostics";
const WAITS = "mylimits:vault-waits:v1";
const Waits = z.partialRecord(
  ProviderSchema,
  z.number().int().min(0).max(8.64e15),
);
interface SavedPort {
  browser: Pick<
    typeof BrowserAPI,
    | "runtime"
    | "storage"
    | "permissions"
    | "tabs"
    | "windows"
    | "cookies"
    | "extension"
    | "alarms"
  >;
  crypto: Crypto;
  indexedDB: IDBFactory;
  locks: Pick<LockManager, "request">;
  supported: boolean;
  request(url: string, options: RequestInit): Promise<Response>;
  readStore(): Promise<Store>;
  updateStore<T>(fn: (s: Store) => { store: Store; value: T }): Promise<T>;
  accepted(accountId: string, connectionId: string): Promise<void>;
  lock<T>(host: string, fn: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  ready(): Promise<void>;
  blockHost(host: string): void;
  dnr: import("./vault-transport").VaultDNR;
  now(): number;
  uuid(): string;
  trace: RequestTrace;
  policy?: {
    enabled(p: ProviderId): boolean;
    allowlist(p: ProviderId): readonly string[];
  };
  cancelRefresh(id: string): void;
}
/** Actual browser bindings; no credential material is returned through runtime messages. */
export function createSavedSessions(port: SavedPort) {
  const b = port.browser,
    enabled = (p: ProviderId) =>
      port.supported && (port.policy?.enabled(p) ?? vaultEnabled(p)),
    allowlist = (p: ProviderId) =>
      port.policy?.allowlist(p) ?? VAULT_COOKIE_ALLOWLIST[p];
  const local = b.storage.local;
  const vault = createVault({
    local,
    crypto: port.crypto,
    keys: createIndexedDBVaultKeys(port),
    now: port.now,
    enabled,
    allowlist,
    lock: async (run) => await port.locks.request("mylimits:vault:v1", run),
  });
  async function waits(): Promise<Partial<Record<ProviderId, number>>> {
    try {
      const raw = (await local.get(WAITS))[WAITS];
      return raw === undefined ? {} : Waits.parse(raw, { jitless: true });
    } catch {
      throw new VaultError("cooldown-storage-unavailable");
    }
  }
  async function remember(provider: ProviderId, until: number) {
    try {
      await port.locks.request(WAITS, async () => {
        const old = await waits();
        await local.set({
          [WAITS]: {
            ...old,
            [provider]: Math.max(
              old[provider] ?? 0,
              Math.min(port.now() + 86400000, until),
            ),
          },
        });
      });
    } catch {
      throw new VaultError("cooldown-storage-unavailable");
    }
  }
  const permitted = (provider: ProviderId) =>
    b.permissions.contains({
      permissions: ["cookies", "declarativeNetRequestWithHostAccess"],
      origins: [providers[provider].origin],
    });
  let signin: ReturnType<typeof createPrivateSignIn>;
  const transport = createVaultTransport({
    ...port,
    enabled,
    permitted,
    now: port.now,
    extensionId: b.runtime.id,
    getVault: async (slot, provider) => {
      const payload = signin.pendingPayload(slot);
      return payload ? { payload } : vault.getVault(slot, provider);
    },
    async wait(provider) {
      if ((await waits())[provider]! > port.now())
        throw new VaultError("cooldown");
    },
    rememberWait: remember,
  });
  async function read(
    provider: ProviderId,
    slot: string,
    options: ReaderOptions,
    signal: AbortSignal,
    trace: RequestTrace,
  ) {
    const request = transport.read(provider, slot, signal, trace);
    try {
      return await readAccountProvider(provider, options, async (...args) => {
        try {
          return await request(...args);
        } catch (e) {
          // Count actual HTTP authentication rejections, not a malformed/missing identity response.
          if (
            e instanceof AdapterError &&
            e.status === "signed-out" &&
            e.code === "signed-out"
          )
            throw new AdapterError(
              "signed-out",
              "Saved sign-in was rejected.",
              e.retryAt,
              "saved-http-401",
            );
          throw e;
        }
      });
    } catch (e) {
      if (e instanceof AdapterError) {
        if (e.code === "challenge" || e.status === "waiting-for-tab")
          throw new AdapterError(
            "unavailable",
            "Saved sign-in needs a browser check. Re-sign in if it continues.",
            e.retryAt,
            "challenge",
          );
        throw e;
      }
      if (e instanceof VaultError) {
        if (
          ["missing", "expired", "key-unavailable", "corrupt"].includes(e.code)
        )
          throw new AdapterError(
            "signed-out",
            "Saved sign-in is unavailable. Re-sign in.",
            null,
            "saved-expired",
          );
        if (e.code === "cooldown")
          throw new AdapterError(
            "error",
            "The provider asked us to wait before refreshing.",
            (await waits())[provider] ?? null,
            "rate-limit",
          );
      }
      throw new AdapterError(
        "unavailable",
        enabled(provider)
          ? "Saved sign-in could not be read. Its last reading is retained."
          : "Saved sign-in is not available. Provider evidence and setup are still required.",
        null,
        "saved-unavailable",
      );
    }
  }
  signin = createPrivateSignIn({
    readStore: port.readStore,
    updateStore: port.updateStore,
    enabled,
    allowlist,
    permitted,
    allowedPrivate: () => b.extension.isAllowedIncognitoAccess(),
    tabs: b.tabs,
    windows: b.windows,
    cookies: b.cookies,
    session: b.storage.session,
    arm: (when) => b.alarms.create(PRIVATE_ALARM, { when }),
    disarm: () => b.alarms.clear(PRIVATE_ALARM),
    uuid: port.uuid,
    now: port.now,
    async verify(provider, slot, signal) {
      try {
        return await read(provider, slot, {}, signal, port.trace);
      } finally {
        await remember(provider, port.now() + 15000);
      }
    },
    put: vault.putVault,
    delete: vault.deleteVault,
    accepted: port.accepted,
  });
  let cookiesBound = false,
    windowsBound = false;
  const lifecycle = createVaultLifecycle({
    ...port,
    deleteSlot: vault.deleteVault,
    cancelSetup: signin.cancel,
  });
  return {
    ...signin,
    disconnect: lifecycle.disconnect,
    forget: lifecycle.forget,
    async readConnection(
      c: ConnectionRecord,
      options: ReaderOptions,
      signal: AbortSignal,
      trace: RequestTrace,
    ) {
      const id = parseConnectionId(c.id);
      if (
        c.kind !== "vault" ||
        !c.profileId ||
        id?.kind !== "vault" ||
        id.provider !== c.provider ||
        id.slot !== c.profileId
      )
        throw new AdapterError(
          "unavailable",
          "Saved sign-in metadata is unavailable.",
          null,
          "saved-unavailable",
        );
      return read(c.provider, c.profileId, options, signal, trace);
    },
    bind() {
      // Listener registration is synchronous; the current production policy is all off.
      if (!port.supported) return;
      if (!cookiesBound && PROVIDER_IDS.some(enabled))
        try {
          b.cookies.onChanged.addListener((event) => {
            void signin.cookieChanged(event).catch(() => {});
          });
          cookiesBound = true;
        } catch {
          /* Optional cookie access can be absent. */
        }
      if (!windowsBound) {
        b.windows.onRemoved.addListener((id) => {
          void signin.windowRemoved(id).catch(() => {});
        });
        windowsBound = true;
      }
    },
    async permissionsChanged() {
      const s = await port.readStore();
      if (
        s.accountSetup?.method === "private" &&
        !(await permitted(s.accountSetup.provider))
      )
        await signin.cancel(s.accountSetup.id);
    },
  };
}
