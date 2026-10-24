import type { VaultKeyStore } from "./vault-key-store";
import { validVaultKey } from "./vault-key-store";
export const TOKEN_KEY = "mylimits:tokens:v1";
interface Port {
  local: {
    get(k: string): Promise<Record<string, unknown>>;
    set(v: Record<string, unknown>): Promise<unknown>;
    setAccessLevel(o: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
  };
  keys: VaultKeyStore;
  crypto: Crypto;
  lock<T>(fn: () => Promise<T>): Promise<T>;
}
const slotValid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  encode = (b: Uint8Array) => btoa(String.fromCharCode(...b)),
  decode = (s: string) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
export function createTokenVault(p: Port) {
  const fail = () => Error("Encrypted token storage unavailable.");
  async function read() {
    await p.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    const raw = (await p.local.get(TOKEN_KEY))[TOKEN_KEY];
    if (raw === undefined)
      return {} as Record<string, { iv: string; data: string }>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw fail();
    const entries = Object.entries(raw);
    if (
      entries.length > 200 ||
      entries.some(([slot, value]) => {
        const e = value as { iv?: unknown; data?: unknown };
        return (
          !slotValid(slot) ||
          !e ||
          typeof e !== "object" ||
          typeof e.iv !== "string" ||
          !/^[A-Za-z0-9+/]{16}$/.test(e.iv) ||
          typeof e.data !== "string" ||
          e.data.length > 1024 ||
          !/^[A-Za-z0-9+/]+=*$/.test(e.data)
        );
      })
    )
      throw fail();
    return structuredClone(raw) as Record<string, { iv: string; data: string }>;
  }
  return {
    async put(slot: string, token: string) {
      try {
        if (
          !slotValid(slot) ||
          !/^github_pat_[A-Za-z0-9_]{10,490}$/.test(token)
        )
          throw fail();
        await p.lock(async () => {
          const all = await read();
          if (!all[slot] && Object.keys(all).length >= 200) throw fail();
          let key = await p.keys.load();
          if (
            !key &&
            (Object.keys(all).length ||
              Object.keys(
                (
                  (await p.local.get("mylimits:vault:v1"))[
                    "mylimits:vault:v1"
                  ] as { entries?: object } | undefined
                )?.entries ?? {},
              ).length)
          )
            throw fail();
          key ??= await p.keys.create();
          if (!validVaultKey(key)) throw fail();
          const iv = p.crypto.getRandomValues(new Uint8Array(12)),
            bytes = new TextEncoder().encode(token);
          try {
            const data = await p.crypto.subtle.encrypt(
              {
                name: "AES-GCM",
                iv,
                additionalData: new TextEncoder().encode(`copilot:${slot}`),
              },
              key,
              bytes,
            );
            all[slot] = { iv: encode(iv), data: encode(new Uint8Array(data)) };
            await p.local.set({ [TOKEN_KEY]: all });
          } finally {
            bytes.fill(0);
          }
        });
      } catch {
        throw fail();
      }
    },
    async get(slot: string) {
      try {
        if (!slotValid(slot)) throw fail();
        return await p.lock(async () => {
          const all = await read(),
            entry = all[slot],
            key = await p.keys.load();
          if (!entry || !validVaultKey(key)) throw fail();
          const bytes = new Uint8Array(
            await p.crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv: decode(entry.iv),
                additionalData: new TextEncoder().encode(`copilot:${slot}`),
              },
              key,
              decode(entry.data),
            ),
          );
          try {
            return new TextDecoder().decode(bytes);
          } finally {
            bytes.fill(0);
          }
        });
      } catch {
        throw fail();
      }
    },
    async delete(slot: string) {
      try {
        if (!slotValid(slot)) throw fail();
        await p.lock(async () => {
          const all = await read();
          delete all[slot];
          await p.local.set({ [TOKEN_KEY]: all });
        });
      } catch {
        throw fail();
      }
    },
  };
}
