import { z } from 'zod';
import { MeterSchema, ProviderSchema, SettingsSchema, UsageSnapshotSchema } from './schema';
import type { Account, UsageSnapshot } from './model';
const id=z.string().min(1).max(240);
export const CloudAccountSchema=z.object({name:z.string().trim().min(1).max(120),plan:z.string().max(80).nullable()}).strict();
export const SyncItemSchema=z.object({account:CloudAccountSchema,snapshot:UsageSnapshotSchema}).strict();
export const SyncBatchSchema=z.object({deviceId:z.string().uuid(),items:z.array(SyncItemSchema).min(1).max(100)}).strict();
export const SyncPreferencesSchema=z.object({settings:SettingsSchema.optional(),names:z.record(z.string().uuid(),z.string().trim().max(60)).optional()}).strict();
export type SyncItem=z.infer<typeof SyncItemSchema>;
export function syncItem(account:Account,snapshot:UsageSnapshot):SyncItem {
 // Deliberately reconstruct; never upload the writable state or native auth.
 return SyncItemSchema.parse({account:{name:account.alias||account.defaultName,plan:account.plan},snapshot:{
  schemaVersion:2,snapshotId:snapshot.snapshotId,providerId:snapshot.providerId,accountId:snapshot.accountId,
  connectionId:snapshot.connectionId,workspaceId:snapshot.workspaceId,observedAt:snapshot.observedAt,receivedAt:snapshot.receivedAt,
  connectorVersion:snapshot.connectorVersion,meters:snapshot.meters.map(m=>MeterSchema.parse(m)),
 }});
}
export const RemoteAccountSchema=z.object({id:z.string().uuid(),provider:ProviderSchema,name:z.string().max(120),plan:z.string().nullable(),deviceName:z.string(),connectionId:z.string().uuid(),observedAt:z.number().nullable(),status:z.enum(['snapshot-only','disabled'])});
export const RemoteReadingSchema=z.object({id:z.string().uuid(),accountId:z.string().uuid(),connectionId:z.string().uuid(),observedAt:z.number(),serverReceivedAt:z.number(),snapshot:UsageSnapshotSchema});
export type RemoteAccount=z.infer<typeof RemoteAccountSchema>;
export type RemoteReading=z.infer<typeof RemoteReadingSchema>;
