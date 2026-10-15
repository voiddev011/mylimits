import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGrok,parsePerplexity,parseCursor } from './additional';
import { readAccountProvider } from './reader';
import { MeterSchema,StoreSchema } from '../core/schema';
import { emptyStore } from '../core/model';
import { applySnapshot } from '../core/engine';
import { providers as catalog } from './catalog';
import { meterValue } from '../core/meter-display';
const subscriptions={subscriptions:[{xaiUserId:'fictional-grok-user',tier:'SUBSCRIPTION_TIER_GROK_PRO',status:'SUBSCRIPTION_STATUS_ACTIVE'}]};
test('Grok keeps zero remaining and actual counts without inventing a rolling reset time',()=>{
 const s=parseGrok(subscriptions,{remainingQueries:0,totalQueries:80,windowSizeSeconds:7200});assert.equal(s.meters[0]!.usedPercent,100);assert.equal(s.meters[0]!.remaining,0);assert.equal(s.meters[0]!.resetsAt,null);assert.equal(s.meters[0]!.scope,'chat');
 assert.equal(parseGrok(subscriptions,{}).meters.length,0);assert.throws(()=>parseGrok(subscriptions,{remainingQueries:90,totalQueries:80}));assert.throws(()=>parseGrok(subscriptions,{remainingQueries:-1,totalQueries:80}));
});
test('Grok requires one account identity and rejects ambiguous/missing subscriptions',()=>{
 assert.throws(()=>parseGrok({subscriptions:[]},{}));assert.throws(()=>parseGrok({subscriptions:[...subscriptions.subscriptions,{xaiUserId:'different-user'}]},{}));
});
test('Perplexity preserves count-only zero and unknown totals, percentages and resets',()=>{
 const s=parsePerplexity({user:{id:'fictional-user',email:'PRIVATE-EMAIL',subscription_tier:'pro'}},{remaining_pro:0,remaining_research:12});assert.equal(s.meters.length,2);const m=s.meters[0]!;assert.equal(m.remaining,0);assert.equal(m.total,null);assert.equal(m.usedPercent,null);assert.equal(m.resetsAt,null);assert.equal(meterValue(m),'0 left');assert.ok(!JSON.stringify(s).includes('PRIVATE-EMAIL'));assert.throws(()=>parsePerplexity({},{}));assert.throws(()=>parsePerplexity({user:{id:'a'}},{remaining_pro:NaN}));
});
test('Cursor preserves provider pools and currencies instead of averaging percentages or fees',()=>{
 const s=parseCursor({sub:'cursor-user',email:'PRIVATE-EMAIL'},{membershipType:'pro',billingCycleStart:'2026-10-01T00:00:00Z',billingCycleEnd:'2026-11-01T00:00:00Z',individualUsage:{plan:{used:500,limit:2000,autoPercentUsed:80,apiPercentUsed:20},onDemand:{enabled:true,used:325}}});
 const included=s.meters.find(m=>m.id==='cursor:included')!,spend=s.meters.find(m=>m.id==='cursor:on-demand')!;assert.equal(included.used,5);assert.equal(included.total,20);assert.equal(included.usedPercent,25);assert.equal(included.currency,'USD');assert.equal(spend.scope,'api');assert.equal(spend.used,3.25);assert.equal(spend.usedPercent,null);assert.match(meterValue(spend),/spent/);assert.ok(!JSON.stringify(s).includes('PRIVATE-EMAIL'));
});
test('Cursor empty/malformed buckets remain unknown and do not create a 0% usage value',()=>{
 assert.equal(parseCursor({sub:'a'},{}).meters.length,0);assert.throws(()=>parseCursor({email:'not-an-id'},{}));assert.throws(()=>parseCursor({sub:'a'},{individualUsage:{plan:{used:-1,limit:100}}}));
 assert.equal(parseCursor({sub:'a'},{individualUsage:{plan:{used:0,limit:100}}}).meters[0]!.usedPercent,0);
});
test('new readers verify identity twice and make only their fixed quota requests',async()=>{
 const calls:{path:string;request:unknown}[]=[];
 const s=await readAccountProvider('grok',{},async(path,_headers,request)=>{calls.push({path,request});return path==='/rest/subscriptions'?subscriptions:{remainingQueries:20,totalQueries:40}});assert.equal(s.meters[0]!.usedPercent,50);assert.deepEqual(calls.map(c=>c.path),['/rest/subscriptions','/rest/rate-limits','/rest/subscriptions']);assert.deepEqual(calls[1]!.request,{method:'POST',body:{requestKind:'DEFAULT',modelName:'grok-4'}});
 let count=0;await assert.rejects(readAccountProvider('perplexity',{},async path=>path==='/api/auth/session'?{user:{id:++count===1?'a':'b'}}:{remaining_pro:20}),/could not be verified/);
});
test('activity-only mode avoids quota requests and does not invent remote account identity',async()=>{
 let requests=0;const s=await readAccountProvider('perplexity',{readingMode:'activity'},async()=>{requests++;return {}});assert.equal(requests,0);assert.equal(s.kind,'browser');assert.equal(s.meters.length,0);const gemini=await readAccountProvider('gemini',{},async()=>{throw new Error('No quota call expected')});assert.equal(gemini.kind,'browser');assert.equal(catalog.gemini.support,'browser-observed');
});
test('Phase 1 V2 state gains a disabled Cursor source while preserving old activity mode',()=>{
 const initial=applySnapshot(emptyStore('preserved'),'grok','browser-record',{kind:'browser',displayName:'Grok · This browser',plan:null,meters:[]},Date.now());initial.providers.grok.readingMode=undefined;const {cursor:_,...providers}=initial.providers;const old={...initial,providers,connections:initial.connections.filter(c=>c.provider!=='cursor')};
 const next=StoreSchema.parse(old);assert.equal(next.providers.grok.readingMode,'activity');assert.equal(next.accounts[0]!.id,'browser-record');assert.equal(next.installSalt,'preserved');assert.equal(next.providers.cursor.enabled,false);assert.ok(next.connections.some(c=>c.id==='website:cursor'&&!c.enabled));
 assert.equal(MeterSchema.safeParse({...parsePerplexity({user:{id:'a'}},{remaining_pro:0}).meters[0],remaining:-2}).success,false);
});
