import { mkdir, writeFile, chmod, readFile } from 'node:fs/promises';
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
if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('Provide --extension-id with the ID shown in chrome://extensions.');
const browserName = option('--browser') ?? 'chrome';
const browserDirs = { chrome: 'google-chrome', chromium: 'chromium', brave: 'BraveSoftware/Brave-Browser',edge:'microsoft-edge' };
if (!Object.hasOwn(browserDirs, browserName)) throw new Error('--browser must be chrome, chromium, brave or edge.');
let executable = option('--codex');
if (!executable) { try { executable = execFileSync(windows ? 'where.exe' : 'which', [windows ? 'codex.cmd' : 'codex'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]; } catch { throw new Error('Install Codex first: npm install -g @openai/codex'); } }
if (windows && /\.(cmd|bat)$/i.test(executable)) {
  executable = path.join(path.dirname(executable), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
}
if (!path.isAbsolute(executable)) throw new Error('--codex must be an absolute path.');
execFileSync(/\.m?js$/i.test(executable) ? process.execPath : executable, [...(/\.m?js$/i.test(executable) ? [executable] : []), '--version'], { stdio: 'ignore' });
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
for (const name of ['paths.mjs', 'local-auth.mjs', 'protocol.mjs', 'limits.mjs', 'app-server.mjs', 'service.mjs', 'auth-browser.mjs', 'daemon.mjs', 'host.mjs']) {
  await writeFile(path.join(runtime, name), await readFile(path.join(source, name)), { mode: 0o600 });
}
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const launcher = path.join(dataDir, windows ? 'native-host.cmd' : 'native-host');
await writeFile(launcher, windows ? batchLauncher(process.execPath, path.join(runtime, 'host.mjs')) : `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(path.join(runtime, 'host.mjs'))} "$@"\n`, { mode: 0o700 });
if (!windows) await chmod(launcher, 0o700);
const manifestDir = windows ? path.join(dataDir, 'manifests', browserName) : path.join(homedir(), '.config', browserDirs[browserName], 'NativeMessagingHosts');
await mkdir(manifestDir, { recursive: true, mode: 0o700 });
const manifestPath = path.join(manifestDir, hostName + '.json');
let origins = [];
try { origins = JSON.parse(await readFile(manifestPath, 'utf8')).allowed_origins ?? []; } catch (error) { if (error.code !== 'ENOENT') throw new Error('Existing native-host manifest is invalid.'); }
origins = [...new Set([...origins.filter(origin => /^chrome-extension:\/\/[a-p]{32}\/$/.test(origin)), `chrome-extension://${extensionId}/`])];
await writeFile(manifestPath, JSON.stringify({ name: hostName, description: 'MyLimits OpenAI quota companion', path: launcher, type: 'stdio', allowed_origins: origins }, null, 2), { mode: 0o600 });
if (windows) {
  execFileSync('reg.exe', ['ADD', `${registryRoots[browserName]}\\${hostName}`, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { stdio: 'ignore' });
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPowerShell(taskScript(process.execPath, path.join(runtime, 'daemon.mjs'), executable, dataDir))], { stdio: 'pipe' });
    console.log('Windows companion registered and startup task requested. Reload MyLimits and Connect OpenAI.');
    console.log('Check Task Scheduler > MyLimitsCompanion if the bridge is unavailable.');
  } catch {
    console.log('Browser registration succeeded, but Windows startup setup failed. Keep this PowerShell command running:');
    console.log('& ' + [process.execPath, path.join(runtime, 'daemon.mjs'), executable].map(psLiteral).join(' '));
  }
  console.log('The companion requires an awake computer and a signed-in Windows session.');
  process.exit(0);
}
const unitDir = path.join(homedir(), '.config', 'systemd', 'user'); await mkdir(unitDir, { recursive: true });
const unitArg = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('$', '$$') + '"';
const unit = `[Unit]\nDescription=MyLimits OpenAI quota companion\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=${[process.execPath, path.join(runtime, 'daemon.mjs'), executable].map(unitArg).join(' ')}\nRestart=on-failure\nRestartSec=5\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
await writeFile(path.join(unitDir, 'mylimits-companion.service'), unit, { mode: 0o600 });
try {
  execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'pipe' });
  execFileSync('systemctl', ['--user', 'enable', 'mylimits-companion.service'], { stdio: 'pipe' });
  execFileSync('systemctl', ['--user', 'restart', 'mylimits-companion.service'], { stdio: 'pipe' });
  console.log('Companion installed and started. Reload MyLimits, open Websites, then Connect OpenAI.');
} catch {
  console.log('Native host installed. Automatic service startup was unavailable. Keep this command running in a terminal:');
  console.log([process.execPath, path.join(runtime, 'daemon.mjs'), executable].map(quote).join(' '));
}
console.log('The service can refresh while the browser is closed; your computer must remain awake and online.');
