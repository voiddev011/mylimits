import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import { summarizeDeviceStart, summarizeCodexBrowserStart, classifyClaudeAuthorization, probeCodexDevice, probeCodexBrowser } from './hosted-login.mjs';
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

const browserStart = { type:'chatgpt', loginId:'PRIVATE-login', authUrl:
  'https://auth.openai.com/oauth/authorize?response_type=code&state=PRIVATE&code_challenge=PRIVATE&code_challenge_method=S256&redirect_uri='+
  encodeURIComponent('http://localhost:1455/auth/callback') };
test('official browser observation reports only callback class, never authorization material', () => {
  assert.deepEqual(summarizeCodexBrowserStart({...browserStart,accessToken:'PRIVATE'}), {issued:true,callback:'loopback'});
  const url = new URL(browserStart.authUrl);
  url.searchParams.set('redirect_uri','https://example.test/callback');
  assert.deepEqual(summarizeCodexBrowserStart({...browserStart,authUrl:url.href}), {issued:true,callback:'unestablished'});
  assert.ok(!JSON.stringify(summarizeCodexBrowserStart(browserStart)).includes('PRIVATE'));
});
test('official browser observation rejects lookalikes, unsafe redirects and malformed OAuth', () => {
  for (const value of [null, {...browserStart,type:'apiKey'}, {...browserStart,loginId:''},
    {...browserStart,authUrl:browserStart.authUrl.replace('auth.openai.com','auth.openai.com.evil.test')},
    {...browserStart,authUrl:browserStart.authUrl.replace('https://','http://')},
    {...browserStart,authUrl:browserStart.authUrl.replace('S256','plain')}]) {
    assert.deepEqual(summarizeCodexBrowserStart(value), {issued:false,callback:'unsupported'});
  }
  const url = new URL(browserStart.authUrl);
  for (const redirect of ['http://user@localhost:1455/auth/callback','http://localhost:1455/auth/callback?code=PRIVATE',
    'http://localhost.evil.test:1455/auth/callback','http://localhost:1455/auth/callback#PRIVATE']) {
    url.searchParams.set('redirect_uri',redirect);
    assert.equal(summarizeCodexBrowserStart({...browserStart,authUrl:url.href}).callback,'unestablished');
  }
});
test('managed browser probe cancels the official login without opening it or reading a quota', async () => {
  const methods = [];
  const result = await probeCodexBrowser(process.execPath,{version:async()=>'0.163.0',makeClient:()=>({child:{exitCode:0,signalCode:null},ready:Promise.resolve(),close(){},
    async request(method,params){methods.push(method);if(method==='account/read')return {account:null};
      if(method==='account/login/start'){assert.deepEqual(params,{type:'chatgpt',useHostedLoginSuccessPage:true});return browserStart;}
      if(method==='account/login/cancel'){assert.equal(params.loginId,browserStart.loginId);return {};}
      assert.fail('No other provider operations are allowed');}})});
  assert.deepEqual(methods,['account/read','account/login/start','account/login/cancel']);
  assert.equal(result.callback,'loopback');assert.equal(result.status,'transport-observed-only');
  assert.equal(result.authenticated,false);assert.equal(result.quotaFetched,false);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
