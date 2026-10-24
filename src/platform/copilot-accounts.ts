import type { Store } from "../core/model";
import { accountId, applySnapshot } from "../core/engine";
import { changeConnection } from "../core/connections";
import { readCopilot } from "./copilot";
interface Port {
  readStore(): Promise<Store>;
  updateStore<T>(fn: (s: Store) => { store: Store; value: T }): Promise<T>;
  tokens: {
    put(slot: string, token: string): Promise<void>;
    delete(slot: string): Promise<void>;
  };
  request: (url: string, options: RequestInit) => Promise<Response>;
  permitted(): Promise<boolean>;
  uuid(): string;
  now(): number;
  cancel(id: string): void;
  accepted(account: string, source: string): Promise<void>;
  lock<T>(id: string, fn: () => Promise<T>): Promise<T>;
}
export class CopilotAccountError extends Error {
  readonly code: "duplicate-account" | "wrong-account";
  constructor(code: "duplicate-account" | "wrong-account") {
    super(
      code === "duplicate-account"
        ? "This GitHub account is already connected. Create a token for your other GitHub account, or replace the existing token."
        : "This token belongs to another GitHub account. Add it as a new account instead.",
    );
    this.code = code;
  }
}
/** Tokens are passed directly to the encrypted vault; never materialized in Store. */
export function createCopilotAccounts(p: Port) {
  async function disconnect(id: string) {
    const c = (await p.readStore()).connections.find(
      (c) => c.id === id && c.kind === "copilot",
    );
    if (!c) return;
    if (!c.profileId || c.id !== `copilot:${c.profileId}`)
      throw Error("Invalid Copilot connection.");
    p.cancel(id);
    await p.updateStore((s) => ({
      store: changeConnection(
        s,
        id,
        { enabled: false, status: "disabled" },
        true,
      ),
      value: undefined,
    }));
    await p.tokens.delete(c.profileId);
    await p.updateStore((s) => ({
      store: { ...s, connections: s.connections.filter((c) => c.id !== id) },
      value: undefined,
    }));
  }
  return {
    disconnect: (id: string) => p.lock(id, () => disconnect(id)),
    connect: (token: string, reconnectId?: string, quotaAccess?: boolean) =>
      p.lock(reconnectId ?? p.uuid(), () =>
        connect(token, reconnectId, quotaAccess),
      ),
  };
  async function connect(
    token: string,
    reconnectId?: string,
    quotaAccess?: boolean,
  ) {
    if (!(await p.permitted())) throw Error("Allow GitHub API access first.");
    const initial = await p.readStore(),
      old = reconnectId
        ? initial.connections.find(
            (c) => c.id === reconnectId && c.kind === "copilot",
          )
        : undefined;
    if (reconnectId && !old)
      throw Error("Copilot connection is no longer saved.");
    const slot = old?.profileId ?? p.uuid(),
      id = `copilot:${slot}`,
      now = p.now();
    if (old && old.id !== id) throw Error("Invalid Copilot connection.");
    const snapshot = await readCopilot(
      token,
      old?.copilotAllowance ?? null,
      now,
      p.request,
      undefined,
      quotaAccess ?? old?.copilotQuotaAccess ?? false,
    );
    const identity = await accountId(
      "copilot",
      snapshot.identity,
      initial.installSalt,
    );
    if (old?.accountId && old.accountId !== identity)
      throw new CopilotAccountError("wrong-account");
    const checkDuplicate = (s: Store) => {
      if (
        !old &&
        s.connections.some(
          (c) => c.kind === "copilot" && c.accountId === identity && c.enabled,
        )
      )
        throw new CopilotAccountError("duplicate-account");
    };
    // Fence in-flight quota reads before replacement; lifecycle mutations share a per-source lock.
    p.cancel(id);
    const generation = await p.updateStore((s) => {
      checkDuplicate(s);
      const current = s.connections.find((c) => c.id === id);
      if (old && (!current || current.generation !== old.generation))
        throw Error("Connection changed. Try again.");
      if (
        (s.accounts.length >= 100 &&
          !s.accounts.some((a) => a.id === identity)) ||
        (s.connections.length >= 200 && !current)
      )
        throw Error("Saved account limit reached.");
      const next = old
        ? changeConnection(s, id, { enabled: false, status: "disabled" }, true)
        : s;
      return { store: next, value: old ? old.generation + 1 : 0 };
    });
    await p.tokens.put(slot, token);
    try {
      await p.updateStore((s) => {
        checkDuplicate(s);
        const current = s.connections.find((c) => c.id === id);
        if (old && (!current || current.generation !== generation))
          throw Error("Connection changed. Try again.");
        const source = {
          id,
          provider: "copilot" as const,
          kind: "copilot" as const,
          accountId: identity,
          workspaceId: null,
          workspaceIds: [],
          enabled: true,
          status: "active" as const,
          generation,
          lastAttemptAt: now,
          lastSuccessAt: null,
          nextRetryAt: null,
          failures: 0,
          message: null,
          profileId: slot,
          copilotAllowance: old?.copilotAllowance ?? null,
          copilotQuotaAccess: quotaAccess ?? old?.copilotQuotaAccess ?? false,
        };
        const base = {
          ...s,
          connections: [...s.connections.filter((c) => c.id !== id), source],
        };
        return {
          store: applySnapshot(base, "copilot", identity, snapshot, now, {
            connectionId: id,
            workspaceId: null,
            generation,
          }),
          value: undefined,
        };
      });
    } catch (e) {
      await p.tokens.delete(slot);
      throw e;
    }
    await p.accepted(identity, id);
  }
}
