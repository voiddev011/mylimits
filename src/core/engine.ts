import { privateAccountName } from "./presentation";
import { isQuiet, alertKey, confirmedReset } from "./alert-policy";
import { acceptSnapshot, projectAccounts } from "./connections";
import { websiteId } from "./connection-id";
import {
  type Account,
  type Meter,
  type ProviderId,
  type Store,
  accountName,
  alertThresholds,
  isFresh,
  remainingPercent,
} from "./model";

export interface Snapshot {
  identity: string;
  kind: Account["kind"];
  displayName: string;
  plan: string | null;
  meters: Meter[];
  workspace?: { identity: string; name: string };
  workspaces?: { identity: string; name: string }[];
}

export async function accountId(
  provider: ProviderId,
  identity: string,
  salt: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    `${salt}\u0000${provider}\u0000${identity}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `${provider}:${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function applySnapshot(
  store: Store,
  provider: ProviderId,
  id: string,
  snapshot: Omit<Snapshot, "identity">,
  now: number,
  options: {
    connectionId?: string;
    workspaceId?: string | null;
    observedAt?: number;
    generation?: number;
  } = {},
): Store {
  const previous = store.accounts.find((account) => account.id === id);
  const localMeters = (previous?.meters ?? []).filter(
    (meter) => meter.evidence === "observed",
  );
  const incomingIds = new Set(snapshot.meters.map((meter) => meter.id));
  const account: Account = {
    ...previous,
    id,
    provider,
    kind: snapshot.kind,
    alias: previous?.alias ?? "",
    defaultName:
      previous?.defaultName ??
      (store.connections.find(
        (c) => c.id === (options.connectionId ?? `website:${provider}`),
      )?.kind === "website" &&
      ["claude", "chatgpt", "cursor"].includes(provider)
        ? `${provider === "chatgpt" ? "ChatGPT" : provider === "claude" ? "Claude" : "Cursor"} account ${Math.max(store.accounts.filter((a) => a.provider === provider).length, ...store.accounts.filter((a) => a.provider === provider).map((a) => Number(a.defaultName.match(/account (\d+)$/)?.[1] ?? 0))) + 1}`
        : snapshot.displayName),
    plan: snapshot.plan,
    connection: "active",
    meters: [
      ...snapshot.meters,
      ...localMeters.filter((meter) => !incomingIds.has(meter.id)),
    ],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    alertRemaining: previous?.alertRemaining ?? null,
    alertsMuted: previous?.alertsMuted ?? false,
  };
  const connectionId = options.connectionId ?? `website:${provider}`;
  const connection = store.connections.find((c) => c.id === connectionId);
  if (
    !connection ||
    (options.generation !== undefined &&
      (!connection.enabled || connection.generation !== options.generation))
  )
    return store;
  const base: Store = {
    ...store,
    accounts: [...store.accounts.filter((a) => a.id !== id), account],
    connections: store.connections.map((c) =>
      c.id === connectionId ? { ...c, enabled: true } : c,
    ),
    providers:
      connection.kind === "website"
        ? {
            ...store.providers,
            [provider]: {
              ...store.providers[provider],
              enabled: true,
              status: "active",
              activeAccountId: id,
              checkedAt: now,
              message: snapshot.meters.some((m) => m.evidence === "reported")
                ? null
                : snapshot.kind === "browser"
                  ? "Only activity observed in this browser is available."
                  : "This plan did not report a quota. Remaining allowance is unknown.",
              failures: 0,
              nextRetryAt: null,
            },
          }
        : store.providers,
  };
  const observedAt = options.observedAt ?? now;
  const result = acceptSnapshot(
    base,
    {
      schemaVersion: 2,
      snapshotId: `${connectionId}:${id}:${observedAt}`,
      providerId: provider,
      accountId: id,
      connectionId,
      workspaceId: options.workspaceId ?? null,
      observedAt,
      receivedAt: now,
      connectorVersion: "website-v2.1",
      meters: account.meters.map((m) => ({
        ...m,
        observedAt:
          m.evidence === "observed"
            ? (m.observedAt ?? previous?.updatedAt ?? observedAt)
            : observedAt,
        connectionId,
      })),
    },
    connection.generation,
    now,
  );
  return result.accepted ? result.store : store;
}

type FailureStatus = Exclude<
  Store["providers"][ProviderId]["status"],
  "checking" | "active"
>;
export function markConnection(
  store: Store,
  connectionId: string,
  status: FailureStatus,
  message: string,
  now: number,
): Store {
  const connection = store.connections.find((c) => c.id === connectionId);
  if (!connection) return store;
  const provider = connection.provider;
  const next: Store = {
    ...store,
    connections: store.connections.map((c) =>
      c.id === connectionId
        ? {
            ...c,
            status:
              status === "signed-out"
                ? "needs-auth"
                : status === "waiting-for-tab"
                  ? "needs-tab"
                  : status === "disabled"
                    ? "disabled"
                    : status === "inactive"
                      ? "disabled"
                      : status,
            enabled: status === "disabled" ? false : c.enabled,
            message,
            lastAttemptAt: now,
          }
        : c,
    ),
    // Legacy accounts without snapshots can only follow their explicitly bound source.
    accounts: store.accounts.map((account) =>
      account.id === connection.accountId &&
      !store.snapshots.some((s) => s.accountId === account.id) &&
      account.connection === "active"
        ? {
            ...account,
            connection: status === "disabled" ? ("inactive" as const) : status,
          }
        : account,
    ),
    providers:
      connection.kind === "website"
        ? {
            ...store.providers,
            [provider]: {
              ...store.providers[provider],
              status,
              activeAccountId: null,
              checkedAt: now,
              message,
            },
          }
        : store.providers,
  };
  return projectAccounts(next);
}
export function markProvider(
  store: Store,
  provider: ProviderId,
  status: FailureStatus,
  message: string,
  now: number,
): Store {
  return markConnection(store, websiteId(provider), status, message, now);
}

export interface LimitAlert {
  id: string;
  title: string;
  message: string;
  accountId: string;
  meterId: string;
  ledgerKey: string;
  kind: "low" | "reset";
}
export function collectAlerts(
  store: Store,
  now: number,
): { store: Store; alerts: LimitAlert[] } {
  if (!store.settings.desktopAlerts || isQuiet(store.settings, now))
    return { store, alerts: [] };
  const ledger = structuredClone(store.alertLedger);
  const alerts: LimitAlert[] = [];
  const resetLedger = structuredClone(store.resetLedger);
  for (const account of store.accounts) {
    if (account.alertsMuted || (account.snoozedUntil ?? 0) > now) continue;
    for (const meter of account.meters) {
      if (
        meter.evidence !== "reported" ||
        !isFresh(account, meter, now, store.settings.refreshMinutes)
      )
        continue;
      const remaining = remainingPercent(meter);
      if (remaining === null) continue;
      const key = alertKey(account, meter);
      const window =
        meter.resetsAt === null ? "unknown" : String(meter.resetsAt);
      const prior = ledger[key] ?? ledger[`${account.id}/${meter.id}`];
      const entry =
        prior?.window === window
          ? { window, sent: [...prior.sent] }
          : { window, sent: [] as number[] };
      const configured = alertThresholds(account, store.settings);
      const thresholds = [
        ...new Set([configured.warning, configured.critical]),
      ].sort((a, b) => a - b);
      // A quota with no published reset can rearm after a meaningful recovery.
      if (meter.resetsAt === null)
        entry.sent = entry.sent.filter(
          (threshold) => remaining < threshold + 5,
        );
      const crossed = thresholds.filter(
        (threshold) =>
          remaining <= threshold && !entry.sent.includes(threshold),
      );
      if (crossed.length) {
        const threshold = crossed[0]!;
        alerts.push({
          id: `limit:${key}:${window}:${threshold}`,
          accountId: account.id,
          meterId: meter.id,
          ledgerKey: key,
          kind: "low",
          title: `${store.settings.privacyMode ? privateAccountName(store.accounts, account.id) : accountName(account)} is running low`,
          message: `${store.settings.privacyMode ? "Limit" : meter.label}: ${Math.round(remaining)}% left${meter.resetsAt ? `. Resets ${new Date(meter.resetsAt).toLocaleString()}` : ""}.`,
        });
        // One alert at the most severe crossed level, rather than two at once.
        entry.sent = [
          ...new Set([
            ...entry.sent,
            ...thresholds.filter((value) => remaining <= value),
          ]),
        ];
      }
      ledger[key] = entry;
      const reset = {
        window:
          meter.windowId ??
          (meter.resetsAt === null ? null : String(meter.resetsAt)),
        resetsAt: meter.resetsAt,
        observedAt: meter.observedAt ?? account.updatedAt,
        usedPercent: meter.usedPercent,
      };
      if (
        store.settings.resetAlerts &&
        confirmedReset(resetLedger[key], reset) &&
        !crossed.length
      )
        alerts.push({
          id: `reset:${key}:${reset.window}`,
          accountId: account.id,
          meterId: meter.id,
          ledgerKey: key,
          kind: "reset",
          title: `${store.settings.privacyMode ? privateAccountName(store.accounts, account.id) : accountName(account)} reset confirmed`,
          message: `${store.settings.privacyMode ? "Limit" : meter.label}: a fresh provider reading reports a new allowance window.`,
        });
      resetLedger[key] = reset;
    }
  }
  return {
    store: {
      ...store,
      alertLedger: Object.fromEntries(Object.entries(ledger).slice(-6000)),
      resetLedger: Object.fromEntries(Object.entries(resetLedger).slice(-6000)),
    },
    alerts,
  };
}

/** Uses only stored readings; display-only reset projections never enter the badge. */
export function badge(
  store: Store,
  now: number,
): { text: string; color: string; title: string } {
  const empty = {
    text: "",
    color: "#64748b",
    title: "MyLimits · your usage, in one place",
  };
  const choice = store.settings.badge;
  if (choice?.mode === "off") return empty;
  const format = (
    account: Account,
    meter: Meter,
    remaining: number,
    fresh: boolean,
  ) => {
    const value = Math.round(
      store.settings.displayMode === "used" ? 100 - remaining : remaining,
    );
    const suffix = store.settings.displayMode === "used" ? "used" : "remaining";
    const threshold = alertThresholds(account, store.settings);
    const description = store.settings.privacyMode
      ? "Limit"
      : `${accountName(account)} · ${meter.label}`;
    return {
      text: `${value}%`,
      color: !fresh
        ? "#64748b"
        : remaining <= threshold.critical
          ? "#dc5a52"
          : remaining <= threshold.warning
            ? "#b97819"
            : "#237c64",
      title: `MyLimits · ${description}: ${value}% ${suffix}${fresh ? "" : " · Last reading"}`,
    };
  };
  if (choice?.mode === "meter") {
    const account = store.accounts.find((a) => a.id === choice.accountId);
    const meter = account?.meters.find((m) => m.id === choice.meterId);
    if (account && meter) {
      const fresh = isFresh(account, meter, now, store.settings.refreshMinutes);
      if (
        meter.evidence !== "reported" ||
        (!fresh && meter.resetsAt !== null && meter.resetsAt <= now)
      )
        return empty;
      const remaining = remainingPercent(meter);
      return remaining === null
        ? empty
        : format(account, meter, remaining, fresh);
    }
    // A deleted account or limit falls back to automatic selection.
  }
  const readings = store.accounts.flatMap((account) =>
    account.meters
      .filter(
        (meter) =>
          meter.evidence === "reported" &&
          isFresh(account, meter, now, store.settings.refreshMinutes),
      )
      .flatMap((meter) => {
        const remaining = remainingPercent(meter);
        return remaining === null ? [] : [{ account, meter, remaining }];
      }),
  );
  if (!readings.length) return empty;
  const lowest = readings.reduce((a, b) =>
    a.remaining <= b.remaining ? a : b,
  );
  return format(lowest.account, lowest.meter, lowest.remaining, true);
}
