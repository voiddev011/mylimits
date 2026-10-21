import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import { summarizeDeviceStart, classifyClaudeAuthorization, probeCodexDevice } from './hosted-login.mjs';
const valid = { type: 'chatgptDeviceCode', loginId: 'PRIVATE-login', userCode: 'ABCD-1234', verificationUrl: 'https://auth.openai.com/codex/device' };
test('device-code observation excludes codes, IDs, tokens and arbitrary provider output', () => {
  const result = summarizeDeviceStart({ ...valid, accessToken: 'PRIVATE', raw: 'PRIVATE' });
  assert.deepEqual(result, { issued: true }); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('device authorization rejects lookalike hosts, queries, userinfo and wrong methods', () => {
  for (const change of [{verificationUrl:'https://auth.openai.com.evil.test/codex/device'},
    {verificationUrl:valid.verificationUrl+'?code=PRIVATE'}, {verificationUrl:'https://user@auth.openai.com/codex/device'},
    {type:'chatgpt'}, {userCode:'<private>'}]) assert.equal(summarizeDeviceStart({...valid,...change}).issued,false);
});
test('Claude callback classification returns no state, code, URL or secret payload', () => {
  const url = 'https://claude.com/cai/oauth/authorize?response_type=code&state=PRIVATE&code_challenge=PRIVATE&redirect_uri=';
  assert.deepEqual(classifyClaudeAuthorization(url+encodeURIComponent('http://localhost:43123/callback')), {firstParty:true,callback:'loopback'});
  assert.deepEqual(classifyClaudeAuthorization(url+encodeURIComponent('https://platform.claude.com/oauth/code/callback')), {firstParty:true,callback:'provider-code-page'});
  assert.equal(classifyClaudeAuthorization(url.replace('claude.com','claude.com.evil.test')+encodeURIComponent('http://localhost:43123/callback')).firstParty,false);
  assert.equal(classifyClaudeAuthorization(url+encodeURIComponent('https://example.test/callback')).callback,'unsupported');
});
test('transport probe refuses an ambient signed-in identity without starting login or reading quotas', async () => {
  const methods = []; const child = { exitCode:0,signalCode:null };
  const result = await probeCodexDevice(process.execPath, {version:async()=>'0.163.0',makeClient:()=>({child,ready:Promise.resolve(),close(){},
    async request(method){methods.push(method);return {account:{email:'PRIVATE'}};}})});
  assert.equal(result.errorCode,'unexpected-account');assert.deepEqual(methods,['account/read']);
  assert.equal(result.authenticated,false);assert.equal(result.quotaFetched,false);assert.equal(result.shutdownConfirmed,true);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('device probe cancels its own login and never reads quota or claims authenticated', async () => {
  const methods = []; let cancelled;
  const result = await probeCodexDevice(process.execPath,{version:async()=>'0.163.0',makeClient:()=>({child:{exitCode:0,signalCode:null},ready:Promise.resolve(),close(){},
    async request(method,params){methods.push(method);if(method==='account/read')return {account:null};
      if(method==='account/login/start'){assert.deepEqual(params,{type:'chatgptDeviceCode'});return {...valid,token:'PRIVATE'};}
      if(method==='account/login/cancel'){cancelled=params.loginId;return {};}
      assert.fail('An unauthenticated trial must not call '+method);}})});
  assert.equal(cancelled,valid.loginId);assert.equal(result.status,'transport-observed-only');
  assert.equal(result.authenticated,false);assert.equal(result.quotaFetched,false);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('provider error messages are not included in transport trial output', async () => {
  const result = await probeCodexDevice(process.execPath,{version:async()=>'0.163.0',makeClient:()=>({child:{exitCode:0,signalCode:null},ready:Promise.resolve(),close(){},
    async request(method){if(method==='account/read')return {account:null};throw Object.assign(Error('PRIVATE'),{code:'throttled'});}})});
  assert.equal(result.status,'blocked');assert.equal(result.errorCode,'throttled');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('unconfirmed metadata-command shutdown retains its owned profile for recovery', async () => {
  let directory;
  try {
    const result = await probeCodexDevice(process.execPath,{version:async(_file,options)=>{
      directory=options.cwd;throw Object.assign(Error('PRIVATE'),{code:'terminal-stop-unconfirmed'});
    }});
    assert.equal(result.status,'blocked');assert.equal(result.errorCode,'terminal-stop-unconfirmed');
    assert.equal(result.shutdownConfirmed,false);await access(directory);
  } finally {if(directory)await rm(directory,{recursive:true,force:true});}
});
