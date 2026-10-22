import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {activateRuntime} from './runtime-update.mjs';import {OwnedProcesses} from './owned-processes.mjs';
test('runtime activation can roll back and never replaces account data',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'ml-update-'));try{
  const runtime=path.join(root,'runtime'),stage=path.join(root,'next');await mkdir(runtime);await mkdir(stage);
  await writeFile(path.join(root,'connections-v2.json'),'history');await writeFile(path.join(runtime,'version'),'old');await writeFile(path.join(stage,'version'),'new');
  const update=await activateRuntime(stage,runtime);assert.equal(await readFile(path.join(runtime,'version'),'utf8'),'new');
  await update.rollback();assert.equal(await readFile(path.join(runtime,'version'),'utf8'),'old');assert.equal(await readFile(path.join(root,'connections-v2.json'),'utf8'),'history');
  await mkdir(stage);await writeFile(path.join(stage,'version'),'next');const committed=await activateRuntime(stage,runtime);await committed.commit();
  assert.equal(await readFile(path.join(runtime,'version'),'utf8'),'next');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unconfirmed process ownership survives restart and confirmed exit clears its recovery fence',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'ml-owned-'));try{
  const owner=new OwnedProcesses(root);await owner.assertClean();const release=await owner.track({pid:12345,spawnfile:process.execPath});
  const pending=new OwnedProcesses(root);await assert.rejects(pending.assertClean());
  const raw=await readFile(path.join(root,'owned-processes.json'),'utf8');assert.ok(!raw.includes('token'));assert.ok(!raw.includes('authUrl'));
  await release();await pending.assertClean();
 }finally{await rm(root,{recursive:true,force:true});}
});
