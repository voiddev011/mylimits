import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

// Never inherit another product's account selector. Proxy/CA/OS settings survive.
export function profileEnvironment(provider, directory, base = process.env) {
  const env = Object.fromEntries(Object.entries(base).filter(([key, value]) => typeof value === 'string' &&
    !/^(OPENAI_|CODEX_|ANTHROPIC_|CLAUDE_|AWS_|AZURE_|GCLOUD_|GOOGLE_APPLICATION_CREDENTIALS$|BASH_ENV$|ENV$|NODE_OPTIONS$|BROWSER$)/i.test(key)));
  env[provider === 'openai' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = directory;
  return env;
}

export function proofDirectory(platform = process.platform, env = process.env, home = homedir()) {
  return platform === 'win32'
    ? path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), 'MyLimitsAccountProof')
    : path.join(home, '.local', 'share', 'mylimits-account-proof');
}

export async function findCli(provider, env = process.env, platform = process.platform) {
  const name = provider === 'openai' ? 'codex' : 'claude';
  const override = env[`MYLIMITS_PROOF_${name.toUpperCase()}`];
  if (override) {
    if (!path.isAbsolute(override) || !/\.(?:exe|m?js)$/.test(override) && platform === 'win32') throw new Error('Use an absolute native executable or JavaScript CLI path.');
    await access(override); return override;
  }
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  const candidates = dirs.map(dir => path.join(dir, platform === 'win32' ? `${name}.exe` : name));
  if (provider === 'claude') candidates.unshift(path.join(homedir(), '.local', 'bin', platform === 'win32' ? 'claude.exe' : 'claude'));
  if (provider === 'openai' && platform === 'win32' && env.APPDATA) candidates.push(path.join(env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  for (const candidate of candidates) try { await access(candidate); return candidate; } catch {}
  throw new Error(`${name} is not installed or not discoverable. See docs/ACCOUNT-PROOF.md.`);
}

export function command(executable, args) {
  if (/\.(cmd|bat|ps1)$/i.test(executable)) throw new Error('Use the native CLI executable, not a shell launcher.');
  return /\.m?js$/i.test(executable) ? [process.execPath, [executable, ...args]] : [executable, args];
}

// Only auth status/version/help stdout is captured; errors never include output.
export function runCli(executable, args, { env, cwd, timeout = 15_000, inherit = false, spawnProcess = spawn, signal } = {}) {
  const [file, argv] = command(executable, args);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('CLI operation cancelled.')); return; }
    const child = spawnProcess(file, argv, { env, cwd, shell: false, windowsHide: !inherit, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    let output = ''; let settled = false;
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(new Error(error)) : resolve(result); };
    const abort = () => { child.kill(); finish('CLI operation cancelled.'); };
    const timer = setTimeout(() => { child.kill(); finish('CLI operation timed out.'); }, timeout);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', data => {
      output += data.toString();
      if (Buffer.byteLength(output) > 256 * 1024) { child.kill(); finish('CLI output exceeded the diagnostic limit.'); }
    });
    child.stderr?.on('data', () => {});
    child.once('error', () => finish('Could not start the official CLI.'));
    child.once('exit', code => finish(null, { code, output }));
  });
}

export async function cliVersion(executable, options) {
  const { code, output } = await runCli(executable, ['--version'], options);
  const version = output.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0];
  if (code !== 0 || !version) throw new Error('CLI version could not be verified.');
  return version;
}
