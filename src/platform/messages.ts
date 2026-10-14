import { z } from 'zod';
import { browser } from 'wxt/browser';
import type { Store } from '../core/model';
import { ProviderSchema, SettingsSchema } from '../core/schema';
import type { HistoryPoint } from './history';

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state') }),
  z.object({ type: z.literal('refresh'), provider: ProviderSchema.optional() }),
  z.object({ type: z.literal('enable'), provider: ProviderSchema, enabled: z.boolean() }),
  z.object({ type: z.literal('rename'), accountId: z.string().max(180), alias: z.string().trim().max(60) }),
  z.object({ type: z.literal('account-settings'), accountId: z.string().max(180), alertRemaining: z.number().int().min(1).max(95).nullable(), alertsMuted: z.boolean() }),
  z.object({ type: z.literal('forget'), accountId: z.string().max(180) }),
  z.object({ type: z.literal('settings'), settings: SettingsSchema }),
  z.object({ type: z.literal('history'), accountId: z.string().max(180) }),
  z.object({ type: z.literal('observer-ready'), provider: ProviderSchema, channel: z.string().uuid() }),
  z.object({ type: z.literal('observation'), provider: ProviderSchema, eventId: z.string().uuid() }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type PublicStore = Omit<Store, 'installSalt' | 'alertLedger' | 'observationLedger'>;
export interface Response<T = unknown> { ok: boolean; data?: T; error?: string; }

export async function command<T = PublicStore>(message: Command): Promise<T> {
  const response = await browser.runtime.sendMessage(message) as Response<T>;
  if (!response?.ok) throw new Error(response?.error ?? 'MyLimits could not complete that action.');
  return response.data as T;
}
export async function history(accountId: string): Promise<HistoryPoint[]> {
  return command<HistoryPoint[]>({ type: 'history', accountId });
}
