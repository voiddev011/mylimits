import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {frame,frameReader} from './protocol.mjs';
import {answer} from './local-auth.mjs';

test('actual native host and daemon exchange validated credential-free frames and isolate refresh from website sessions', {timeout:15000}, async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ml-ipc-'));
 const env={...process.env,MYLIMITS_DESKTOP_DATA_DIR:directory};
 const id='1f30feba-2b2a-4c19-8ebc-cd35bc96ff71';
 await writeFile(path.join(directory,'profiles.json'),JSON.stringify([id]));
 const home=path.join(directory,'accounts',id);await mkdir(home,{recursive:true});
 await writeFile(path.join(home,'proof-fixture.json'),JSON.stringify({email:'ipc@example.test',used:23}));
 const daemon=spawn(process.execPath,['companion/daemon.mjs',path.resolve('tests/fixtures/account-proof-cli.mjs')],{env,stdio:['ignore','pipe','pipe']});
 daemon.stdout.resume();daemon.stderr.resume();let host;
 async function stop(child){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();});}
 t.after(async()=>{await stop(host);await stop(daemon);await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 for(let i=0;i<100;i++){try{await readFile(path.join(directory,'connections-v2.json'));break;}catch{}await new Promise(r=>setTimeout(r,20));}
 const before=JSON.parse(await readFile(path.join(directory,'connections-v2.json'),'utf8'));
 assert.equal(before.profiles[0].updatedAt,0,'No browser client means no initial provider refresh');
 host=spawn(process.execPath,['companion/host.mjs'],{env,stdio:['pipe','pipe','pipe']});host.stderr.resume();
 const requests=new Map();let serial=0;const received=[];
 const parse=frameReader(message=>{received.push(message);if(requests.has(message.id)){requests.get(message.id)(message);requests.delete(message.id);}});
 host.stdout.on('data',parse);
 // Wait for native host authentication before sending its first request.
 await new Promise(r=>setTimeout(r,100));
 const request=async method=>{const id='request-'+(++serial);const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native fixture request timed out')),4000);requests.set(id,value=>{clearTimeout(timer);resolve(value);});});host.stdin.write(frame({id,method}));return result;};
 const cap=await request('capabilities');assert.equal(cap.ok,true);assert.equal(cap.data.identityConfirmation,true);
 let status;for(let i=0;i<60;i++){status=await request('status');if(status.data.profiles[0].updatedAt)break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(status.data.profiles[0].meters[0].usedPercent,23);
 assert.ok(!JSON.stringify(received).includes('NEVER_EXPORT'));
 assert.ok(!JSON.stringify(received).includes('PRIVATE'));
 const pipe=process.platform==='win32'?`\\\\.\\pipe\\mylimits-${(await import('node:crypto')).createHash('sha256').update(directory.toLowerCase()).digest('hex').slice(0,24)}`:path.join(directory,'companion.sock');
 const token=await readFile(path.join(directory,'bridge-token'),'utf8');
 const unauthorized=net.connect(pipe);unauthorized.on('error',()=>{});
 const closed=new Promise(resolve=>unauthorized.once('close',resolve));
 unauthorized.on('data',frameReader(message=>{
  if(message.type==='challenge'){unauthorized.write(frame(answer(message,token)));unauthorized.write(frame({id:'bad',method:'status',token:'FORBIDDEN'}));}
 }));
 await closed;assert.ok(unauthorized.destroyed);
});
