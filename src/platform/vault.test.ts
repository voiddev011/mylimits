import test from 'node:test';import assert from 'node:assert/strict';
import { createVault,type VaultPort } from './vault';
import { VAULT_KEY,VaultError,type VaultEnvelope } from '../core/vault-contracts';
import { createHostLock } from './host-lock';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const payload={v:1,origin:'https://chatgpt.com',cookies:[{name:'fixture',value:'COOKIE_SECRET',expirationDate:2000000000}]};
function fixture(){
 const data:Record<string,unknown>={};let key:CryptoKey|undefined,grants=0,creates=0,disabled=false;
 const lock=createHostLock();
 const port:VaultPort={local:{async get(k){return {[k]:structuredClone(data[k])}},async set(values){Object.assign(data,structuredClone(values));},async setAccessLevel(v){assert.equal(v.accessLevel,'TRUSTED_CONTEXTS');grants++;}},
  keys:{async load(){return key},async create(){creates++;return key??=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);}},
  crypto,now:()=>1800000000000,enabled:()=>!disabled,allowlist:()=>['fixture'],lock:run=>lock('vault-storage',run)};
 return {port,data,vault:createVault(port),key:()=>key,loseKey:()=>{key=undefined;},disabled:()=>{disabled=true;},grants:()=>grants,creates:()=>creates,envelope:()=>data[VAULT_KEY] as VaultEnvelope};
}
test('vault encrypts a round trip, persists only its separate envelope and exposes metadata without ciphertext',async()=>{
 const f=fixture(),a=await f.vault.putVault(A,'chatgpt',payload);
 assert.deepEqual(a.cookieNames,['fixture']);assert.equal((await f.vault.getVault(A,'chatgpt'))!.payload.cookies[0]!.value,'COOKIE_SECRET');
 const saved=JSON.stringify(f.data);assert.ok(!saved.includes('COOKIE_SECRET'));assert.deepEqual(Object.keys(f.data),[VAULT_KEY]);
 const list=JSON.stringify(await f.vault.listVault());for(const secret of ['COOKIE_SECRET','ciphertext','nonce'])assert.ok(!list.includes(secret));
 assert.equal(f.grants(),1);assert.equal(f.key()!.extractable,false);await assert.rejects(crypto.subtle.exportKey('raw',f.key()!));
});
test('slot and provider AAD bind ciphertext; wrong provider and tampering fail without disclosing secrets',async()=>{
 const f=fixture();await f.vault.putVault(A,'chatgpt',payload);
 f.envelope().entries[B]=structuredClone(f.envelope().entries[A]!);await assert.rejects(f.vault.getVault(B),{code:'corrupt'});
 f.envelope().entries[A]!.provider='claude';await assert.rejects(f.vault.getVault(A),{code:'corrupt'});
 f.envelope().entries[A]!.provider='chatgpt';const value=f.envelope().entries[A]!.ciphertext;
 f.envelope().entries[A]!.ciphertext=(value[0]==='A'?'B':'A')+value.slice(1);await assert.rejects(f.vault.getVault(A),{code:'corrupt'});
 assert.ok(!JSON.stringify(await f.vault.listVault()).includes('COOKIE_SECRET'));
});
test('key loss never regenerates over existing entries, while metadata and explicit deletion still work',async()=>{
 const f=fixture();await f.vault.putVault(A,'chatgpt',payload);f.loseKey();const before=JSON.stringify(f.data);
 await assert.rejects(f.vault.getVault(A),{code:'key-unavailable'});await assert.rejects(f.vault.putVault(B,'chatgpt',payload),{code:'key-unavailable'});
 assert.equal(f.creates(),1);assert.equal(JSON.stringify(f.data),before);assert.equal((await f.vault.listVault()).length,1);
 await f.vault.deleteVault(A);assert.deepEqual(await f.vault.listVault(),[]);
});
test('concurrent writers preserve separate entries, use unique nonces and disconnect deletes only its slot',async()=>{
 const f=fixture(),other=createVault(f.port);await Promise.all([f.vault.putVault(A,'chatgpt',payload),other.putVault(B,'chatgpt',payload)]);
 assert.equal((await f.vault.listVault()).length,2);assert.notEqual(f.envelope().entries[A]!.nonce,f.envelope().entries[B]!.nonce);
 await f.vault.deleteVault(B);assert.ok(await f.vault.getVault(A));assert.equal(await f.vault.getVault(B),null);
});
test('disabled policy, failed storage protection and corrupt envelopes fail closed without overwriting',async()=>{
 const f=fixture();f.disabled();await assert.rejects(f.vault.putVault(A,'chatgpt',payload),{code:'disabled'});assert.deepEqual(f.data,{});
 const g=fixture();g.port.local.setAccessLevel=async()=>{throw Error('STORAGE_SECRET')};await assert.rejects(g.vault.listVault(),e=>e instanceof VaultError&&!e.message.includes('STORAGE_SECRET'));
 const h=fixture();h.data[VAULT_KEY]={version:99,entries:{}};const before=JSON.stringify(h.data);
 await assert.rejects(h.vault.putVault(A,'chatgpt',payload),{code:'corrupt'});assert.equal(JSON.stringify(h.data),before);
});
test('vault metadata mismatch and invalid slots are rejected; existing provider cannot be silently replaced',async()=>{
 const f=fixture();await f.vault.putVault(A,'chatgpt',payload);
 await assert.rejects(f.vault.getVault(A,'claude'),{code:'provider-mismatch'});
 await assert.rejects(f.vault.putVault(A,'claude',{...payload,origin:'https://claude.ai'}),{code:'provider-mismatch'});
 f.envelope().entries[A]!.cookieNames=['other'];await assert.rejects(f.vault.getVault(A),VaultError);
 await assert.rejects(f.vault.deleteVault('__proto__'),{code:'invalid-slot'});
});
test('extractable keys and failed writes never persist plaintext or leak API error text',async()=>{
 const f=fixture();f.port.keys.create=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
 await assert.rejects(f.vault.putVault(A,'chatgpt',payload),{code:'key-unavailable'});assert.deepEqual(f.data,{});
 const g=fixture();g.port.local.set=async()=>{throw Error('COOKIE_SECRET STORAGE_ERROR')};
 await assert.rejects(g.vault.putVault(A,'chatgpt',payload),e=>e instanceof VaultError&&e.code==='storage-unavailable'&&!e.message.includes('SECRET'));
 assert.deepEqual(g.data,{});
});
test('the encrypted store accepts and decrypts two 4KB session chunks under the R2 cap',async()=>{
 const f=fixture();f.port.allowlist=()=>['fixture.0','fixture.1'];
 const p={v:1,origin:'https://chatgpt.com',cookies:[{name:'fixture.0',value:'a'.repeat(4096)},{name:'fixture.1',value:'b'.repeat(4096)}]};
 await f.vault.putVault(A,'chatgpt',p);const saved=await f.vault.getVault(A);
 assert.deepEqual(saved!.payload,p);assert.equal(saved!.metadata.notAfter,null);
});
