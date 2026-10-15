import { z } from 'zod';
import { PROVIDER_IDS, type Account, type Meter, type ProviderState, type Settings, type Store, type ConnectionRecord, type UsageSnapshot, type Workspace } from './model';
const id = z.string().min(1).max(240);
const time = z.number().finite().min(0).max(8.64e15);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const ProviderSchema = z.enum(PROVIDER_IDS);
export const MeterSchema: z.ZodType<Meter> = z.object({
  id: z.string().min(1).max(120), label: z.string().min(1).max(120),
  scope: z.enum(['subscription', 'work-codex', 'chat', 'api', 'local']), evidence: z.enum(['reported', 'observed', 'estimated']),
  usedPercent: z.number().finite().min(0).max(1000).nullable(), used: z.number().finite().min(0).nullable(),
  total: z.number().finite().positive().nullable(), unit: z.enum(['percent', 'messages', 'requests', 'searches', 'credits', 'currency']),
  resetsAt: time.positive().nullable(), source: z.string().max(160),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(), windowId: z.string().max(240).nullable().optional(),
  observedAt: time.optional(), connectionId: id.optional(),
}).refine(m => m.unit !== 'currency' || !!m.currency, { message: 'Currency is required for monetary readings.' });
export const ConnectionSchema = z.enum(['active', 'inactive', 'signed-out', 'waiting-for-tab', 'unavailable', 'offline', 'error']);
export const AccountSchema: z.ZodType<Account> = z.object({
  id, provider: ProviderSchema, kind: z.enum(['account', 'browser']),
  alias: z.string().max(60), defaultName: z.string().max(120), plan: z.string().max(80).nullable(),
  companionProfile: z.string().uuid().optional(), connection: ConnectionSchema, meters: z.array(MeterSchema).max(60),
  createdAt: time, updatedAt: time, alertRemaining: z.number().int().min(1).max(95).nullable(), alertsMuted: z.boolean(),
  pinned: z.boolean().optional(), order: z.number().int().min(0).optional(), pinnedMeterIds: z.array(id).max(10).optional(),
  snoozedUntil: time.nullable().optional(), workspaceId: id.nullable().optional(),
});
export const SettingsSchema: z.ZodType<Settings> = z.object({
  warningRemaining: z.number().int().min(1).max(95), criticalRemaining: z.number().int().min(1).max(95),
  desktopAlerts: z.boolean(), refreshMinutes: z.number().int().min(2).max(60), theme: z.enum(['system', 'dark', 'light']),
  displayMode: z.enum(['remaining', 'used']).optional(), resetAlerts: z.boolean().optional(),
  quietHours: z.object({ enabled: z.boolean(), start: clock, end: clock }).optional(),
}).refine(s => s.criticalRemaining <= s.warningRemaining, { message: 'Critical alert must be at or below warning.' });
export const ProviderStateSchema: z.ZodType<ProviderState> = z.object({
  enabled: z.boolean(), status: z.enum(['disabled', 'checking', ...ConnectionSchema.options]),
  activeAccountId: id.nullable(), checkedAt: time.nullable(), message: z.string().max(300).nullable(),
  failures: z.number().int().min(0), nextRetryAt: time.nullable(),
});
export const ConnectionRecordSchema: z.ZodType<ConnectionRecord> = z.object({
  id, provider: ProviderSchema, kind: z.enum(['website','companion','independent-local','cloud','snapshot-import']),
  accountId: id.nullable(), workspaceId: id.nullable(), workspaceIds: z.array(id).max(100), enabled: z.boolean(),
  status: z.enum(['disabled','checking','active','needs-auth','needs-tab','unavailable','offline','error']),
  generation: z.number().int().min(0), lastAttemptAt: time.nullable(), lastSuccessAt: time.nullable(),
  nextRetryAt: time.nullable(), failures: z.number().int().min(0), message: z.string().max(300).nullable(), profileId: z.string().uuid().optional(),
});
export const WorkspaceSchema: z.ZodType<Workspace> = z.object({ id, provider: ProviderSchema, remoteId: id, name: z.string().max(120) });
export const UsageSnapshotSchema: z.ZodType<UsageSnapshot> = z.object({
  schemaVersion: z.literal(2), snapshotId: id, providerId: ProviderSchema, accountId: id, connectionId: id,
  workspaceId: id.nullable(), observedAt: time, receivedAt: time, connectorVersion: z.string().min(1).max(60), meters: z.array(MeterSchema).max(60),
});
export const StoreSchema: z.ZodType<Store> = z.object({
  version: z.literal(2), installSalt: z.string().min(1), accounts: z.array(AccountSchema).max(100),
  connections: z.array(ConnectionRecordSchema).max(200), workspaces: z.array(WorkspaceSchema).max(200), snapshots: z.array(UsageSnapshotSchema).max(400),
  providers: z.record(ProviderSchema, ProviderStateSchema), settings: SettingsSchema, historyIssue: z.string().max(300).nullable(),
  alertLedger: z.record(z.string(), z.object({ window: z.string(), sent: z.array(z.number()) })),
  observationLedger: z.array(z.string()).max(300),
});
