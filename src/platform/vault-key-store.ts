import { VaultError } from "../core/vault-contracts";
export interface VaultKeyStore {
  load(): Promise<CryptoKey | undefined>;
  create(): Promise<CryptoKey>;
}
export function validVaultKey(key: unknown): key is CryptoKey {
  const k = key as CryptoKey | undefined;
  return (
    !!k &&
    k.type === "secret" &&
    k.extractable === false &&
    k.algorithm?.name === "AES-GCM" &&
    (k.algorithm as AesKeyAlgorithm).length === 256 &&
    Array.isArray(k.usages) &&
    k.usages.length === 2 &&
    k.usages.includes("encrypt") &&
    k.usages.includes("decrypt")
  );
}
/** Browser globals are injected. IDB read/write chooses one key even across contexts. */
export function createIndexedDBVaultKeys(port: {
  indexedDB: IDBFactory;
  crypto: Crypto;
}): VaultKeyStore {
  async function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = port.indexedDB.open("mylimits-vault-key", 1);
      let abandoned = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("keys"))
          request.result.createObjectStore("keys");
      };
      request.onerror = () => reject(new VaultError("key-unavailable"));
      request.onblocked = () => {
        abandoned = true;
        reject(new VaultError("key-unavailable"));
      };
      request.onsuccess = () => {
        if (abandoned) {
          request.result.close();
          return;
        }
        resolve(request.result);
      };
    });
  }
  async function access(candidate?: CryptoKey): Promise<CryptoKey | undefined> {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", candidate ? "readwrite" : "readonly"),
          store = tx.objectStore("keys");
        let key: CryptoKey | undefined;
        tx.onabort = tx.onerror = () =>
          reject(new VaultError("key-unavailable"));
        tx.oncomplete = () => resolve(key);
        const get = store.get("primary");
        get.onsuccess = () => {
          if (get.result !== undefined) {
            if (!validVaultKey(get.result)) {
              tx.abort();
              return;
            }
            key = get.result;
          } else if (candidate) {
            key = candidate;
            store.add(candidate, "primary");
          }
        };
      });
    } finally {
      db.close();
    }
  }
  return {
    load: () => access(),
    create: async () => {
      try {
        const existing = await access();
        if (existing) return existing;
        const candidate = await port.crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
        return (await access(candidate))!;
      } catch {
        throw new VaultError("key-unavailable");
      }
    },
  };
}
