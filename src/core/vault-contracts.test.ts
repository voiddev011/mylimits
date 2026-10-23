import test from 'node:test';import assert from 'node:assert/strict';
import { VAULT_POLICY,VAULT_COOKIE_ALLOWLIST,vaultEnabled } from './vault-policy';
import { validateVaultPayload,vaultCookieHeader,VaultError } from './vault-contracts';
import { PROVIDER_IDS } from './model';
test('deferred provider decisions leave every production vault off with no guessed cookies',()=>{
 for(const p of PROVIDER_IDS){assert.equal(VAULT_POLICY[p],'off');assert.deepEqual(VAULT_COOKIE_ALLOWLIST[p],[]);assert.equal(vaultEnabled(p),false);assert.ok(Object.isFrozen(VAULT_COOKIE_ALLOWLIST[p]));}
});
test('vault payload allows two 4KB chunks but rejects oversize, unknown names, wrong origins and injection',()=>{
 const p={v:1,origin:'https://chatgpt.com',cookies:[{name:'fixture.0',value:'a'.repeat(4096)},{name:'fixture.1',value:'b'.repeat(4096)}]};
 assert.equal(validateVaultPayload('chatgpt',p,['fixture.0','fixture.1']).cookies.length,2);
 for(const bad of [{...p,origin:'https://evil.test'}, {...p,token:'SECRET'}, {...p,cookies:[{name:'fixture.0',value:'a'.repeat(16384)}]},
  {...p,cookies:[{name:'fixture.0',value:'bad;other=x'}]}, {...p,cookies:[{name:'fixture.0',value:'bad\r\nHEADER'}]}, {...p,cookies:[p.cookies[0],p.cookies[0]]}])
  assert.throws(()=>validateVaultPayload('chatgpt',bad,['fixture.0','fixture.1']),VaultError);
 assert.throws(()=>validateVaultPayload('chatgpt',p,['fixture.0']),VaultError);
 assert.throws(()=>validateVaultPayload('chatgpt',p,[]),VaultError);
});
test('vault header omits expired cookies and refuses an empty credential',()=>{
 const p=validateVaultPayload('chatgpt',{v:1,origin:'https://chatgpt.com',cookies:[{name:'a',value:'A'},{name:'b',value:'B',expirationDate:1}]},['a','b']);
 assert.equal(vaultCookieHeader(p,2000),'a=A');assert.throws(()=>vaultCookieHeader({...p,cookies:[p.cookies[1]!]},2000),VaultError);
});
