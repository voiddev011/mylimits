import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileEnvironment, findCli, cliVersion, command } from './proof/runtime.mjs';
import { privateDirectory } from './proof/store.mjs';
import { readClaudeIdentity, probeClaudeUsage, loadTerminalDependencies, stopProbeTerminal, claudeProbeArguments } from './proof/claude.mjs';
import { launchClaudeSetup } from './claude-setup.mjs';
import { ProbeError } from './proof/errors.mjs';

const source = path.dirname(fileURLToPath(import.meta.url));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export function claudeLoginArguments() { return ['auth', 'login', '--claudeai']; }
export function supportedClaudeVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return major > 2 || major === 2 && (minor > 1 || minor === 1 && patch >= 301);
}
export async function createClaudeBrowserRoute(browser, env) {
  await privateDirectory(browser);
  const script = path.join(source, 'claude-browser-route.mjs');
  const result = { ...env, MYLIMITS_AUTH_BROWSER_DIRECTORY: browser, MYLIMITS_AUTH_ROUTER_NODE: process.execPath, MYLIMITS_AUTH_ROUTER_SCRIPT: script };
  if (process.platform === 'win32') {
    result.BROWSER = path.join(source, 'windows', 'claude-browser.exe');
    try { await access(result.BROWSER); } catch { throw new ProbeError('missing-browser-router', 'Update or reinstall the helper to create its Claude browser launcher.'); }
  } else {
    result.BROWSER = path.join(browser, 'open-provider-browser');
    await writeFile(result.BROWSER, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} --raw "$@"\n`, { mode: 0o700 });
  }
  return result;
}

export async function runClaudeLogin(context, { dependencies, timeout = 180_000 } = {}) {
  const env = await createClaudeBrowserRoute(context.browser, context.env);
  const { spawnPty } = dependencies ?? await loadTerminalDependencies();
  if (context.signal?.aborted) throw new ProbeError('cancelled', 'Sign-in cancelled.');
  const [file, args] = command(context.executable, claudeLoginArguments());
  const child = spawnPty(file, args, { env, cwd: context.workspace, name: 'xterm-256color', cols: 120, rows: 40, useConpty: true });
  await new Promise((resolve, reject) => {
    let done = false, exited = false, size = 0;
    const subscriptions = [];
    const finish = (error) => {
      if (done) return; done = true; clearTimeout(timer); context.signal?.removeEventListener('abort', abort);
      subscriptions.forEach(s => s.dispose());
      void stopProbeTerminal(child, exited).then(async confirmed => {
        if (!confirmed) { reject(new ProbeError('terminal-stop-unconfirmed','Claude sign-in shutdown was not confirmed. Restart the helper.')); return; }
        if (error) { reject(error); return; }
        try {
          const marker = JSON.parse(await readFile(path.join(context.browser, 'route-result.json'), 'utf8'));
          if (marker.opened !== true) throw new Error(); resolve();
        } catch { reject(new ProbeError('browser-route-unconfirmed','The separate sign-in browser was not confirmed. No connection was accepted.')); }
      });
    };
    const abort = () => finish(new ProbeError('cancelled','Sign-in cancelled.'));
    const timer = setTimeout(() => finish(new ProbeError('login-failed','First-party Claude sign-in timed out.')), timeout);
    context.signal?.addEventListener('abort', abort, { once: true });
    // Raw CLI output stays inside the native process; never forwarded or stored.
    // No pasted OAuth code, password, model prompt or arbitrary input is accepted.
    subscriptions.push(child.onData(data => { size += Buffer.byteLength(data); if (size > 2 * 1024 * 1024) finish(new ProbeError('output-limit','Provider sign-in output exceeded its limit.')); }));
    subscriptions.push(child.onExit(event => { exited = true; finish(event.exitCode === 0 ? null : new ProbeError('login-failed','First-party Claude sign-in did not complete.')); }));
    if (context.signal?.aborted) abort();
  });
}

export function createClaudeAdapter({ locate = () => findCli('claude', Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('MYLIMITS_PROOF_')))), version = cliVersion,
  login = runClaudeLogin, identity = readClaudeIdentity, usage = probeClaudeUsage } = {}) {
  return {
    async readiness() {
      try {
        const executable = await locate();
        // Executable discovery does not consult account authorization. The
        // selected profile gets its version/status checks in context().
        if (!executable) throw new Error();
        await loadTerminalDependencies();
        if (process.platform === 'win32') await access(path.join(source,'windows','claude-browser.exe'));
        return { available: true, executable };
      } catch { return { available: false, reason: 'Install official Claude Code and update the helper. Claude Code 2.1.301+ and its isolated browser launcher are required.' }; }
    },
    async context(root, generation, signal) {
      const home = path.join(root,'claude'), workspace = path.join(root,'empty-workspace');
      for (const directory of [root,home,workspace]) await privateDirectory(directory);
      const env = profileEnvironment('claude',home);
      const executable = await locate();
      if (!supportedClaudeVersion(await version(executable,{env,cwd:workspace,signal}))) throw new ProbeError('unsupported-cli','Update official Claude Code to 2.1.301 or later.');
      const browser=path.join(root,'sign-in-browser',`attempt-${generation}`);
      return { home,workspace,env:await createClaudeBrowserRoute(browser,env),executable,signal,browser };
    },
    login, identity, usage, onboarding: launchClaudeSetup,
    async logout(context) {
      const {runCli} = await import('./proof/runtime.mjs');
      const result = await runCli(context.executable,['auth','logout'],{env:context.env,cwd:context.workspace,signal:context.signal});
      if (result.code !== 0) throw new ProbeError('logout-unconfirmed','Claude did not confirm sign-out.');
    },
  };
}
