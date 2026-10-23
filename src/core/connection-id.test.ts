import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConnectionId,vaultId,websiteId } from './connection-id';
const slot='665b4a3f-766e-4a0a-9ff7-645905bb7d8f';
test('connection IDs preserve website IDs and distinguish provider/slot without guessing legacy IDs',()=>{
 assert.equal(websiteId('claude'),'website:claude');
 assert.deepEqual(parseConnectionId(vaultId('chatgpt',slot)),{kind:'vault',provider:'chatgpt',slot});
 assert.deepEqual(parseConnectionId(websiteId('claude')),{kind:'website',provider:'claude'});
 assert.notEqual(vaultId('claude',slot),vaultId('chatgpt',slot));
 for(const id of ['website:other','website:claude:extra',`vault:claude:${slot}:extra`,'vault:claude:label','companion:legacy','cloud:old'])assert.equal(parseConnectionId(id),null,id);
 assert.throws(()=>vaultId('claude','nickname'));
});
