import { mkdir, writeFile, chmod, readFile, cp, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchLauncher, registryRoots, taskScript, encodedPowerShell, psLiteral } from './windows.mjs';
import { dataDir, hostName } from './paths.mjs';

// Install only for the current OS user. No browser cookies or passwords are read.
const windows = process.platform === 'win32';
if (!windows && process.platform !== 'linux') throw new Error('This installer supports Windows and Linux.');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const extensionId = option('--extension-id');
const browserName = option('--browser') ?? 'chrome';
const browserDirs = { chrome: 'google-chrome', chromium: 'chromium', brave: 'BraveSoftware/Brave-Browser',edge:'microsoft-edge' };
let targets=[{id:extensionId,browser:browserName}];
if(option('--registrations-file')){
 const file=option('--registrations-file');if(!path.isAbsolute(file))throw new Error('Desktop registration file must be absolute.');
 const text=await readFile(file,'utf8');if(Buffer.byteLength(text)>16384)throw new Error('Too many Desktop registrations.');
 targets=JSON.parse(text);
}
if(!Array.isArray(targets)||!targets.length||targets.length>100||targets.some(t=>!t||!/^[a-p]{32}$/.test(t.id)||!Object.hasOwn(browserDirs,t.browser)))throw new Error('Desktop registration needs detected MyLimits extension IDs and supported browsers.');
let executable = option('--codex');
const withoutOpenAI=args.includes('--without-openai');
if (!executable && !withoutOpenAI) { try { executable = execFileSync(windows ? 'where.exe' : 'which', [windows ? 'codex.cmd' : 'codex'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]; } catch { throw new Error('Install OpenAI support through MyLimits Desktop setup.'); } }
if(!executable&&withoutOpenAI)executable='codex';
if (windows && /\.(cmd|bat)$/i.test(executable)) {
  executable = path.join(path.dirname(executable), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
}
if (!withoutOpenAI && !path.isAbsolute(executable)) throw new Error('--codex must be an absolute path.');
if(!withoutOpenAI)execFileSync(/\.m?js$/i.test(executable) ? process.execPath : executable, [...(/\.m?js$/i.test(executable) ? [executable] : []), '--version'], { stdio: 'ignore' });
const source = path.dirname(fileURLToPath(import.meta.url));
await mkdir(dataDir, { recursive: true, mode: 0o700 });
if (windows) {
  const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' });
  const sid = identity.match(/S-1-[0-9-]+/)?.[0];
  if (!sid) throw new Error('Cannot identify the current Windows user.');
  // Protect credential directories and the bridge token through inherited ACLs.
  execFileSync('icacls.exe', [dataDir, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { stdio: 'ignore' });
} else await chmod(dataDir, 0o700);
const runtime = path.join(dataDir, 'runtime'); await mkdir(runtime, { recursive: true, mode: 0o700 });
// Copy the runtime so downloading a new ZIP or moving the checkout cannot break the host.
for (const name of ['paths.mjs', 'local-auth.mjs', 'protocol.mjs', 'limits.mjs', 'app-server.mjs', 'service.mjs', 'connections.mjs', 'claude-adapter.mjs', 'claude-browser-route.mjs', 'claude-setup.mjs', 'windows.mjs', 'auth-browser.mjs', 'daemon.mjs', 'host.mjs']) {
  await writeFile(path.join(runtime, name), await readFile(path.join(source, name)), { mode: 0o600 });
}
await mkdir(path.join(runtime, 'proof'), { recursive: true, mode: 0o700 });
for (const name of ['runtime.mjs','store.mjs','codex-login.mjs','errors.mjs','claude.mjs']) {
  await writeFile(path.join(runtime, 'proof', name), await readFile(path.join(source, 'proof', name)), { mode: 0o600 });
}
// Copy only the pinned terminal runtimes; CLI credentials/configuration are never
// copied. Windows' node-pty package includes its official native prebuilds.
let modules;
for(const candidate of [path.join(source,'node_modules'),path.join(source,'..','node_modules')]) {
  try{await access(path.join(candidate,'node-pty','package.json'));modules=candidate;break;}catch{}
}
if(!modules)throw new Error('Terminal runtime is missing. Download the complete helper package.');
for(const name of ['node-pty','@xterm/headless'])await cp(path.join(modules,name),path.join(runtime,'node_modules',name),{recursive:true});
if(windows){
  await mkdir(path.join(runtime,'windows'),{recursive:true,mode:0o700});
  for(const name of ['claude-browser.cs','compile-claude-browser.ps1'])await cp(path.join(source,'windows',name),path.join(runtime,'windows',name));
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(runtime,'windows','compile-claude-browser.ps1'),'-Source',path.join(runtime,'windows','claude-browser.cs'),'-Output',path.join(runtime,'windows','claude-browser.exe')],{stdio:'pipe'});
}
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const launcher = path.join(dataDir, windows ? 'native-host.cmd' : 'native-host');
await writeFile(launcher, windows ? batchLauncher(process.execPath, path.join(runtime, 'host.mjs')) : `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(path.join(runtime, 'host.mjs'))} "$@"\n`, { mode: 0o700 });
if (!windows) await chmod(launcher, 0o700);
for(const {id:targetId,browser:targetBrowser} of targets){
const manifestDir = windows ? path.join(dataDir, 'manifests', targetBrowser) : path.join(homedir(), '.config', browserDirs[targetBrowser], 'NativeMessagingHosts');
await mkdir(manifestDir, { recursive: true, mode: 0o700 });
const manifestPath = path.join(manifestDir, hostName + '.json');
let origins = [];
try { origins = JSON.parse(await readFile(manifestPath, 'utf8')).allowed_origins ?? []; } catch (error) { if (error.code !== 'ENOENT') throw new Error('Existing native-host manifest is invalid.'); }
origins = [...new Set([...origins.filter(origin => /^chrome-extension:\/\/[a-p]{32}\/$/.test(origin)), `chrome-extension://${targetId}/`])];
await writeFile(manifestPath, JSON.stringify({ name: hostName, description: 'MyLimits independent account helper', path: launcher, type: 'stdio', allowed_origins: origins }, null, 2), { mode: 0o600 });
if (windows) {
  execFileSync('reg.exe', ['ADD', `${registryRoots[targetBrowser]}\\${hostName}`, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { stdio: 'ignore' });
}
}
if(windows){
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPowerShell(taskScript(process.execPath, path.join(runtime, 'daemon.mjs'), executable, dataDir))], { stdio: 'pipe' });
    console.log('Windows companion registered and startup task requested. Reload MyLimits and connect an independent OpenAI or Claude account.');
    console.log('Check Task Scheduler > MyLimitsCompanion if the bridge is unavailable.');
  } catch {
    throw new Error('Browser registration succeeded, but Windows startup failed. Reopen helper setup and retry as the same Windows user.');
  }
  console.log('The companion requires an awake computer and a signed-in Windows session.');
  process.exit(0);
}
const unitDir = path.join(homedir(), '.config', 'systemd', 'user'); await mkdir(unitDir, { recursive: true });
const unitArg = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('$', '$$') + '"';
const unit = `[Unit]\nDescription=MyLimits independent account helper\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=${[process.execPath, path.join(runtime, 'daemon.mjs'), executable].map(unitArg).join(' ')}\nRestart=on-failure\nRestartSec=5\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
await writeFile(path.join(unitDir, 'mylimits-companion.service'), unit, { mode: 0o600 });
try {
  execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'pipe' });
  execFileSync('systemctl', ['--user', 'enable', 'mylimits-companion.service'], { stdio: 'pipe' });
  execFileSync('systemctl', ['--user', 'restart', 'mylimits-companion.service'], { stdio: 'pipe' });
  console.log('Companion installed and started. Reload MyLimits, open Websites, then connect an independent OpenAI or Claude account.');
} catch {
  console.log('Native host installed. Automatic service startup was unavailable. Keep this command running in a terminal:');
  console.log([process.execPath, path.join(runtime, 'daemon.mjs'), executable].map(quote).join(' '));
}
console.log('The service can refresh while the browser is closed; your computer must remain awake and online.');
