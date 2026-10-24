import {
  accountId,
  applySnapshot,
  markConnection,
  type Snapshot,
} from "../core/engine";
import { setupConnectionId } from "../core/account-setup";
import type { ConnectionRecord, Store } from "../core/model";
import { AccountSchema, MeterSchema } from "../core/schema";
import {
  RefreshCoordinator,
  shouldRefresh,
  type RefreshReason,
} from "../core/scheduler";
import type { ReaderOptions } from "../providers/reader";
import { AdapterError } from "../providers/errors";
import { authRetryDeadline, type SessionCookieState } from "./session-cookies";

export interface ConnectionRefreshPort {
  readStore(): Promise<Store>;
  updateStore<T>(
    mutate: (store: Store) => { store: Store; value: T },
  ): Promise<T>;
  permitted(connection: ConnectionRecord): Promise<boolean>;
  permissionMissing(connection: ConnectionRecord): Promise<void>;
  read(
    connection: ConnectionRecord,
    options: ReaderOptions,
    signal: AbortSignal,
    onRecoveryStart: () => Promise<void>,
  ): Promise<Snapshot>;
  cookieState(connection: ConnectionRecord): Promise<SessionCookieState>;
  saveHistory(accountId: string, connectionId: string): Promise<void>;
  updated(): Promise<void>;
  coordinator?: RefreshCoordinator;
  now?: () => number;
}
/** Same source-bound collection path for ambient and future saved transports. No browser globals. */
export function createConnectionRefresh(port: ConnectionRefreshPort) {
  const coordinator = port.coordinator ?? new RefreshCoordinator(2),
    now = port.now ?? Date.now;
  return async function refreshConnection(
    connectionId: string,
    reason: RefreshReason = "scheduled",
  ): Promise<void> {
    return coordinator.run(connectionId, async (signal) => {
      const before = await port.readStore(),
        connection = before.connections.find((c) => c.id === connectionId);
      if (
        !connection ||
        !["website", "vault", "copilot"].includes(connection.kind) ||
        !shouldRefresh(
          connection,
          reason,
          now(),
          before.settings.refreshMinutes,
        )
      )
        return;
      if (!(await port.permitted(connection))) {
        await port.permissionMissing(connection);
        return;
      }
      const provider = connection.provider,
        stamp = connection.generation;
      const valid = (s: Store) =>
        s.connections.find(
          (c) => c.id === connectionId && c.enabled && c.generation === stamp,
        );
      const started = await port.updateStore((store) => {
        if (!valid(store) || signal.aborted) return { store, value: false };
        return {
          store: {
            ...store,
            connections: store.connections.map((c) =>
              c.id === connectionId
                ? { ...c, status: "checking", lastAttemptAt: now() }
                : c,
            ),
            providers:
              connection.kind === "website"
                ? {
                    ...store.providers,
                    [provider]: {
                      ...store.providers[provider],
                      status: "checking",
                      checkedAt: now(),
                    },
                  }
                : store.providers,
          },
          value: true,
        };
      });
      if (!started) return;
      try {
        const switching =
          before.accountSetup &&
          setupConnectionId(before.accountSetup) === connectionId;
        const selected = switching
          ? undefined
          : before.workspaces.find((w) => w.id === connection.workspaceId);
        const snapshot = await port.read(
          connection,
          {
            workspaceRemoteId: selected?.remoteId,
            allowWorkspaceSwitch: connection.kind === "website",
          },
          signal,
          async () => {
            await port.updateStore((store) => {
              if (
                !valid(store) ||
                signal.aborted ||
                store.settings.autoRecoverTab === false
              )
                throw new AdapterError(
                  "error",
                  "Refresh was cancelled.",
                  null,
                  "cancelled",
                );
              return {
                store: {
                  ...store,
                  connections: store.connections.map((c) =>
                    c.id === connectionId
                      ? { ...c, message: "Retrying in the background" }
                      : c,
                  ),
                },
                value: undefined,
              };
            });
          },
        );
        const meters = snapshot.meters.map((m) => MeterSchema.parse(m));
        const id = await accountId(
          provider,
          snapshot.identity,
          before.installSalt,
        );
        // A connected saved source may never silently rebind to another identity.
        if (
          ["vault", "copilot"].includes(connection.kind) &&
          connection.accountId &&
          connection.accountId !== id
        )
          throw new AdapterError(
            "signed-out",
            "This connection returned a different account. Reconnect this source.",
            null,
            "identity",
          );
        const choices = await Promise.all(
          (snapshot.workspaces ?? []).map(async (w) => ({
            id: await accountId(
              provider,
              `workspace:${w.identity}`,
              before.installSalt,
            ),
            provider,
            remoteId: w.identity,
            name: w.name,
          })),
        );
        const workspaceId =
          choices.find((w) => w.remoteId === snapshot.workspace?.identity)
            ?.id ?? null;
        const accepted = await port.updateStore((store) => {
          if (!valid(store) || signal.aborted) return { store, value: false };
          const enriched = {
            ...store,
            workspaces: [
              ...store.workspaces.filter(
                (w) => !choices.some((n) => n.id === w.id),
              ),
              ...choices,
            ],
            connections: store.connections.map((c) =>
              c.id === connectionId
                ? { ...c, workspaceIds: choices.map((w) => w.id) }
                : c,
            ),
          };
          const next = applySnapshot(
            enriched,
            provider,
            id,
            { ...snapshot, meters },
            now(),
            { connectionId, workspaceId, generation: stamp },
          );
          AccountSchema.parse(next.accounts.find((a) => a.id === id));
          return { store: next, value: true };
        });
        if (accepted && meters.length) await port.saveHistory(id, connectionId);
      } catch (error) {
        if (signal.aborted) return;
        const status = error instanceof AdapterError ? error.status : "error";
        const isVault = connection.kind === "vault";
        const rejected =
          isVault &&
          error instanceof AdapterError &&
          error.status === "signed-out" &&
          error.code === "saved-http-401";
        const message =
          isVault && status === "signed-out"
            ? "Saved sign-in was rejected. Re-sign in."
            : error instanceof AdapterError
              ? error.message
              : "The website returned information MyLimits could not verify.";
        const cookieState =
          connection.kind === "website" && status === "signed-out"
            ? await port.cookieState(connection)
            : "unknown";
        await port.updateStore((store) => {
          const current = valid(store);
          if (!current) return { store, value: undefined };
          const next = markConnection(
            store,
            connectionId,
            status,
            message,
            now(),
          );
          const authFailures = rejected ? (current.authFailures ?? 0) + 1 : 0;
          const retry =
            connection.kind === "copilot" && status === "signed-out"
              ? null
              : isVault &&
                  status === "signed-out" &&
                  (!rejected || authFailures >= 3)
                ? null
                : authRetryDeadline(
                    status,
                    cookieState,
                    now(),
                    current.failures + 1,
                    connection.kind === "copilot"
                      ? Math.max(15, store.settings.refreshMinutes)
                      : store.settings.refreshMinutes,
                    error instanceof AdapterError ? error.retryAt : null,
                  );
          next.connections = next.connections.map((c) =>
            c.id === connectionId
              ? {
                  ...c,
                  lastAttemptAt: now(),
                  failures: current.failures + 1,
                  authFailures,
                  nextRetryAt: retry,
                }
              : c,
          );
          if (connection.kind === "website") {
            next.providers[provider].failures = current.failures + 1;
            next.providers[provider].nextRetryAt = retry;
          }
          return { store: next, value: undefined };
        });
      }
      await port.updated();
    });
  };
}
