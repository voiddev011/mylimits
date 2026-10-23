import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseHasNoSpike } from './package-policy.mjs';
test('release guard rejects diagnostic files, bundled code and required diagnostic permissions while preserving C3 optional cookies',()=>{
 const manifest={permissions:['storage'],optional_permissions:['cookies']};
 assertReleaseHasNoSpike(manifest,['background.js','popup.html'],'ordinary code');
 for(const file of ['spike.html','chunks/spike-abc.js','assets/spike-abc.css'])assert.throws(()=>assertReleaseHasNoSpike(manifest,[file]));
 for(const marker of ['MYLIMITS_PRIVATE_SESSION_SPIKE','mylimits-spike-v1'])assert.throws(()=>assertReleaseHasNoSpike(manifest,['background.js'],marker));
 for(const permission of ['cookies','declarativeNetRequestWithHostAccess','webRequest'])assert.throws(()=>assertReleaseHasNoSpike({...manifest,permissions:[permission]},[]));
 assert.throws(()=>assertReleaseHasNoSpike({...manifest,optional_permissions:['webRequest']},[]));
});
