import test from 'node:test';import assert from 'node:assert/strict';
import { widgetDefaults,widgetView,WidgetViewSchema } from './widget';import { demoState } from '../ui/demo';
test('widget is off by default and public projection contains no private store fields',()=>{
 const now=1800000000000,state=demoState(now);Object.assign(state,{token:'SECRET',installSalt:'PRIVATE'});assert.deepEqual(widgetView(state,'claude',widgetDefaults(),now),{enabled:false});
 const view=widgetView(state,'claude',{...widgetDefaults(),providers:['claude']},now);assert.equal(view.enabled,true);assert.ok(WidgetViewSchema.safeParse(view).success);assert.ok(!JSON.stringify(view).includes('SECRET'));assert.ok(!JSON.stringify(view).includes('PRIVATE'));assert.ok(!JSON.stringify(view).includes('connectionId'));
 const stale=widgetView(state,'claude',{...widgetDefaults(),providers:['claude']},now+3600000);if(stale.enabled)assert.ok(stale.meters.every(m=>!m.fresh));
 state.providers.claude.enabled=false;assert.deepEqual(widgetView(state,'claude',{...widgetDefaults(),providers:['claude']},now),{enabled:false});
});
