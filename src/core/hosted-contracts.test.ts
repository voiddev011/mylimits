import test from 'node:test';
import assert from 'node:assert/strict';
import { HostedConnectionSchema,HostedAttemptSchema,unavailableCapabilities } from './hosted-contracts';
test('hosted production capabilities default to unavailable per provider',()=>{
 const c=unavailableCapabilities();assert.equal(c.providers.length,2);assert.ok(c.providers.every(p=>!p.available&&p.method===null&&p.scopes.length===0));
});
test('public hosted contracts reject credentials and require verified identity',()=>{
 const c={id:crypto.randomUUID(),provider:'openai',alias:'Personal',identity:{subject:'fixture',workspace:null},method:'official-popup',capabilities:['work-codex'],state:'active',generation:0,meters:[],fetchedAt:null,providerObservedAt:null,nextEligibleAt:null,staleReason:'never-fetched',error:null};
 assert.ok(HostedConnectionSchema.safeParse(c).success);
 assert.equal(HostedConnectionSchema.safeParse({...c,token:'secret'}).success,false);
 assert.equal(HostedConnectionSchema.safeParse({...c,identity:{email:'same@fixture.invalid'}}).success,false);
 assert.equal(HostedAttemptSchema.safeParse({id:crypto.randomUUID(),provider:'openai',state:'pending',expiresAt:1,connectionId:null,authorizationUrl:null,refresh_token:'secret'}).success,false);
});
