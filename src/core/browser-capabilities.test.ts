import test from 'node:test';import assert from 'node:assert/strict';import { syncGrant } from './browser-capabilities';
test('Firefox sync requests explicit data consent while Chromium requests only its exact host',()=>{
 const chrome=syncGrant('https://sync.example','chrome');assert.deepEqual(chrome,{origins:['https://sync.example/*']});const firefox=syncGrant('https://sync.example','firefox');assert.ok(firefox.data_collection?.includes('authenticationInfo'));assert.deepEqual(firefox.origins,chrome.origins);
});
