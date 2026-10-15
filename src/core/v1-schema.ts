import { z } from 'zod';
import { PROVIDER_IDS } from './model';

export const ProviderSchema = z.enum(PROVIDER_IDS);
export const MeterSchema = z.object({
  id: z.string().min(1).max(120), label: z.string().min(1).max(120),
  scope: z.enum(['subscription', 'work-codex', 'chat', 'local']), evidence: z.enum(['reported', 'observed']),
  usedPercent: z.number().finite().min(0).max(1000).nullable(), used: z.number().finite().min(0).nullable(),
  total: z.number().finite().positive().nullable(), unit: z.enum(['percent', 'messages', 'requests', 'searches', 'credits']),
  resetsAt: z.number().finite().positive().nullable(), source: z.string().max(160),
});
export const ConnectionSchema = z.enum(['active', 'inactive', 'signed-out', 'waiting-for-tab', 'unavailable', 'error']);
export const AccountSchema = z.object({
  id: z.string().min(1).max(180), provider: ProviderSchema, kind: z.enum(['account', 'browser']),
  alias: z.string().max(60), defaultName: z.string().max(120), plan: z.string().max(80).nullable(),
  companionProfile: z.string().uuid().optional(),
  connection: ConnectionSchema, meters: z.array(MeterSchema).max(30), createdAt: z.number(), updatedAt: z.number(),
  alertRemaining: z.number().int().min(1).max(95).nullable(), alertsMuted: z.boolean(),
});
export const SettingsSchema = z.object({
  warningRemaining: z.number().int().min(1).max(95), criticalRemaining: z.number().int().min(1).max(95),
  desktopAlerts: z.boolean(), refreshMinutes: z.number().int().min(2).max(60), theme: z.enum(['system', 'dark', 'light']),
});
export const ProviderStateSchema = z.object({
  enabled: z.boolean(), status: z.enum(['disabled', 'checking', ...ConnectionSchema.options]),
  activeAccountId: z.string().nullable(), checkedAt: z.number().nullable(), message: z.string().max(300).nullable(),
  failures: z.number().int().min(0), nextRetryAt: z.number().nullable(),
});
export const V1StoreSchema = z.object({
  version: z.literal(1), installSalt: z.string(), accounts: z.array(AccountSchema).max(100),
  providers: z.record(ProviderSchema, ProviderStateSchema), settings: SettingsSchema,
  alertLedger: z.record(z.string(), z.object({ window: z.string(), sent: z.array(z.number()) })),
  observationLedger: z.array(z.string()).max(300),
});

export type V1Store = z.infer<typeof V1StoreSchema>;
