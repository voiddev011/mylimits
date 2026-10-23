import test from 'node:test';
import assert from 'node:assert/strict';
import { TransitKms } from '../src/transit-kms';
test('transit uses owner-bound context, strict key identity, safe failures and no redirects',async()=>{
 const original=globalThis.fetch,calls:{url:string;options:RequestInit}[]=[];
 const key=Buffer.alloc(32,7),binding={owner:'fixture',connectionId:crypto.randomUUID(),generation:2};
 globalThis.fetch=(async(url:URL|RequestInfo,options?:RequestInit)=>{calls.push({url:String(url),options:options!});return new Response(JSON.stringify({data:String(url).includes('/encrypt/')?{ciphertext:'vault:v2:ZmljdGlvbg=='}:{plaintext:key.toString('base64')}}));}) as typeof fetch;
 try{
  const kms=new TransitKms('https://vault.fixture.invalid','fixture','PRIVATE-FIXTURE-TOKEN');
  const wrapped=await kms.wrapKey(key,binding);assert.deepEqual(await kms.unwrapKey(wrapped.keyId,wrapped.wrappedKey,binding),key);
  assert.ok(calls.every(c=>c.options.redirect==='error'&&c.url.startsWith('https://vault.fixture.invalid/v1/transit/')));
  assert.equal(JSON.parse(calls[0]!.options.body as string).context,Buffer.from(JSON.stringify(['fixture',binding.connectionId,2])).toString('base64'));
  await assert.rejects(kms.unwrapKey('different-key',wrapped.wrappedKey,binding),/credential_binding_rejected/);
  globalThis.fetch=(async()=>{throw new Error('PRIVATE-FIXTURE-TOKEN');}) as typeof fetch;
  await assert.rejects(kms.wrapKey(key,binding),e=>e instanceof Error&&e.message==='credential_service_unavailable');
  assert.throws(()=>new TransitKms('http://vault.fixture.invalid','fixture','token'));
 }finally{globalThis.fetch=original;}
});
