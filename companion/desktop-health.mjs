import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {localToken,answer} from './local-auth.mjs';
import {dataDir,socketPath} from './paths.mjs';
import {frame,frameReader} from './protocol.mjs';
export async function desktopHealth({directory=dataDir,socket=socketPath,timeout=5000}={}){
 const token=await localToken(directory);
 return new Promise((resolve,reject)=>{
  const client=net.connect(socket);let done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);client.destroy();error?reject(Error('Desktop did not confirm readiness. Retry setup.')):resolve(result);};
  const timer=setTimeout(()=>finish(true),timeout);
  const read=frameReader(message=>{
   if(message.type==='challenge'){try{client.write(frame(answer(message,token)));client.write(frame({id:'desktop-health',method:'capabilities'}));}catch{finish(true);}return;}
   if(message.id==='desktop-health'){
    if(message.ok!==true||message.data?.protocol!==2||message.data.identityConfirmation!==true){finish(true);return;}
    finish(false,{ready:true,version:message.data.version,providers:message.data.providers.map(p=>({provider:p.provider,available:p.available}))});
   }
  });
  client.on('data',chunk=>{try{read(chunk);}catch{finish(true);}});client.on('error',()=>finish(true));client.on('end',()=>finish(true));
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{process.stdout.write(JSON.stringify(await desktopHealth())+'\n');}catch{process.stderr.write('Desktop readiness was not confirmed. Retry setup.\n');process.exitCode=1;}
}
