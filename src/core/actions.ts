import { type Account, type ProviderId, type Store } from "./model";
import { changeConnection } from "./connections";
export function providerAccessInUse(store: Store, provider: ProviderId) {
  return store.connections.some(
    (c) =>
      c.provider === provider &&
      c.enabled &&
      (c.kind === "website" || c.kind === "vault"),
  );
}
export function enableWebsite(
  store: Store,
  provider: ProviderId,
  enabled: boolean,
): Store {
  let next = changeConnection(
    store,
    `website:${provider}`,
    {
      enabled,
      status: enabled ? "unavailable" : "disabled",
      message: enabled ? null : "Website tracking is off.",
      lastAttemptAt: null,
      nextRetryAt: null,
      failures: 0,
    },
    true,
  );
  next = {
    ...next,
    providers: {
      ...next.providers,
      [provider]: {
        ...next.providers[provider],
        enabled,
        status: enabled ? "inactive" : "disabled",
        activeAccountId: enabled
          ? next.providers[provider].activeAccountId
          : null,
        message: enabled ? null : "Website tracking is off.",
        checkedAt: null,
        nextRetryAt: null,
        failures: 0,
      },
    },
  };
  return next;
}
export function setWorkspace(
  store: Store,
  connectionId: string,
  workspaceId: string | null,
): Store {
  const c = store.connections.find((c) => c.id === connectionId);
  if (!c || c.kind !== "website" || c.provider !== "claude")
    throw new Error(
      "Workspace selection is not available for this connection.",
    );
  if (
    workspaceId !== null &&
    (!c.workspaceIds.includes(workspaceId) ||
      !store.workspaces.some(
        (w) => w.id === workspaceId && w.provider === c.provider,
      ))
  )
    throw new Error("Choose one of this connection’s verified workspaces.");
  return changeConnection(
    store,
    connectionId,
    {
      workspaceId,
      enabled: true,
      status: "unavailable",
      nextRetryAt: null,
      lastAttemptAt: null,
      message: "Refreshing selected workspace.",
    },
    true,
  );
}
export function accountPreferences(
  store: Store,
  id: string,
  patch: Pick<Partial<Account>, "pinned" | "snoozedUntil">,
): Store {
  const a = store.accounts.find((a) => a.id === id);
  if (!a) throw new Error("This account is no longer saved.");
  return {
    ...store,
    accounts: store.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}
export function forgetAccount(store: Store, id: string): Store {
  const a = store.accounts.find((a) => a.id === id);
  if (!a) return store;
  let next = store;
  for (const c of store.connections.filter((c) => c.accountId === id)) {
    next = changeConnection(
      next,
      c.id,
      {
        enabled: false,
        status: "disabled",
        accountId: null,
        workspaceId: null,
        workspaceIds: [],
        message: "Account forgotten.",
      },
      true,
    );
    if (c.kind === "website")
      next = {
        ...next,
        providers: {
          ...next.providers,
          [c.provider]: {
            ...next.providers[c.provider],
            enabled: false,
            status: "disabled",
            activeAccountId: null,
          },
        },
      };
  }
  const remaining = next.accounts.filter((a) => a.id !== id);
  const used = new Set([
    ...remaining.map((a) => a.workspaceId),
    ...next.connections
      .filter((c) => c.accountId !== null)
      .flatMap((c) => c.workspaceIds),
  ]);
  return {
    ...next,
    accounts: remaining,
    workspaces: next.workspaces.filter((w) => used.has(w.id)),
    snapshots: next.snapshots.filter((s) => s.accountId !== id),
    connections: next.connections,
    resetLedger: Object.fromEntries(
      Object.entries(next.resetLedger).filter(
        ([key]) => !key.startsWith(`${id}/`),
      ),
    ),
    alertLedger: Object.fromEntries(
      Object.entries(next.alertLedger).filter(
        ([key]) => !key.startsWith(`${id}/`),
      ),
    ),
  };
}
