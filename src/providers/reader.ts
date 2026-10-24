import type { ProviderId } from "../core/model";
import type { Snapshot } from "../core/engine";
import { providers } from "./catalog";
import { object, parseClaude, parseChatGPT } from "./parsers";
import { AdapterError } from "./errors";
import { parseCursor, cursorIdentity } from "./additional";
export interface ReaderOptions {
  workspaceRemoteId?: string | null;
  allowWorkspaceSwitch?: boolean;
}
export interface QuotaRequest {
  method: "POST";
  body: Record<string, unknown>;
}
export type ReadJSON = (
  path: string,
  headers?: Record<string, string>,
  request?: QuotaRequest,
) => Promise<unknown>;
export async function readAccountProvider(
  provider: ProviderId,
  options: ReaderOptions,
  read: ReadJSON,
): Promise<Snapshot> {
  if (provider === "cursor") {
    const path = "/api/auth/me";
    const verify = cursorIdentity;
    const account = await read(path);
    let id: string;
    try {
      id = verify(account);
    } catch {
      throw new AdapterError(
        "unavailable",
        `${providers[provider].name} account identity could not be verified.`,
        null,
        "identity",
      );
    }
    const usage = await read("/api/usage-summary");
    const checked = await read(path);
    try {
      if (verify(checked) !== id) throw new Error("Account changed.");
      return parseCursor(account, usage);
    } catch {
      throw new AdapterError(
        "unavailable",
        `${providers[provider].name} identity or quota response could not be verified. No allowance was inferred.`,
        null,
        "shape",
      );
    }
  }
  if (provider === "claude") {
    const account = await read("/api/account");
    const organizations = await read("/api/organizations");
    const list = (
      Array.isArray(organizations) ? organizations.map(object) : []
    ).filter(
      (o) =>
        typeof o.uuid === "string" &&
        o.uuid.length > 0 &&
        o.uuid.length <= 180 &&
        (!Array.isArray(o.capabilities) || o.capabilities.includes("chat")),
    );
    const organization = options.workspaceRemoteId
      ? (list.find((o) => o.uuid === options.workspaceRemoteId) ??
        (options.allowWorkspaceSwitch ? list[0] : undefined))
      : list[0];
    if (!organization)
      throw new AdapterError(
        "unavailable",
        options.workspaceRemoteId
          ? "The selected workspace is unavailable. Choose Default workspace and refresh."
          : "No eligible Claude workspace could be verified.",
        null,
        "scope",
      );
    try {
      parseClaude(account, organization, {});
    } catch {
      throw new AdapterError(
        "unavailable",
        "Claude account identity could not be verified.",
        null,
        "identity",
      );
    }
    const usage = await read(
      `/api/organizations/${encodeURIComponent(String(organization.uuid))}/usage`,
    );
    const verifiedAccount = await read("/api/account");
    try {
      if (
        parseClaude(verifiedAccount, organization, {}).identity !==
        parseClaude(account, organization, {}).identity
      )
        throw new Error("Changed");
    } catch {
      throw new AdapterError(
        "unavailable",
        "Claude account changed during the check. Refresh again.",
        null,
        "identity",
      );
    }
    try {
      return {
        ...parseClaude(account, organization, usage),
        workspace: {
          identity: String(organization.uuid),
          name: workspaceName(organization.name, 1),
        },
        workspaces: list.map((o, i) => ({
          identity: String(o.uuid),
          name: workspaceName(o.name, i + 1),
        })),
      };
    } catch {
      throw new AdapterError(
        "unavailable",
        "Claude usage format could not be verified.",
        null,
        "shape",
      );
    }
  }
  if (provider === "chatgpt") {
    const session = object(await read("/api/auth/session"));
    if (typeof session.accessToken !== "string" || !session.accessToken)
      throw new AdapterError(
        "signed-out",
        "Sign in on ChatGPT, then reconnect.",
      );
    const usage = await read("/backend-api/wham/usage", {
      Authorization: `Bearer ${session.accessToken}`,
    });
    const verifiedSession = object(await read("/api/auth/session"));
    try {
      if (
        !verifiedSession.accessToken ||
        parseChatGPT(verifiedSession, usage).identity !==
          parseChatGPT(session, usage).identity
      )
        throw new Error("Changed");
    } catch {
      throw new AdapterError(
        "unavailable",
        "ChatGPT account changed during the check. Refresh again.",
        null,
        "identity",
      );
    }
    try {
      return parseChatGPT(session, usage);
    } catch {
      throw new AdapterError(
        "unavailable",
        "ChatGPT account identity or usage format could not be verified.",
        null,
        "shape",
      );
    }
  }
  throw new AdapterError("unavailable", "Unsupported provider.");
}
function workspaceName(value: unknown, index: number) {
  return typeof value === "string" && value.trim() && !value.includes("@")
    ? value.trim().slice(0, 120)
    : `Workspace ${index}`;
}
