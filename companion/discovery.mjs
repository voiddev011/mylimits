import path from 'node:path';
import { readdir,readFile } from 'node:fs/promises';
const profiles={chrome:['Google','Chrome','User Data'],brave:['BraveSoftware','Brave-Browser','User Data'],edge:['Microsoft','Edge','User Data'],chromium:['Chromium','User Data']};
export function extensionCandidates(preferences,browser,profile){
 const settings=preferences?.extensions?.settings;if(!settings||typeof settings!=='object')return [];
 return Object.entries(settings).flatMap(([id,value])=>/^[a-p]{32}$/.test(id)&&value?.manifest?.name==='MyLimits'?[{id,browser,profile,label:`${browser} · ${profile} · ${id}`}]:[]);
}
export async function discoverExtensions(localAppData){
 const result=[];
 for(const [browser,parts]of Object.entries(profiles)){const root=path.join(localAppData,...parts);let dirs;try{dirs=await readdir(root,{withFileTypes:true})}catch{continue}
  for(const dir of dirs.filter(d=>d.isDirectory()&&(d.name==='Default'||/^Profile \d+$/.test(d.name))))for(const name of ['Preferences','Secure Preferences']){
   try{const raw=await readFile(path.join(root,dir.name,name),'utf8');if(raw.length>32*1024*1024)continue;result.push(...extensionCandidates(JSON.parse(raw),browser,dir.name))}catch{/* Locked/malformed profiles remain available through the explicit ID fallback. */}
  }
 }
 return [...new Map(result.map(x=>[`${x.browser}/${x.id}`,x])).values()];
}
if(process.argv[1]&&path.basename(process.argv[1])==='discovery.mjs')process.stdout.write(JSON.stringify(await discoverExtensions(process.env.LOCALAPPDATA??'')));
