import test from 'node:test';import assert from 'node:assert/strict';
import { generateKeyPair,exportJWK,createLocalJWKSet,SignJWT } from 'jose';import { verifyToken } from '../src/token-verification';
test('real signed app tokens enforce issuer, audience, expiry, issued-at and allowed algorithms',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey),keys=createLocalJWKSet({keys:[{...jwk,kid:'fixture',alg:'RS256'}]});
 const now=Math.floor(Date.now()/1000),options={issuer:'https://fixture.invalid',audience:'mylimits'};
 const sign=(claims:Record<string,unknown>={})=>new SignJWT({iss:options.issuer,aud:options.audience,sub:'alice',iat:now,exp:now+300,...claims}).setProtectedHeader({alg:'RS256',kid:'fixture'}).sign(privateKey);
 assert.deepEqual(await verifyToken(await sign(),keys,options),{issuer:options.issuer,subject:'alice'});
 for(const bad of [{iss:'https://other.invalid'},{aud:'other'},{exp:now-10},{iat:now+120},{sub:''},{iat:now-90000}])await assert.rejects(verifyToken(await sign(bad),keys,options));
 await assert.rejects(verifyToken((await sign()).replace(/.$/,'!'),keys,options));
 const idOptions={...options,nonce:'nonce'};await verifyToken(await sign({nonce:'nonce',aud:['mylimits','other'],azp:'mylimits'}),keys,idOptions);
 await assert.rejects(verifyToken(await sign({nonce:'nonce',aud:['mylimits','other']}),keys,idOptions));await assert.rejects(verifyToken(await sign({nonce:'different'}),keys,idOptions));
});
