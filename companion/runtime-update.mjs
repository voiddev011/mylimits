import {rename,rm,lstat} from 'node:fs/promises';
const realDirectory=async directory=>{try{const s=await lstat(directory);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe runtime directory.');return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export async function activateRuntime(stage,runtime){
 if(!await realDirectory(stage))throw Error('Staged runtime is missing.');
 const backup=runtime+'.previous';
 if(await realDirectory(backup))throw Error('A previous Desktop update needs repair.');
 const hadPrior=await realDirectory(runtime);
 if(hadPrior)await rename(runtime,backup);
 try{await rename(stage,runtime);}catch(error){if(hadPrior)await rename(backup,runtime);throw error;}
 let complete=false;
 return {
  async commit(){if(complete)return;if(hadPrior)await rm(backup,{recursive:true});complete=true;},
  async rollback(){if(complete)return;await rm(runtime,{recursive:true,force:true});if(hadPrior)await rename(backup,runtime);complete=true;},
 };
}
