import { access, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { safeAuthUrl } from './protocol.mjs';

/** Fresh profile per authorization: never the user's existing browser session. */
export function browserCandidates(platform=process.platform, env=process.env) {
  if(platform==='win32')return [...new Set([env.PROGRAMFILES,env['PROGRAMFILES(X86)'],env.LOCALAPPDATA].filter(Boolean))].flatMap(root=>[
    path.win32.join(root,'Google','Chrome','Application','chrome.exe'),
    path.win32.join(root,'BraveSoftware','Brave-Browser','Application','brave.exe'),
    path.win32.join(root,'Microsoft','Edge','Application','msedge.exe'),
  ]);
  if(platform==='linux')return ['/usr/bin/google-chrome','/usr/bin/brave-browser','/usr/bin/microsoft-edge','/usr/bin/chromium','/usr/bin/chromium-browser'];
  return [];
}
export function authArguments(directory,url,provider='openai') {
  if(!safeAuthUrl(url,provider)||!path.isAbsolute(directory))throw new Error('Invalid authorization launch.');
  return [`--user-data-dir=${directory}`,'--no-first-run','--no-default-browser-check','--new-window',url];
}
export async function openAuthBrowser({directory,url,provider='openai'}) {
  if(!safeAuthUrl(url,provider))throw new Error('Invalid OpenAI sign-in URL.');
  let executable;
  for(const candidate of browserCandidates())try{await access(candidate);executable=candidate;break}catch{}
  if(!executable)throw new Error('Install Chrome, Brave, Edge or Chromium to authorize an independent profile.');
  await mkdir(directory,{recursive:true,mode:0o700});
  const child=spawn(executable,authArguments(directory,url,provider='openai'),{detached:true,stdio:'ignore',windowsHide:false});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});
  child.unref();
}
