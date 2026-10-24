import type { Store } from "../core/model";
import { parseConnectionId } from "../core/connection-id";
import { changeConnection, projectAccounts } from "../core/connections";
import { VaultError } from "../core/vault-contracts";
interface Port {
  readStore(): Promise<Store>;
  updateStore<T>(fn: (s: Store) => { store: Store; value: T }): Promise<T>;
  deleteSlot(slot: string): Promise<unknown>;
  cancelRefresh(id: string): void;
  cancelSetup(id: string): Promise<unknown>;
}
/** Fence before deleting; retain a retryable disabled source if credential deletion fails. */
export function createVaultLifecycle(port: Port) {
  async function disconnect(id: string) {
    const before = await port.readStore(),
      source = before.connections.find((c) => c.id === id);
    if (!source || source.kind !== "vault") return;
    const parsed = parseConnectionId(id);
    if (
      parsed?.kind !== "vault" ||
      parsed.provider !== source.provider ||
      parsed.slot !== source.profileId
    )
      throw new VaultError("invalid-source");
    const setup = before.accountSetup;
    if (setup?.method === "private" && setup.slotId === parsed.slot)
      await port.cancelSetup(setup.id);
    port.cancelRefresh(id);
    const generation = await port.updateStore((s) => {
      const current = s.connections.find((c) => c.id === id);
      if (!current) return { store: s, value: null };
      const next = changeConnection(
        s,
        id,
        {
          enabled: false,
          status: "disabled",
          nextRetryAt: null,
          message: "Removing saved sign-in…",
        },
        true,
      );
      return { store: next, value: current.generation + 1 };
    });
    if (generation === null) return;
    try {
      await port.deleteSlot(parsed.slot);
    } catch {
      await port.updateStore((s) => ({
        store: s.connections.some(
          (c) => c.id === id && c.generation === generation,
        )
          ? changeConnection(s, id, {
              message: "Could not delete saved sign-in. Retry removal.",
            })
          : s,
        value: undefined,
      }));
      throw new VaultError("deletion-failed");
    }
    await port.updateStore((s) => ({
      store: projectAccounts({
        ...s,
        connections: s.connections.filter(
          (c) => c.id !== id || c.generation !== generation,
        ),
      }),
      value: undefined,
    }));
  }
  return {
    disconnect,
    async forget(accountId: string) {
      const sources = (await port.readStore()).connections.filter(
        (c) => c.kind === "vault" && c.accountId === accountId,
      );
      for (const source of sources) await disconnect(source.id);
    },
  };
}
