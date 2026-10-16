import { z } from 'zod';
import { ProviderSchema } from './schema';
import { accountName,accountStatus,isFresh,type ProviderId } from './model';
import type { PublicState } from './public';
import { meterValue } from './meter-display';
export const WidgetSettingsSchema=z.object({providers:z.array(ProviderSchema).max(6),position:z.enum(['bottom-right','bottom-left','top-right','top-left']),collapsed:z.boolean()}).strict();
export type WidgetSettings=z.infer<typeof WidgetSettingsSchema>;
export const widgetDefaults=():WidgetSettings=>({providers:[],position:'bottom-right',collapsed:false});
export const WidgetViewSchema=z.discriminatedUnion('enabled',[
 z.object({enabled:z.literal(false)}).strict(),
 z.object({enabled:z.literal(true),position:WidgetSettingsSchema.shape.position,collapsed:z.boolean(),name:z.string().max(120),status:z.string().max(100),meters:z.array(z.object({label:z.string().max(120),value:z.string().max(80),observedAt:z.number().nullable(),resetsAt:z.number().nullable(),fresh:z.boolean()}).strict()).max(2)}).strict(),
]);
export type WidgetView=z.infer<typeof WidgetViewSchema>;
export function widgetView(store:PublicState,provider:ProviderId,settings:WidgetSettings,now:number):WidgetView{
 if(!settings.providers.includes(provider)||!store.providers[provider].enabled)return {enabled:false};
 const a=store.accounts.find(a=>a.id===store.providers[provider].activeAccountId);
 return {enabled:true,position:settings.position,collapsed:settings.collapsed,name:a?accountName(a):'MyLimits',status:a?accountStatus(a,now,store.settings.refreshMinutes):'Waiting for an account reading',meters:(a?.meters??[]).slice(0,2).map(m=>({label:m.label,value:meterValue(m,store.settings.displayMode),observedAt:m.observedAt??a!.updatedAt??null,resetsAt:m.resetsAt,fresh:m.evidence==='reported'&&isFresh(a!,m,now,store.settings.refreshMinutes)}))};
}
