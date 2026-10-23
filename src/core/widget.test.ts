import test from 'node:test';import assert from 'node:assert/strict';
import {widgetDefaults,widgetView,WidgetSettingsSchema,WidgetViewSchema} from './widget';
test('floating preview is off by default and requires no account to opt in',()=>{
 assert.deepEqual(widgetView('claude',widgetDefaults()),{enabled:false});
 assert.deepEqual(widgetView('claude',{...widgetDefaults(),providers:['claude']}),{enabled:true,position:'bottom-right'});
 assert.deepEqual(widgetView('chatgpt',{...widgetDefaults(),providers:['claude']}),{enabled:false});
});
test('preview preserves legacy site/corner preferences and never accepts quota or identity payloads',()=>{
 const legacy={providers:['claude'],position:'top-left',collapsed:false};
 assert.deepEqual(widgetView('claude',WidgetSettingsSchema.parse(legacy)),{enabled:true,position:'top-left'});
 assert.ok(!WidgetViewSchema.safeParse({enabled:true,position:'top-left',name:'SECRET',meters:[]}).success);
});
