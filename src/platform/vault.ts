import type { ProviderId } from "../core/model";
import {
  VAULT_KEY,
  VaultEnvelopeSchema,
  VaultSlotSchema,
  VaultError,
  validateVaultPayload,
  vaultNotAfter,
  type VaultEnvelope,
  type VaultPayload,
  type VaultMetadata,
} from "../core/vault-contracts";
import { validVaultKey, type VaultKeyStore } from "./vault-key-store";
export interface VaultPort {
  local: {
    get(key: string): Promise<Record<string, unknown>>;
    set(values: Record<string, unknown>): Promise<unknown>;
    setAccessLevel(options: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
  };
  keys: VaultKeyStore;
  crypto: Crypto;
  now(): number;
  enabled(provider: ProviderId): boolean;
  allowlist(provider: ProviderId): readonly string[];
  /** Exclusive across every writer to this storage key (e.g. injected Web Locks). */
  lock<T>(run: () => Promise<T>): Promise<T>;
}
const encode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export function createVault(port: VaultPort) {
  let protectedStore: Promise<void> | undefined;
  const slot = (value: string) => {
    if (!VaultSlotSchema.safeParse(value).success)
      throw new VaultError("invalid-slot");
  };
  const enabled = (provider: ProviderId) => {
    if (!port.enabled(provider)) throw new VaultError("disabled");
  };
  async function read(): Promise<VaultEnvelope> {
    try {
      protectedStore ??= port.local.setAccessLevel({
        accessLevel: "TRUSTED_CONTEXTS",
      });
      await protectedStore;
      const raw = (await port.local.get(VAULT_KEY))[VAULT_KEY];
      if (raw === undefined) return { version: 1, entries: {} };
      const parsed = VaultEnvelopeSchema.safeParse(raw, { jitless: true });
      if (!parsed.success) throw new VaultError("corrupt");
      return parsed.data;
    } catch (e) {
      if (e instanceof VaultError) throw e;
      throw new VaultError("storage-unavailable");
    }
  }
  async function write(value: VaultEnvelope) {
    try {
      await port.local.set({ [VAULT_KEY]: value });
    } catch {
      throw new VaultError("storage-unavailable");
    }
  }
  function meta(
    slot: string,
    e: VaultEnvelope["entries"][string],
  ): VaultMetadata {
    return {
      slot,
      provider: e.provider,
      capturedAt: e.capturedAt,
      notAfter: e.notAfter,
      cookieNames: [...e.cookieNames],
    };
  }
  return {
    async putVault(
      id: string,
      provider: ProviderId,
      raw: unknown,
    ): Promise<VaultMetadata> {
      slot(id);
      enabled(provider);
      const payload = validateVaultPayload(
        provider,
        raw,
        port.allowlist(provider),
      );
      return port.lock(async () => {
        enabled(provider);
        const saved = await read();
        if (!saved.entries[id] && Object.keys(saved.entries).length >= 100)
          throw new VaultError("full");
        if (saved.entries[id] && saved.entries[id]!.provider !== provider)
          throw new VaultError("provider-mismatch");
        let key: CryptoKey | undefined;
        try {
          key = await port.keys.load();
          if (!key && Object.keys(saved.entries).length)
            throw new VaultError("key-unavailable");
          key ??= await port.keys.create();
        } catch {
          throw new VaultError("key-unavailable");
        }
        if (!validVaultKey(key)) throw new VaultError("key-unavailable");
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        try {
          const nonce = port.crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await port.crypto.subtle.encrypt(
            {
              name: "AES-GCM",
              iv: nonce,
              additionalData: new TextEncoder().encode(`${id}|${provider}`),
            },
            key,
            bytes,
          );
          const entry = {
            provider,
            capturedAt: port.now(),
            notAfter: vaultNotAfter(payload),
            cookieNames: payload.cookies.map((c) => c.name),
            nonce: encode(nonce),
            ciphertext: encode(new Uint8Array(encrypted)),
          };
          const checked = VaultEnvelopeSchema.safeParse(
            { ...saved, entries: { ...saved.entries, [id]: entry } },
            { jitless: true },
          );
          if (!checked.success) throw new VaultError("invalid-payload");
          enabled(provider);
          await write(checked.data);
          return meta(id, entry);
        } catch (e) {
          if (e instanceof VaultError) throw e;
          throw new VaultError("encryption-failed");
        } finally {
          bytes.fill(0);
        }
      });
    },
    async getVault(
      id: string,
      expectedProvider?: ProviderId,
    ): Promise<{ metadata: VaultMetadata; payload: VaultPayload } | null> {
      slot(id);
      return port.lock(async () => {
        const e = (await read()).entries[id];
        if (!e) return null;
        enabled(e.provider);
        if (expectedProvider !== undefined && expectedProvider !== e.provider)
          throw new VaultError("provider-mismatch");
        let bytes: Uint8Array | undefined;
        try {
          const key = await port.keys.load();
          if (!validVaultKey(key)) throw new VaultError("key-unavailable");
          bytes = new Uint8Array(
            await port.crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv: decode(e.nonce),
                additionalData: new TextEncoder().encode(`${id}|${e.provider}`),
              },
              key,
              decode(e.ciphertext),
            ),
          );
          const payload = validateVaultPayload(
            e.provider,
            JSON.parse(new TextDecoder().decode(bytes)),
            port.allowlist(e.provider),
          );
          if (
            vaultNotAfter(payload) !== e.notAfter ||
            JSON.stringify(payload.cookies.map((c) => c.name)) !==
              JSON.stringify(e.cookieNames)
          )
            throw new VaultError("corrupt");
          enabled(e.provider);
          return { metadata: meta(id, e), payload };
        } catch (e) {
          if (e instanceof VaultError) throw e;
          throw new VaultError("corrupt");
        } finally {
          bytes?.fill(0);
        }
      });
    },
    async deleteVault(id: string) {
      slot(id);
      return port.lock(async () => {
        const saved = await read();
        if (!saved.entries[id]) return;
        delete saved.entries[id];
        await write(saved);
      });
    },
    async listVault(): Promise<VaultMetadata[]> {
      return port.lock(async () =>
        Object.entries((await read()).entries).map(([id, e]) => meta(id, e)),
      );
    },
  };
}
