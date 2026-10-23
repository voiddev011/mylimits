import test from 'node:test';import assert from 'node:assert/strict';
import { PrivateStartSchema,PrivateSaveSchema,PrivateJournalSchema,privateSenderAllowed } from './private-signin';
const id='10000000-0000-4000-8000-000000000001',extension='a'.repeat(32),origin=`chrome-extension://${extension}/`;
test('private commands require explicit method and consent and reject credential-bearing extra fields',()=>{
 const start={type:'vault-signin-start',provider:'chatgpt',method:'private',nickname:'Personal'};
 assert.ok(PrivateStartSchema.safeParse(start,{jitless:true}).success);
 assert.equal(PrivateStartSchema.safeParse({...start,method:undefined},{jitless:true}).success,false);
 assert.equal(PrivateStartSchema.safeParse({...start,cookie:'FAKE_SECRET'},{jitless:true}).success,false);
 const save={type:'vault-signin-save',setupId:id,accountId:'verified-hash',consent:true};
 assert.ok(PrivateSaveSchema.safeParse(save,{jitless:true}).success);
 for(const data of [{...save,consent:false},{...save,consent:undefined},{...save,token:'FAKE_SECRET'}])assert.equal(PrivateSaveSchema.safeParse(data,{jitless:true}).success,false);
});
test('saved-sign-in sender must be the exact top-level normal dashboard',()=>{
 const sender={id:extension,url:origin+'dashboard.html#add',frameId:0,tab:{incognito:false}};
 assert.ok(privateSenderAllowed(sender,extension,origin));
 for(const patch of [{id:'b'.repeat(32)},{url:'https://chatgpt.com/'},{url:origin+'popup.html'},{url:origin+'dashboard.html?other'},{frameId:1},{tab:{incognito:true}},{tab:undefined},{url:`chrome-extension://${extension}.example/dashboard.html`}])assert.equal(privateSenderAllowed({...sender,...patch},extension,origin),false);
});
test('restart journal accepts only bounded setup metadata and rejects credentials',()=>{
 const data={version:1,id,slot:id,provider:'chatgpt',method:'private',expiresAt:1800000000000,windowId:2,tabId:3};
 assert.ok(PrivateJournalSchema.safeParse(data,{jitless:true}).success);
 for(const patch of [{cookie:'FAKE_SECRET'},{slot:'not-uuid'},{expiresAt:Infinity},{windowId:-1}])assert.equal(PrivateJournalSchema.safeParse({...data,...patch},{jitless:true}).success,false);
});
