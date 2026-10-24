import { z } from 'zod';
import { browser } from 'wxt/browser';
import type { PublicState } from '../core/public';
import { ProviderSchema, SettingsSchema } from '../core/schema';
import type { HistoryPoint } from './history';
import { PrivateStartSchema,PrivateSaveSchema,PrivateCancelSchema,PrivateCheckSchema } from '../core/private-signin';

const ms = z.number().finite().min(0).max(8.64e15);
export const CommandSchema = z.discriminatedUnion('type', [
  PrivateStartSchema,PrivateSaveSchema,PrivateCancelSchema,PrivateCheckSchema,
  z.object({ type: z.literal('state') }),
  z.object({ type: z.literal('request-diagnostics') }).strict(),
  z.object({ type: z.literal('account-setup-cancel'), setupId: z.string().uuid() }),
  z.object({ type: z.literal('opened') }),
  z.object({type:z.literal('history-insights'),accountIds:z.array(z.string().min(1).max(240)).min(1).max(2),from:ms.optional(),to:ms.optional()}),
  z.object({ type: z.literal('history-page'), accountId: z.string().min(1).max(240), from: ms.optional(), to: ms.optional(), limit: z.number().int().min(1).max(200).optional(), before: z.object({ time: ms, id: z.number().int().min(1) }).optional() }),
  z.object({ type: z.literal('export-history'), accountId: z.string().min(1).max(240).optional(), from: ms.optional(), to: ms.optional(), format: z.enum(['json','csv']) }),
  z.object({ type: z.literal('clear-history'), accountId: z.string().min(1).max(240).optional() }),

  z.object({ type: z.literal('account-preferences'), accountId: z.string().min(1).max(240), pinned: z.boolean().optional(), pinnedMeterIds: z.array(z.string().max(120)).max(10).optional(), snoozedUntil: z.number().finite().min(0).nullable().optional() }),
  z.object({ type: z.literal('order'), ids: z.array(z.string().min(1).max(240)).max(100) }),
  z.object({ type: z.literal('disconnect'), connectionId: z.string().min(1).max(240) }),
  z.object({ type: z.literal('workspace'), connectionId: z.string().min(1).max(240), workspaceId: z.string().min(1).max(240).nullable() }),

  z.object({ type: z.literal('refresh'), provider: ProviderSchema.optional(), connectionId: z.string().min(1).max(240).optional() }),
  z.object({ type: z.literal('enable'), provider: ProviderSchema, enabled: z.boolean() }),
  z.object({ type: z.literal('rename'), accountId: z.string().max(180), alias: z.string().trim().max(60) }),
  z.object({ type: z.literal('account-settings'), accountId: z.string().max(180), alertRemaining: z.number().int().min(1).max(95).nullable(), alertsMuted: z.boolean() }),
  z.object({ type: z.literal('forget'), accountId: z.string().max(180) }),
  z.object({ type: z.literal('settings'), settings: SettingsSchema }),
  z.object({ type: z.literal('history'), accountId: z.string().max(180) }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type ActionRunner=(action:Command,onError?:(error:unknown)=>void)=>Promise<boolean>;
export type PublicStore = PublicState;
export interface Response<T = unknown> { ok: boolean; data?: T; error?: string; code?:string; }
export class CommandError extends Error {constructor(message:string,readonly code?:string){super(message);}}

export async function command<T = PublicStore>(message: Command): Promise<T> {
  const response = await browser.runtime.sendMessage(message) as Response<T>;
  if (!response?.ok) throw new CommandError(response?.error ?? 'MyLimits could not complete that action.',response?.code);
  return response.data as T;
}
export async function history(accountId: string): Promise<HistoryPoint[]> {
  return command<HistoryPoint[]>({ type: 'history', accountId });
}
