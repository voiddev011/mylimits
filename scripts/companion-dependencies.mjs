import { readFile,writeFile,mkdir,cp,access,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
// Explicitly pinned upstream releases; no user-side npm/global Node installation.
const assets=[
 {name:'node-v24.22.0-win-x64.zip',url:'https://nodejs.org/dist/v24.22.0/node-v24.22.0-win-x64.zip',algorithm:'sha256',digest:'f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3'},
 {name:'codex-0.163.0-win32-x64.tgz',url:'https://registry.npmjs.org/@openai/codex/-/codex-0.163.0-win32-x64.tgz',algorithm:'sha512',digest:'QQGQ/q9dCJ5C5jqhgFrwycpWG3szIyFNThMiKl6hYtu6N/eM3Qd7StesgnCFAfzVED8IkE3N3oH71szzcludqw==',base64:true},
];
async function download(asset,cache){
 const file=path.join(cache,asset.name);let data;try{data=await readFile(file)}catch{}
 if(!data){console.log(`Downloading pinned ${asset.name}`);const response=await fetch(asset.url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error(`Dependency download failed (${response.status}).`);data=Buffer.from(await response.arrayBuffer());}
 if(createHash(asset.algorithm).update(data).digest(asset.base64?'base64':'hex')!==asset.digest)throw Error(`Integrity check failed: ${asset.name}`);
 await writeFile(file,data);return file;
}
export async function bundleCompanionDependencies(staging){
 const cache=path.resolve(process.env.MYLIMITS_DEPENDENCY_CACHE??'artifacts/dependency-cache');await mkdir(cache,{recursive:true});
 const runtime=path.join(staging,'dependencies');await mkdir(runtime,{recursive:true});
 for(const asset of assets){const archive=await download(asset,cache);const dir=path.join(cache,asset.name+'.extracted');try{await access(path.join(dir,'.verified'))}catch{
   await mkdir(dir,{recursive:true});
   if(asset.name.endsWith('.zip')&&process.platform!=='win32')execFileSync('unzip',['-q','-o',archive,'-d',dir],{stdio:'inherit'});
   else execFileSync('tar',['-xf',archive,'-C',dir],{stdio:'inherit'});
   await writeFile(path.join(dir,'.verified'),asset.digest);
  }
  if(asset.name.startsWith('node')){await cp(path.join(dir,'node-v24.22.0-win-x64','node.exe'),path.join(runtime,'node.exe'));await cp(path.join(dir,'node-v24.22.0-win-x64','LICENSE'),path.join(runtime,'NODE-LICENSE.txt'));}
  else {
   const vendor=path.join(dir,'package','vendor','x86_64-pc-windows-msvc');
   // Preserve official native runtime layout, including bundled support libraries.
   await cp(vendor,path.join(runtime,'codex'),{recursive:true});
   for(const name of await readdir(path.join(dir,'package')))if(/^(LICENSE|NOTICE)/i.test(name))await cp(path.join(dir,'package',name),path.join(runtime,'CODEX-'+name.replace(/\.md$/i,'.txt')));
  }
 }
 await writeFile(path.join(runtime,'DEPENDENCIES.json'),JSON.stringify({architecture:'win32-x64',node:'24.22.0',codex:'0.163.0',assets},null,2));
}
