// Fictional first-party CLI shape. No provider/network/credentials are used.
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
const home=process.env.CLAUDE_CONFIG_DIR;
if(process.argv.includes('--version')){console.log('2.1.301 (fictional Claude)');process.exit(0);}
const fixture=JSON.parse(await readFile(path.join(home,'fixture.json'),'utf8'));
if(process.argv.includes('auth')){
 if(process.argv.includes('login')){
  if(fixture.delayLogin){await writeFile(path.join(home,'login-started'),'yes');process.stdin.setRawMode(true);process.stdin.on('data',d=>{if(d.includes(3))process.exit(0)});setInterval(()=>{},1000);await new Promise(()=>{});}
  await mkdir(process.env.MYLIMITS_AUTH_BROWSER_DIRECTORY,{recursive:true});
  await writeFile(path.join(process.env.MYLIMITS_AUTH_BROWSER_DIRECTORY,'route-result.json'),JSON.stringify({opened:true}));
  console.log('PRIVATE_FIXTURE_OUTPUT');process.exit(0);
 }
 if(process.argv.includes('status')){console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',configDirectory:home,email:fixture.email,orgId:fixture.org,subscriptionType:'pro'}));process.exit(0);}
 if(process.argv.includes('logout'))process.exit(0);
 process.exit(21);
}
if(!process.stdin.isTTY||!process.stdout.isTTY)process.exit(22);
process.stdin.setRawMode(true);process.stdout.write('Fictional Claude\r\n❯ \r\n');let input='';
process.stdin.on('data',d=>{
 if(d.includes(3))process.exit(0);input+=d.toString();if(!input.includes('\r'))return;
 if(input!=='/usage\r')process.exit(23);
 process.stdout.write('\x1b[2J\x1b[HCurrent session\r\n '+fixture.used+'% used\r\n\r\nCurrent week (all models)\r\n 0% used\r\n');
});
