import { z } from 'zod';
export const IndependentProviderSchema = z.enum(['openai', 'claude']);
export const AuthStateSchema = z.enum(['signing-in', 'verifying', 'connected', 'needs-sign-in', 'duplicate', 'disconnected', 'unavailable']);
const time = z.number().finite().min(0).max(8.64e15);
export const CapabilitySchema = z.object({
  provider: IndependentProviderSchema, available: z.boolean(), scope: z.enum(['work-codex', 'subscription']),
  isolatedLogin: z.boolean(), activeRefresh: z.boolean(), liveVerified: z.literal(false), reason: z.string().max(300).nullable(),
}).strict();
export const CapabilitiesSchema = z.object({ protocol: z.literal(2), version: z.string().max(30), providers: z.array(CapabilitySchema).max(10) }).strict();
export const IndependentMetadataSchema = z.object({
  provider: IndependentProviderSchema, alias: z.string().max(60), authState: AuthStateSchema,
  identityConfidence: z.enum(['unverified', 'email-only']),
  providerSubject: z.string().max(240).nullable(), workspaceIdentity: z.string().max(240).nullable(),
  capability: z.enum(['work-codex', 'subscription']),
  lastAttemptAt: time.nullable(), providerObservedAt: time.nullable(), nextRetryAt: time.nullable(),
  failures: z.number().int().min(0), errorCode: z.string().max(60).nullable(),
  possibleDuplicate: z.boolean(),
}).strict();
export type IndependentMetadata = z.infer<typeof IndependentMetadataSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
