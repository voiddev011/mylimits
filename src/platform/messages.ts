import { z } from 'zod';
import { browser } from 'wxt/browser';
import type { PublicState } from '../core/public';
import { WidgetSettingsSchema } from '../core/widget';
import { ProviderSchema, SettingsSchema } from '../core/schema';
import type { HistoryPoint } from './history';
import { PrivateStartSchema,PrivateSaveSchema,PrivateCancelSchema,PrivateCheckSchema } from '../core/private-signin';

const ms = z.number().finite().min(0).max(8.64e15);
export const CommandSchema = z.discriminatedUnion('type', [
  PrivateStartSchema,PrivateSaveSchema,PrivateCancelSchema,PrivateCheckSchema,
  z.object({ type: z.literal('state') }),
  z.object({ type: z.literal('request-diagnostics') }).strict(),
  z.object({type:z.literal('hosted-status')}),
  z.object({type:z.literal('hosted-link'),action:z.enum(['start','poll'])}),
  z.object({type:z.literal('hosted-start'),provider:z.enum(['openai','claude']),reconnectId:z.string().uuid().optional()}),
  z.object({type:z.literal('hosted-attempt'),id:z.string().uuid(),cancel:z.boolean().optional()}),
  z.object({type:z.literal('hosted-list')}),
  z.object({type:z.literal('hosted-action'),id:z.string().uuid(),action:z.enum(['rename','refresh','disconnect','forget']),alias:z.string().trim().max(60).optional()}),
  z.object({ type: z.literal('account-setup-start'), provider: ProviderSchema, mode: z.enum(['detect','another']), nickname: z.string().trim().max(60) }),
  z.object({ type: z.literal('account-setup-save'), setupId: z.string().uuid(), accountId: z.string().min(1).max(240) }),
  z.object({ type: z.literal('account-setup-cancel'), setupId: z.string().uuid() }),
  z.object({type:z.literal('widget-settings'),settings:WidgetSettingsSchema.optional()}),
  z.object({type:z.literal('widget-state'),provider:ProviderSchema}),
  z.object({type:z.literal('widget-action'),provider:ProviderSchema,action:z.enum(['hide','position']),position:WidgetSettingsSchema.shape.position.optional()}),
  z.object({ type: z.literal('opened') }),
  z.object({type:z.literal('reader-mode'),provider:z.enum(['grok','perplexity']),mode:z.enum(['quota','activity'])}),
  z.object({ type:z.literal('sync'),action:z.enum(['status','start','poll','pause','resume','run','push-preferences','pull-preferences','disconnect','reset']),name:z.string().trim().min(1).max(60).optional() }),
  z.object({type:z.literal('history-insights'),accountIds:z.array(z.string().min(1).max(240)).min(1).max(2),from:ms.optional(),to:ms.optional()}),
  z.object({ type: z.literal('history-page'), accountId: z.string().min(1).max(240), from: ms.optional(), to: ms.optional(), limit: z.number().int().min(1).max(200).optional(), before: z.object({ time: ms, id: z.number().int().min(1) }).optional() }),
  z.object({ type: z.literal('export-history'), accountId: z.string().min(1).max(240).optional(), from: ms.optional(), to: ms.optional(), format: z.enum(['json','csv']) }),
  z.object({ type: z.literal('clear-history'), accountId: z.string().min(1).max(240).optional() }),

  z.object({ type: z.literal('account-preferences'), accountId: z.string().min(1).max(240), pinned: z.boolean().optional(), pinnedMeterIds: z.array(z.string().max(120)).max(10).optional(), snoozedUntil: z.number().finite().min(0).nullable().optional() }),
  z.object({ type: z.literal('order'), ids: z.array(z.string().min(1).max(240)).max(100) }),
  z.object({ type: z.literal('disconnect'), connectionId: z.string().min(1).max(240) }),
  z.object({ type: z.literal('workspace'), connectionId: z.string().min(1).max(240), workspaceId: z.string().min(1).max(240).nullable() }),

  z.object({ type: z.literal('companion-status') }),
  z.object({ type: z.literal('companion-enable'), enabled: z.boolean() }),
  z.object({ type: z.literal('companion-action'), action: z.enum(['setup','cancel','reconnect','disconnect']), profile: z.string().uuid() }),
  z.object({ type: z.literal('companion-add'), provider: z.enum(['openai','claude']).optional(), nickname: z.string().trim().max(60).optional() }),
  z.object({type:z.literal('companion-confirm'),profile:z.string().uuid(),generation:z.number().int().min(0),alias:z.string().trim().max(60)}),
  z.object({ type: z.literal('companion-remove'), profile: z.string().uuid() }),
  z.object({ type: z.literal('refresh'), provider: ProviderSchema.optional(), connectionId: z.string().min(1).max(240).optional() }),
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
