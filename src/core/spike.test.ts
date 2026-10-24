import test from 'node:test';
import assert from 'node:assert/strict';
import { SpikeCommandSchema,cookieFlags,cookieHeader,setCookieNames,spikeRule,tokenExpiry,endpointAllowed,spikeSenderAllowed,type ProbeCookie } from './spike';
const c:ProbeCookie={name:'sessionKey',value:'SECRET_COOKIE',domain:'.claude.ai',path:'/',storeId:'normal',httpOnly:true,secure:true,session:false,expirationDate:1800003600};
test('spike cookie/response projections retain flags and names without copying values',()=>{
 assert.ok(!JSON.stringify(cookieFlags(c)).includes('SECRET_COOKIE'));
 assert.deepEqual(setCookieNames([{name:'Set-Cookie',value:'sessionKey=COOKIE_SECRET; HttpOnly'},{name:'set-cookie',value:'cf_clearance=OTHER_SECRET'},{name:'Authorization',value:'TOKEN_SECRET'},{name:'Set-Cookie',value:'invalid name=secret'}]),['sessionKey','cf_clearance']);
});
test('spike rules always scope host, extension initiator and tab-less requests',()=>{
 const rule=spikeRule('chatgpt','a'.repeat(32),'session=FAKE_SECRET');
 assert.deepEqual(rule.condition,{requestDomains:['chatgpt.com'],initiatorDomains:['a'.repeat(32)],resourceTypes:['xmlhttprequest'],tabIds:[-1]});
 assert.ok(rule.action.requestHeaders.some(h=>h.header==='cookie'));assert.ok(!spikeRule('claude','b'.repeat(32)).action.requestHeaders.some(h=>h.header==='cookie'));
 assert.throws(()=>spikeRule('claude','unverified-extension-origin'));
});
test('cookie replay enforces expiry, partition, domain/path scope, injection checks and the 16KB cap',()=>{
 const now=1800000000000;
 assert.equal(cookieHeader('claude','/api/account',[c,{...c,name:'expired',expirationDate:1},{...c,name:'partitioned',partitionKey:{}},{...c,domain:'evil.test'},{...c,path:'/other'}],now),'sessionKey=SECRET_COOKIE');
 assert.equal(cookieHeader('claude','/api/account',[{...c,path:'/api'}],now),'sessionKey=SECRET_COOKIE');
 assert.throws(()=>cookieHeader('claude','/api-other',[{...c,path:'/api'}],now));
 for(const value of ['bad;other=cookie','bad\r\nInjected:yes','bad value'])assert.throws(()=>cookieHeader('claude','/',[{...c,value}],now));
 assert.ok(cookieHeader('claude','/',[{...c,name:'part0',value:'a'.repeat(4096)},{...c,name:'part1',value:'b'.repeat(4096)}],now).length>8192);
 assert.throws(()=>cookieHeader('claude','/',[{...c,value:'a'.repeat(16384)}],now));
});
test('token inspection returns only an unverified numeric expiry and rejects malformed claims',()=>{
 const jwt=(p:unknown)=>`e30.${Buffer.from(JSON.stringify(p)).toString('base64url')}.TOKEN_SECRET`;
 assert.equal(tokenExpiry(jwt({exp:1800000000,secret:'BODY_SECRET'})),1800000000000);
 for(const token of ['bad',jwt({exp:'1800'}),jwt({exp:-1}),jwt({exp:1e20})])assert.equal(tokenExpiry(token),null);
});
