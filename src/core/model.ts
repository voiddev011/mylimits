// Pure domain types and calculations. No browser APIs or package dependencies.
export const PROVIDER_IDS = ["claude", "chatgpt", "cursor", "copilot"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export interface Meter {
  id: string;
  label: string;
  scope: "subscription" | "work-codex" | "chat" | "api" | "local";
  evidence: "reported" | "observed" | "estimated";
  usedPercent: number | null;
  used: number | null;
  total: number | null;
  remaining?: number | null;
  unlimited?: boolean;
  unit:
    | "percent"
    | "messages"
    | "requests"
    | "searches"
    | "credits"
    | "currency";
  resetsAt: number | null;
  source: string;
  currency?: string | null;
  windowId?: string | null;
  observedAt?: number;
  connectionId?: string;
}
export type Connection =
  | "active"
  | "inactive"
  | "signed-out"
  | "waiting-for-tab"
  | "unavailable"
  | "offline"
  | "error";
export interface Account {
  id: string;
  provider: ProviderId;
  kind: "account" | "browser";
  alias: string;
  defaultName: string;
  plan: string | null;
  connection: Connection;
  meters: Meter[];
  createdAt: number;
  updatedAt: number;
  alertRemaining: number | null;
  alertsMuted: boolean;
  pinned?: boolean;
  order?: number;
  pinnedMeterIds?: string[];
  snoozedUntil?: number | null;
  workspaceId?: string | null;
}
export interface Settings {
  warningRemaining: number;
  criticalRemaining: number;
  /** Legacy storage key for browser notifications; not a native application. */
  desktopAlerts: boolean;
  refreshMinutes: number;
  theme: "system" | "dark" | "light";
  textSize?: "standard" | "large";
  privacyMode?: boolean;
  historyRetentionDays?: 30 | 90;
  displayMode?: "remaining" | "used";
  badge?: {
    mode: "auto" | "meter" | "off";
    accountId?: string;
    meterId?: string;
  };
  autoRecoverTab?: boolean;
  resetAlerts?: boolean;
  quietHours?: { enabled: boolean; start: string; end: string };
}
export interface ProviderState {
  enabled: boolean;
  status: "disabled" | "checking" | Connection;
  activeAccountId: string | null;
  checkedAt: number | null;
  message: string | null;
  failures: number;
  nextRetryAt: number | null;
}
export interface AccountSetup {
  id: string;
  provider: ProviderId;
  mode: "detect" | "another";
  nickname: string;
  previousAccountId: string | null;
  startedAt: number;
  method?: "ambient" | "private";
  slotId?: string;
  captureMethod?: "private" | "current";
  phase?: "signing-in" | "verifying" | "awaiting-confirmation" | "error";
  message?: string | null;
  candidate?: {
    accountId: string;
    name: string;
    plan: string | null;
    verifiedAt: number;
  };
}
export interface Store {
  accountSetup?: AccountSetup | null;
  version: 2;
  connections: ConnectionRecord[];
  workspaces: Workspace[];
  snapshots: UsageSnapshot[];
  historyIssue: string | null;
  resetLedger: Record<
    string,
    {
      window: string | null;
      resetsAt: number | null;
      observedAt: number;
      usedPercent: number | null;
    }
  >;
  installSalt: string;
  accounts: Account[];
  providers: Record<ProviderId, ProviderState>;
  settings: Settings;
  alertLedger: Record<string, { window: string; sent: number[] }>;
}
export function emptyStore(salt: string): Store {
  return {
    version: 2,
    installSalt: salt,
    accounts: [],
    connections: PROVIDER_IDS.filter((p) => p !== "copilot").map((provider) =>
      websiteConnection(provider),
    ),
    workspaces: [],
    snapshots: [],
    historyIssue: null,
    resetLedger: {},
    providers: Object.fromEntries(
      PROVIDER_IDS.map((id) => [
        id,
        {
          enabled: false,
          status: "disabled",
          activeAccountId: null,
          checkedAt: null,
          message: null,
          failures: 0,
          nextRetryAt: null,
        },
      ]),
    ) as Store["providers"],
    settings: {
      warningRemaining: 20,
      criticalRemaining: 5,
      desktopAlerts: false,
      refreshMinutes: 5,
      theme: "system",
      textSize: "standard",
      privacyMode: false,
      historyRetentionDays: 30,
      displayMode: "remaining",
      badge: { mode: "auto" },
      autoRecoverTab: true,
      resetAlerts: false,
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
    },
    alertLedger: {},
  };
}
export function accountName(
  account: Pick<Account, "alias" | "defaultName">,
): string {
  return account.alias || account.defaultName;
}
export function remainingPercent(meter: Meter): number | null {
  const used =
    meter.usedPercent ??
    (meter.total !== null && meter.used !== null
      ? (meter.used / meter.total) * 100
      : null);
  return used === null ? null : Math.max(0, Math.min(100, 100 - used));
}
export function isFresh(
  account: Account,
  meter: Meter,
  now: number,
  refreshMinutes: number,
): boolean {
  return (
    account.connection === "active" &&
    now >= (meter.observedAt ?? account.updatedAt) - 60_000 &&
    now - (meter.observedAt ?? account.updatedAt) <=
      Math.max(refreshMinutes * 3, 15) * 60_000 &&
    (meter.resetsAt === null || meter.resetsAt > now)
  );
}
export function alertThresholds(
  account: Account,
  settings: Settings,
): { warning: number; critical: number } {
  const warning = account.alertRemaining ?? settings.warningRemaining;
  return { warning, critical: Math.min(warning, settings.criticalRemaining) };
}

export type ConnectionKind = "copilot" | "website" | "vault";
export type ConnectionStatus =
  | "disabled"
  | "checking"
  | "active"
  | "needs-auth"
  | "needs-tab"
  | "unavailable"
  | "offline"
  | "error";
export interface ConnectionRecord {
  id: string;
  provider: ProviderId;
  kind: ConnectionKind;
  accountId: string | null;
  workspaceId: string | null;
  workspaceIds: string[];
  enabled: boolean;
  status: ConnectionStatus;
  generation: number;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  nextRetryAt: number | null;
  failures: number;
  message: string | null;
  profileId?: string;
  authFailures?: number;
  copilotAllowance?: number | null;
  copilotQuotaAccess?: boolean;
  savedSignIn?: { method: "private" | "current"; notAfter: number | null };
}
export interface Workspace {
  id: string;
  provider: ProviderId;
  remoteId: string;
  name: string;
}
export interface UsageSnapshot {
  schemaVersion: 2;
  snapshotId: string;
  providerId: ProviderId;
  accountId: string;
  connectionId: string;
  workspaceId: string | null;
  observedAt: number;
  receivedAt: number;
  connectorVersion: string;
  meters: Meter[];
}
export function websiteConnection(provider: ProviderId): ConnectionRecord {
  return {
    id: `website:${provider}`,
    provider,
    kind: "website",
    accountId: null,
    workspaceId: null,
    workspaceIds: [],
    enabled: false,
    status: "disabled",
    generation: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    nextRetryAt: null,
    failures: 0,
    message: null,
  };
}
export function accountStatus(
  account: Account,
  now: number,
  refreshMinutes: number,
): string {
  if (account.kind === "browser") return "Local activity only";
  if (account.connection === "signed-out") return "Needs sign-in";
  if (account.connection === "waiting-for-tab")
    return "Open website to refresh";
  if (account.connection === "inactive") return "Remembered";
  if (account.connection === "offline") return "Offline";
  if (account.connection !== "active") return "Temporarily unavailable";
  if (!account.meters.some((m) => m.evidence === "reported"))
    return "Quota unavailable";
  return account.meters.some(
    (m) =>
      m.evidence === "reported" && isFresh(account, m, now, refreshMinutes),
  )
    ? "Current"
    : "Awaiting fresh reading";
}
