import {mkdir,rm,copyFile,cp,readdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {assets,bundleCompanionDependencies} from './companion-dependencies.mjs';

export const runtimeAssets = Object.fromEntries(assets.map((a,i)=>[i===0?'node':'codex',{
 ...a,algorithm:a.algorithm.toUpperCase(),digest:a.base64?Buffer.from(a.digest,'base64').toString('hex'):a.digest,
 executableDigest:i===0?'ba93f9a70bd86fce3ebbb39ec758501458453467aa92a34a0a3602d1e3fc2b9c':'2692c8c7bb2cf8b0aefe638741fc90236f4b824c59578ce84994f9de58200993',
}]));
export async function stageDesktop(staging,{offline=false}={}){
 await rm(staging,{recursive:true,force:true});await mkdir(path.join(staging,'windows'),{recursive:true});
 const source=path.resolve('companion');
 for(const name of (await readdir(source)).filter(n=>n.endsWith('.mjs')&&!n.endsWith('.test.mjs')))await copyFile(path.join(source,name),path.join(staging,name));
 await mkdir(path.join(staging,'proof'),{recursive:true});
 for(const name of ['runtime.mjs','store.mjs','codex-login.mjs','errors.mjs','claude.mjs'])await copyFile(path.join(source,'proof',name),path.join(staging,'proof',name));
 const windows=['setup.ps1','desktop-setup.ps1','desktop-runtime.ps1','uninstall.ps1','compile-claude-browser.ps1','claude-browser.cs'];
 for(const name of windows)await copyFile(path.join(source,'windows',name),path.join(staging,'windows',name));
 const filter=name=>!name.endsWith('.pdb')&&!name.endsWith('.map')&&!name.endsWith('.test.js');
 for(const [name,folders] of [['node-pty',['lib','prebuilds/win32-x64']],['@xterm/headless',['lib-headless']]]){
  const input=path.resolve('node_modules',name),out=path.join(staging,'node_modules',name);
  await mkdir(out,{recursive:true});await copyFile(path.join(input,'package.json'),path.join(out,'package.json'));
  for(const folder of folders)await cp(path.join(input,folder),path.join(out,folder),{recursive:true,filter});
  for(const license of (await readdir(input)).filter(n=>/^(LICENSE|NOTICE)/i.test(n)))await copyFile(path.join(input,license),path.join(out,license));
  if(name==='@xterm/headless')await copyFile(path.join(source,'windows','XTERM-LICENSE.txt'),path.join(out,'LICENSE'));
 }
 await writeFile(path.join(staging,'desktop-dependencies.json'),JSON.stringify({version:'3.4.0',architecture:'win32-x64',...runtimeAssets},null,2));
 await mkdir(path.join(staging,'dependencies'),{recursive:true});
 for(const name of ['CODEX-LICENSE.txt','CODEX-NOTICE.txt'])await copyFile(path.join(source,'windows',name),path.join(staging,'dependencies',name));
 if(offline)await bundleCompanionDependencies(staging);
 const files=(await readdir(staging)).filter(n=>n.endsWith('.mjs')||n.endsWith('.json'));
 await writeFile(path.join(staging,'uninstall-files.nsh'),[...files.map(n=>'Delete "$INSTDIR\\'+n+'"'),...windows.map(n=>'Delete "$INSTDIR\\windows\\'+n+'"')].join('\n'));
 const entries=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else entries.push({path:path.relative(staging,file).replaceAll('\\','/'),bytes:(await stat(file)).size});}}
 await walk(staging);
 return {kind:offline?'offline':'online-bootstrapper',payloadBytes:entries.reduce((n,f)=>n+f.bytes,0),files:entries,nodeDownloadBytes:runtimeAssets.node.bytes,codexDownloadBytes:runtimeAssets.codex.bytes};
}
