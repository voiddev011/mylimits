import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, exportReadings, publicHistory } from './history-data';
import { demoState } from '../ui/demo';
test('CSV disarms formula prefixes and correctly quotes commas, quotes and line breaks',()=>{
 assert.equal(csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);assert.equal(csvCell('  @formula'),`"'  @formula"`);assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
});
test('history exports allowlist account and reading fields and retain observation age',()=>{
 const a=demoState(1800000000000).accounts[0]!;Object.assign(a,{accessToken:'SECRET',installSalt:'PRIVATE'});
 const p={accountId:a.id,time:1700000000000,receivedAt:1800000000000,meters:[{id:'session',usedPercent:20}],accessToken:'SECRET'};
 const result=exportReadings([a],[p],'json',1800000000000);assert.ok(!result.text.includes('SECRET'));assert.ok(!result.text.includes('PRIVATE'));assert.ok(result.text.includes('1700000000000'));assert.equal(publicHistory(p).legacy,true);
});
test('invalid saved history timestamps are rejected rather than exported as fresh',()=>{assert.throws(()=>publicHistory({accountId:'a',time:NaN,meters:[]}));});
