import { z } from 'zod';
import { MeterSchema } from './schema';
export const HostedProviderSchema = z.enum(['openai', 'claude']);
export type HostedProvider = z.infer<typeof HostedProviderSchema>;
const time = z.number().finite().nonnegative();
export const HostedCapabilitySchema = z.object({
  provider: HostedProviderSchema, available: z.boolean(),
  method: z.enum(['official-popup','official-device-code']).nullable(),
  scopes: z.array(z.string().min(1).max(120)).max(20),
  reason: z.enum(['hosted-authorization-unverified','remote-login-unverified','available']),
}).strict();
export const HostedCapabilitiesSchema = z.object({version:z.literal(1), providers:z.array(HostedCapabilitySchema).max(2)}).strict();
export const unavailableCapabilities = (): z.infer<typeof HostedCapabilitiesSchema> => ({version:1,providers:[
  {provider:'openai',available:false,method:null,scopes:[],reason:'hosted-authorization-unverified'},
  {provider:'claude',available:false,method:null,scopes:[],reason:'remote-login-unverified'},
]});
export const HostedConnectionSchema = z.object({
  id:z.string().uuid(), provider:HostedProviderSchema, alias:z.string().max(60),
  identity:z.object({subject:z.string().min(1).max(240),workspace:z.string().max(240).nullable()}).strict(),
  method:z.enum(['official-popup','official-device-code']), capabilities:z.array(z.string().max(120)).max(20),
  state:z.enum(['active','needs-auth','error','disconnected']), generation:z.number().int().nonnegative(),
  meters:z.array(MeterSchema).max(20), fetchedAt:time.nullable(), providerObservedAt:time.nullable(),
  nextEligibleAt:time.nullable(), staleReason:z.enum(['never-fetched','fetch-failed','reconnect-required','disconnected']).nullable(),
  error:z.enum(['auth','rate-limit','network','invalid-response']).nullable(),
}).strict();
export type HostedConnection = z.infer<typeof HostedConnectionSchema>;
export const HostedListSchema=z.object({version:z.literal(1),connections:z.array(HostedConnectionSchema).max(200)}).strict();
export const HostedStartSchema=z.object({provider:HostedProviderSchema,requestId:z.string().uuid(),reconnectId:z.string().uuid().optional()}).strict();
export const HostedAttemptSchema=z.object({
  id:z.string().uuid(),provider:HostedProviderSchema,
  state:z.enum(['pending','connected','duplicate','cancelled','expired','failed']),
  expiresAt:time, connectionId:z.string().uuid().nullable(),
  // Provider credentials and codes are never part of this public contract.
  authorizationUrl:z.string().url().nullable(),
}).strict();
export const HostedRenameSchema=z.object({alias:z.string().trim().max(60)}).strict();
