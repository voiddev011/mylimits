import assert from 'node:assert/strict';
export function assertReleaseHasNoSpike(manifest,files,bundled=''){
 assert.ok(!files.some(file=>/(^|[\/_.-])spike([\/_.-]|$)/i.test(file)),'Release contains a spike file');
 assert.ok(!bundled.includes('MYLIMITS_PRIVATE_SESSION_SPIKE')&&!bundled.includes('mylimits-spike-v1'),'Release contains spike runtime code');
 for(const permission of ['cookies','declarativeNetRequestWithHostAccess','webRequest'])assert.ok(!manifest.permissions?.includes(permission),`Release requires spike permission ${permission}`);
 // C3's existing optional cookies grant is intentional; do not remove sign-in detection.
 for(const permission of ['declarativeNetRequestWithHostAccess','webRequest','declarativeNetRequestFeedback'])assert.ok(!manifest.optional_permissions?.includes(permission),`Release exposes spike permission ${permission}`);
}
