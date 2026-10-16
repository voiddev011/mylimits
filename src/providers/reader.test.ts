import test from 'node:test';
import assert from 'node:assert/strict';
import { readAccountProvider } from './reader';
import { retryTime } from './errors';
const orgs=[{uuid:'a',name:'Team A',capabilities:['chat']},{uuid:'b',name:'Team B',capabilities:['chat']}];
const usage={five_hour:{utilization:0,resets_at:'2027-01-01T00:00:00Z'}};
test('reader selects the requested verified Claude workspace and returns sanitized choices',async()=>{
 const calls:string[]=[];const result=await readAccountProvider('claude',{workspaceRemoteId:'b'},async path=>{calls.push(path);return path==='/api/account'?{uuid:'user'}:path==='/api/organizations'?orgs:usage});
 assert.ok(calls.includes('/api/organizations/b/usage'));assert.equal(result.workspace!.identity,'b');assert.equal(result.workspaces!.length,2);assert.equal(result.meters[0]!.usedPercent,0);
});
test('reader refuses an unavailable selected workspace rather than silently choosing another',async()=>{
 const calls:string[]=[];await assert.rejects(readAccountProvider('claude',{workspaceRemoteId:'removed'},async path=>{calls.push(path);return path==='/api/account'?{uuid:'user'}:orgs}),/selected workspace/);assert.equal(calls.length,2);
});
test('ChatGPT transient bearer is used only for the usage request and not returned in snapshot',async()=>{
 const result=await readAccountProvider('chatgpt',{},async(path,headers)=>{if(path==='/api/auth/session')return {user:{id:'user'},accessToken:'fixture-only'};assert.equal(headers?.Authorization,'Bearer fixture-only');return {rate_limit:{primary_window:{used_percent:25,limit_window_seconds:18000}}}});
 assert.ok(!JSON.stringify(result).includes('fixture-only'));assert.equal(result.meters[0]!.scope,'work-codex');
 await assert.rejects(readAccountProvider('chatgpt',{},async()=>({user:{id:'user'}})),/Sign in/);
});
test('retry timing honors delta/date, rejects invalid values and bounds extreme waits',()=>{
 const now=1800000000000;assert.equal(retryTime('60',now),now+60000);assert.equal(retryTime('invalid',now),null);assert.equal(retryTime('999999999',now),now+86400000);
});
test('Claude and ChatGPT reject a website account switch during quota retrieval',async()=>{
 let reads=0;
 await assert.rejects(readAccountProvider('claude',{},async path=>path==='/api/account'?{uuid:++reads===1?'user-a':'user-b'}:path==='/api/organizations'?orgs:usage),/account changed/);
 reads=0;
 await assert.rejects(readAccountProvider('chatgpt',{},async path=>path==='/api/auth/session'?{user:{id:++reads===1?'user-a':'user-b'},accessToken:'fixture-only'}:{rate_limit:{}}),/account changed/);
});
