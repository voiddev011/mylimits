// An unauthenticated capability check, never a real-account acceptance test.
// Starts official login, replaces BROWSER with an owned harmless marker, then
// cancels. No account is signed in, no model request or auth URL is logged.
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {profileEnvironment} from '../companion/proof/runtime.mjs';
import {loadTerminalDependencies,stopProbeTerminal} from '../companion/proof/claude.mjs';
const root=await mkdtemp(path.join(tmpdir(),'mylimits-official-route-'));
let child,exited=false;
try{
 const windows=process.platform==='win32';
 if(!windows&&!process.env.MYLIMITS_CLAUDE_CAPABILITY_BINARY)throw Error('Supply the official capability binary on Linux.');
 let executable=process.env.MYLIMITS_CLAUDE_CAPABILITY_BINARY;
 if(!executable){
  const url='https://registry.npmjs.org/@anthropic-ai/claude-code-win32-x64/-/claude-code-win32-x64-2.1.301.tgz';
  const digest='sha512-YXl7/bzqywOZlqMW+18zi52DbZJJD8K5exBI6p2tLs5ZVEUhsd+fPnI+FOTehpRRHQ4imtIRas5zkcb3ninNtw==';
  const response=await fetch(url);if(!response.ok)throw Error('Official package download failed.');const bytes=Buffer.from(await response.arrayBuffer());
  if('sha512-'+createHash('sha512').update(bytes).digest('base64')!==digest)throw Error('Official package integrity mismatch.');
  const archive=path.join(root,'official.tgz');await writeFile(archive,bytes);execFileSync('tar',['-xf',archive,'-C',root]);executable=path.join(root,'package','claude.exe');
 }
 const home=path.join(root,'profile'),workspace=path.join(root,'empty');await mkdir(home);await mkdir(workspace);
 const marker=path.join(root,'marker.json'),script=path.join(root,'marker.mjs');
 await writeFile(script,`import{writeFileSync}from'node:fs';import{safeAuthUrl}from${JSON.stringify(new URL('../companion/protocol.mjs',import.meta.url).href)};const [mode,value]=process.argv.slice(2);const u=mode==='--encoded'?Buffer.from(value,'base64').toString('utf8'):value;if(!safeAuthUrl(u,'claude'))process.exit(2);writeFileSync(${JSON.stringify(marker)},JSON.stringify({routed:true,loopback:true}));`);
 const env={...profileEnvironment('claude',home),MYLIMITS_AUTH_ROUTER_NODE:process.execPath,MYLIMITS_AUTH_ROUTER_SCRIPT:script};
 if(windows)env.BROWSER=path.resolve('companion/windows/claude-browser.exe');
 else {env.BROWSER=path.join(root,'browser');const q=v=>"'"+v.replaceAll("'","'\\''")+"'";await writeFile(env.BROWSER,`#!/bin/sh\nexec ${q(process.execPath)} ${q(script)} --raw "$@"\n`,{mode:0o700});}
 const {spawnPty}=await loadTerminalDependencies();child=spawnPty(executable,['auth','login','--claudeai'],{env,cwd:workspace,cols:120,rows:40,name:'xterm-256color',useConpty:true});
 child.onData(()=>{});child.onExit(()=>{exited=true});
 let result;const start=Date.now();while(Date.now()-start<15000&&!exited){try{result=JSON.parse(await readFile(marker,'utf8'));break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 if(!result?.routed||!result.loopback)throw Error('The official browser override/local callback was not confirmed.');
 if(!await stopProbeTerminal(child,exited))throw Error('Official login process did not confirm shutdown.');child=null;
 console.log('Official Claude 2.1.301: BROWSER routing and CLI-owned local callback confirmed; login cancelled without an account.');
}finally{if(child)await stopProbeTerminal(child,exited);await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
