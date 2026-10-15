// Pure domain types and calculations. No browser APIs or package dependencies.
export const PROVIDER_IDS = ['claude', 'chatgpt', 'gemini', 'grok', 'perplexity'] as const;
export type ProviderId = typeof PROVIDER_IDS[number];
export interface Meter {
  id: string;
  label: string;
  scope: 'subscription' | 'work-codex' | 'chat' | 'local';
  evidence: 'reported' | 'observed';
  usedPercent: number | null;
  used: number | null;
  total: number | null;
  unit: 'percent' | 'messages' | 'requests' | 'searches' | 'credits';
  resetsAt: number | null;
  source: string;
}
export type Connection = 'active' | 'inactive' | 'signed-out' | 'waiting-for-tab' | 'unavailable' | 'error';
export interface Account {
  id: string;
  provider: ProviderId;
  kind: 'account' | 'browser';
  companionProfile?: string;
  alias: string;
  defaultName: string;
  plan: string | null;
  connection: Connection;
  meters: Meter[];
  createdAt: number;
  updatedAt: number;
  alertRemaining: number | null;
  alertsMuted: boolean;
}
export interface Settings {
  warningRemaining: number;
  criticalRemaining: number;
  desktopAlerts: boolean;
  refreshMinutes: number;
  theme: 'system' | 'dark' | 'light';
}
export interface ProviderState {
  enabled: boolean;
  status: 'disabled' | 'checking' | Connection;
  activeAccountId: string | null;
  checkedAt: number | null;
  message: string | null;
  failures: number;
  nextRetryAt: number | null;
}
export interface Store {
  version: 1;
  installSalt: string;
  accounts: Account[];
  providers: Record<ProviderId, ProviderState>;
  settings: Settings;
  alertLedger: Record<string, { window: string; sent: number[] }>;
  observationLedger: string[];
}
export function emptyStore(salt: string): Store {
  return {
    version: 1, installSalt: salt, accounts: [],
    providers: Object.fromEntries(PROVIDER_IDS.map(id => [id, {
      enabled: false, status: 'disabled', activeAccountId: null, checkedAt: null, message: null, failures: 0, nextRetryAt: null,
    }])) as Store['providers'],
    settings: { warningRemaining: 20, criticalRemaining: 5, desktopAlerts: false, refreshMinutes: 5, theme: 'system' },
    alertLedger: {}, observationLedger: [],
  };
}
export function accountName(account: Pick<Account, 'alias' | 'defaultName'>): string {
  return account.alias || account.defaultName;
}
export function remainingPercent(meter: Meter): number | null {
  const used = meter.usedPercent ?? (meter.total !== null && meter.used !== null ? meter.used / meter.total * 100 : null);
  return used === null ? null : Math.max(0, Math.min(100, 100 - used));
}
export function isFresh(account: Account, meter: Meter, now: number, refreshMinutes: number): boolean {
  return account.connection === 'active'
    && now - account.updatedAt <= Math.max(refreshMinutes * 3, 15) * 60_000
    && (meter.resetsAt === null || meter.resetsAt > now);
}
export function alertThresholds(account: Account, settings: Settings): { warning: number; critical: number } {
  const warning = account.alertRemaining ?? settings.warningRemaining;
  return { warning, critical: Math.min(warning, settings.criticalRemaining) };
}
