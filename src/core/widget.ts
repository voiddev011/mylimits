import { z } from 'zod';
import { ProviderSchema } from './schema';
import type { ProviderId } from './model';
// Keep v1 preferences readable: existing site opt-ins and corner choices survive.
export const WidgetSettingsSchema=z.object({providers:z.array(ProviderSchema).max(6),position:z.enum(['bottom-right','bottom-left','top-right','top-left']),collapsed:z.boolean()}).strict();
export type WidgetSettings=z.infer<typeof WidgetSettingsSchema>;
export const widgetDefaults=():WidgetSettings=>({providers:[],position:'bottom-right',collapsed:true});
export const WidgetViewSchema=z.discriminatedUnion('enabled',[
 z.object({enabled:z.literal(false)}).strict(),
 z.object({enabled:z.literal(true),position:WidgetSettingsSchema.shape.position}).strict(),
]);
export type WidgetView=z.infer<typeof WidgetViewSchema>;
/** Preview receives preferences only: no account or conversation access. */
export function widgetView(provider:ProviderId,settings:WidgetSettings):WidgetView{
 return settings.providers.includes(provider)?{enabled:true,position:settings.position}:{enabled:false};
}
