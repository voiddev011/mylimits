import test from 'node:test';import assert from 'node:assert/strict';
import { guide,analyzePrompt,handoffPreview,templates } from './guide';
import { demoState } from '../ui/demo';
const now=1800000000000,state=demoState(now);
test('guide matches actual coding scope and excludes stale, unknown and user-excluded accounts',()=>{
 const coding=guide(state.accounts,state.settings,'coding','balanced',now);assert.deepEqual(coding.options.map(a=>a.name),['Claude Work','GPT Work']);
 const writing=guide(state.accounts,state.settings,'writing','quality',now);assert.ok(!writing.options.some(a=>a.name==='GPT Work'));assert.ok(writing.excluded.some(a=>a.reason.includes('does not match')));
 const excluded=guide(state.accounts,state.settings,'coding','usage',now,[state.accounts[0]!.id]);assert.ok(!excluded.options.some(a=>a.id===state.accounts[0]!.id));assert.ok(excluded.excluded.some(a=>a.reason==='Excluded by you for this task.'));
 assert.equal(guide(state.accounts,state.settings,'coding','speed',now+3600000).options.length,0);
});
test('guide suppresses exhausted weekly limits and unrelated spend; explains near resets',()=>{
 const a=structuredClone(state.accounts[0]!);a.meters[1]!.usedPercent=100;assert.equal(guide([a],state.settings,'coding','balanced',now).options.length,0);
 a.meters=a.meters.slice(0,1);a.meters[0]!.resetsAt=now+60000;assert.ok(guide([a],state.settings,'reasoning','quality',now).options[0]!.notes.some(n=>n.includes('confirm')));
 a.meters[0]!.scope='api';assert.equal(guide([a],state.settings,'coding','balanced',now).options.length,0);
 a.provider='grok';assert.ok(guide([a],state.settings,'coding','balanced',now).excluded[0]!.reason.includes('metadata'));
});
test('prompt analysis and handoff are deterministic pure functions without token-saving claims',()=>{
 const text='Private text only';const stats=analyzePrompt(text);assert.equal(stats.words,3);assert.equal(stats.characters,text.length);assert.ok(stats.tips.length>0);
 assert.deepEqual(analyzePrompt(text),stats);const preview=handoffPreview('Goal','Facts','Next',text);assert.ok(preview.includes(text));assert.ok(preview.includes('user supplied'));assert.ok(templates.extraction.includes('do not guess'));
});
test('guide uses only fresh pacing from the same source and reset window',()=>{
 const a=structuredClone(state.accounts[0]!);a.meters=a.meters.slice(0,1);a.meters[0]!.connectionId='website:claude';
 const m=a.meters[0]!,series={key:'x',accountId:a.id,meterId:m.id,label:m.label,scope:m.scope,evidence:'reported',connectionId:'website:claude',workspaceId:null,window:String(m.resetsAt),resetsAt:m.resetsAt,unit:m.unit,currency:null,segments:[],samples:4,displayedSamples:4,pacing:{kind:'range' as const,lowHours:1,highHours:2,samples:4,spanMinutes:40,ratePerHour:10},latest:{time:now,used:null,total:null,remaining:null,percent:32}};
 const history={series:[series],timeline:[],truncated:false,gaps:0};
 assert.ok(guide([a],state.settings,'coding','balanced',now,[],history).options[0]!.notes.some(n=>n.startsWith('History estimate')));
 series.connectionId='companion:other';assert.ok(!guide([a],state.settings,'coding','balanced',now,[],history).options[0]!.notes.some(n=>n.startsWith('History estimate')));
});
