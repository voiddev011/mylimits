import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {atomicJson} from './proof/store.mjs';
// Recovery metadata only. No auth environment, URL, stdin or CLI output.
export class OwnedProcesses {
 constructor(directory){this.file=path.join(directory,'owned-processes.json');this.entries=new Map();this.saving=Promise.resolve();}
 async assertClean(){
  let value;try{value=JSON.parse(await readFile(this.file,'utf8'));}catch(error){if(error.code==='ENOENT')return;throw Error('Desktop process recovery needs setup repair.');}
  if(value.version!==1||!Array.isArray(value.processes)||value.processes.length)throw Error('Desktop process recovery needs setup repair.');
 }
 async track(child,executable=child?.spawnfile){
  if(!Number.isInteger(child?.pid)||child.pid<1)return async()=>{};
  if(typeof executable!=='string'||!path.isAbsolute(executable))throw Error('Owned executable must be absolute.');
  const entry={pid:child.pid,executable,startedAt:Date.now()};this.entries.set(child.pid,entry);await this.save();
  return async()=>{if(this.entries.get(entry.pid)===entry)this.entries.delete(entry.pid);await this.save();};
 }
 save(){const value={version:1,processes:[...this.entries.values()]};this.saving=this.saving.catch(()=>{}).then(()=>atomicJson(this.file,value));return this.saving;}
}
