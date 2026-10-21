import { z } from 'zod';
import { MeterSchema } from './schema';
import { IndependentMetadataSchema } from './independent-contract';
export * from './independent-contract';
const time = z.number().finite().min(0).max(8.64e15);
export const NativeProfileSchema = z.object({
  id: z.string().uuid(), status: z.enum(['active', 'signed-out', 'unavailable']), plan: z.string().max(80).nullable(),
  updatedAt: time, meters: z.array(MeterSchema).max(30),
  ...IndependentMetadataSchema.shape,
  // Displayed locally in connection setup; never a routing key or credential.
  displayIdentity: z.string().max(254).nullable(),
}).strict();
export const NativeSnapshotSchema = z.object({ type: z.literal('snapshot'), protocol: z.literal(2), profiles: z.array(NativeProfileSchema).max(20) }).strict();
export type NativeProfile = z.infer<typeof NativeProfileSchema>;
