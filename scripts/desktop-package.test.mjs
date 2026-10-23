import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {stageDesktop,runtimeAssets} from './desktop-package.mjs';
test('online Desktop payload includes real Windows PTY libraries without Node, Codex, debug symbols or credentials',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ml-package-'));
 try{
  const report=await stageDesktop(dir);
  assert.equal(report.kind,'online-bootstrapper');assert.ok(report.payloadBytes<10*1024*1024);
  assert.ok(report.files.some(f=>f.path.endsWith('prebuilds/win32-x64/conpty.node')));
  assert.ok(report.files.every(f=>!/(?:\.pdb$|\.map$|bridge-token|auth\.json|\.credentials|download-cache|\/build\/|prebuilds\/(?:linux|darwin))/.test(f.path)));
  await assert.rejects(access(path.join(dir,'dependencies','node.exe')));
  await assert.rejects(access(path.join(dir,'dependencies','codex','bin','codex.exe')));
  const config=JSON.parse(await readFile(path.join(dir,'desktop-dependencies.json'),'utf8'));
  assert.equal(config.node.bytes,37733703);assert.equal(config.codex.bytes,167618721);
  for(const asset of Object.values(runtimeAssets)){assert.equal(new URL(asset.url).protocol,'https:');assert.ok(/^[a-f0-9]+$/.test(asset.digest));assert.equal(asset.executableDigest.length,64);}
 }finally{await rm(dir,{recursive:true,force:true});}
});
